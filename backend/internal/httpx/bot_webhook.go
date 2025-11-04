package httpx

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sol/deliverty/backend/internal/bot"
)

// Telegram Update (trimmed)
type Update struct {
	Message *struct {
		MessageID int64  `json:"message_id"`
		Text      string `json:"text"`
		From      struct {
			ID int64 `json:"id"`
		} `json:"from"`
		Chat struct {
			ID int64 `json:"id"`
		} `json:"chat"`
	} `json:"message"`
}

func registerBotRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	r.POST("/bot/webhook", func(c *gin.Context) {
		var up Update
		if err := c.ShouldBindJSON(&up); err != nil || up.Message == nil {
			c.Status(http.StatusOK)
			return
		}

		tg := bot.New()
		text := strings.TrimSpace(up.Message.Text)

		// /start deal:<id>:<sig>
		if strings.HasPrefix(text, "/start ") {
			parts := strings.Split(strings.TrimPrefix(text, "/start "), ":")
			if len(parts) != 3 || parts[0] != "deal" || !bot.Verify(parts[0]+":"+parts[1], parts[2]) {
				_, _ = tg.API("sendMessage", gin.H{"chat_id": up.Message.Chat.ID, "text": "Неверная ссылка"})
				c.Status(http.StatusOK)
				return
			}

			// Ensure participant belongs to deal
			var ok bool
			err := pool.QueryRow(c, `
			  SELECT EXISTS(
			    SELECT 1 FROM deal d
			      JOIN publication pr ON pr.id=d.request_pub_id
			      JOIN app_user ur ON ur.id=pr.user_id
			      JOIN publication pt ON pt.id=d.trip_pub_id
			      JOIN app_user ut ON ut.id=pt.user_id
			    WHERE d.id=$1 AND (ur.tg_user_id=$2 OR ut.tg_user_id=$2)
			  )`, parts[1], up.Message.From.ID).Scan(&ok)

			if err != nil || !ok {
				_, _ = tg.API("sendMessage", gin.H{"chat_id": up.Message.Chat.ID, "text": "Вы не являетесь участником"})
				c.Status(http.StatusOK)
				return
			}

			_, _ = tg.API("sendMessage", gin.H{"chat_id": up.Message.Chat.ID, "text": "Подключено. Отправляйте сообщения сюда для пересылки.\nКоманды: /agree, /done, /cancel"})
			c.Status(http.StatusOK)
			return
		}

		// Commands update deal status
		switch text {
		case "/agree":
			setStatus(c, pool, up.Message.From.ID, "agreed")
		case "/done":
			setStatus(c, pool, up.Message.From.ID, "handoff_done")
		case "/cancel":
			setStatus(c, pool, up.Message.From.ID, "cancelled")
		default:
			relayMessage(c, pool, tg, up.Message.From.ID, text)
		}

		c.Status(http.StatusOK)
	})
}

func setStatus(c *gin.Context, pool *pgxpool.Pool, fromTG int64, status string) {
	// Update only deals where sender participates; no message logs kept
	_, _ = pool.Exec(c, `
	  UPDATE deal SET status=$1, last_message_at=now()
	  WHERE id IN (
	    SELECT d.id FROM deal d
	      JOIN publication pr ON pr.id=d.request_pub_id
	      JOIN app_user ur ON ur.id=pr.user_id
	      JOIN publication pt ON pt.id=d.trip_pub_id
	      JOIN app_user ut ON ut.id=pt.user_id
	    WHERE ur.tg_user_id=$2 OR ut.tg_user_id=$2
	  )`, status, fromTG)
}

func relayMessage(c *gin.Context, pool *pgxpool.Pool, tg *bot.TG, fromTG int64, text string) {
	// Find counterpart chat_id by tg_user_id; we don't store messages per policy
	type row struct {
		DealID int64
		ToTG   int64
	}

	rows, _ := pool.Query(c, `
	  SELECT d.id,
	    CASE WHEN ur.tg_user_id=$1 THEN ut.tg_user_id ELSE ur.tg_user_id END AS to_tg
	  FROM deal d
	    JOIN publication pr ON pr.id=d.request_pub_id
	    JOIN app_user ur ON ur.id=pr.user_id
	    JOIN publication pt ON pt.id=d.trip_pub_id
	    JOIN app_user ut ON ut.id=pt.user_id
	  WHERE (ur.tg_user_id=$1 OR ut.tg_user_id=$1) AND d.status!='cancelled'
	  ORDER BY d.created_at DESC LIMIT 1
	`, fromTG)
	defer rows.Close()

	var r row
	if rows.Next() {
		_ = rows.Scan(&r.DealID, &r.ToTG)
		_, _ = tg.API("sendMessage", gin.H{"chat_id": r.ToTG, "text": text})
		_, _ = pool.Exec(c, `UPDATE deal SET last_message_at=now() WHERE id=$1`, r.DealID)
	}
}

// build deep link: https://t.me/<botname>?start=deal:<id>:<sig>
func DealDeepLink(botName string, dealID int64) string {
	payload := fmt.Sprintf("deal:%d", dealID)
	return fmt.Sprintf("https://t.me/%s?start=%s:%s", botName, payload, bot.Sign(payload))
}
