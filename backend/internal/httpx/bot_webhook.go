package httpx

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
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
	CallbackQuery *struct {
		ID      string `json:"id"`
		From    struct {
			ID int64 `json:"id"`
		} `json:"from"`
		Message struct {
			MessageID int64 `json:"message_id"`
			Chat      struct {
				ID int64 `json:"id"`
			} `json:"chat"`
		} `json:"message"`
		Data string `json:"data"`
	} `json:"callback_query"`
}

func registerBotRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	r.POST("/bot/webhook", func(c *gin.Context) {
		log.Printf("[BOT] Webhook called - received request")
		
		var up Update
		if err := c.ShouldBindJSON(&up); err != nil {
			log.Printf("[BOT] Failed to parse JSON: %v", err)
			c.Status(http.StatusOK)
			return
		}
		
		tg := bot.New()

		// Handle callback query (button clicks)
		if up.CallbackQuery != nil {
			log.Printf("[BOT] Received callback query from user %d: %q", up.CallbackQuery.From.ID, up.CallbackQuery.Data)
			
			// Answer callback to remove loading state
			_, _ = tg.API("answerCallbackQuery", gin.H{
				"callback_query_id": up.CallbackQuery.ID,
			})

			// Handle start_deal callback
			if strings.HasPrefix(up.CallbackQuery.Data, "start_deal:") {
				startParam := strings.TrimPrefix(up.CallbackQuery.Data, "start_deal:")
				// Simulate /start command by processing the start parameter
				text := fmt.Sprintf("/start %s", startParam)
				log.Printf("[BOT] Processing callback as /start command: %q", text)
				
			// Process the start command directly
			processStartDeal(c.Request.Context(), pool, tg, up.CallbackQuery.From.ID, up.CallbackQuery.Message.Chat.ID, startParam)
				c.Status(http.StatusOK)
				return
			}

			c.Status(http.StatusOK)
			return
		}

		if up.Message == nil {
			log.Printf("[BOT] Update received but Message is nil (might be callback_query, edited_message, etc.)")
			c.Status(http.StatusOK)
			return
		}

		text := strings.TrimSpace(up.Message.Text)

		log.Printf("[BOT] Received message from user %d (chat %d): %q", up.Message.From.ID, up.Message.Chat.ID, text)

		// Handle /start command
		if strings.HasPrefix(text, "/start") {
			// /start connect - user connecting from web
			if text == "/start connect" {
				// Check if user exists in database
				var exists bool
				_ = pool.QueryRow(c, `
					SELECT EXISTS(SELECT 1 FROM app_user WHERE tg_user_id=$1)
				`, up.Message.From.ID).Scan(&exists)

				if exists {
					_, _ = tg.API("sendMessage", gin.H{
						"chat_id": up.Message.Chat.ID,
						"text":    "✅ Отлично! Бот подключен. Теперь вы будете получать уведомления о совпадениях и сделках в Telegram.\n\nИспользуйте веб-сайт для поиска и создания объявлений, а здесь вы будете получать уведомления и можете общаться с другими участниками сделок.",
					})
				} else {
					_, _ = tg.API("sendMessage", gin.H{
						"chat_id": up.Message.Chat.ID,
						"text":    "Привет! Сначала авторизуйтесь на веб-сайте Deliverty, а затем вернитесь сюда.",
					})
				}
				c.Status(http.StatusOK)
				return
			}

			// /start deal:<id>:<sig> (or URL-encoded)
			if strings.HasPrefix(text, "/start ") {
				startParam := strings.TrimPrefix(text, "/start ")
				processStartDeal(c.Request.Context(), pool, tg, up.Message.From.ID, up.Message.Chat.ID, startParam)
				c.Status(http.StatusOK)
				return
			}

			// Plain /start - show welcome message
			_, _ = tg.API("sendMessage", gin.H{
				"chat_id": up.Message.Chat.ID,
				"text":    "Привет! Это бот Deliverty.\n\nИспользуйте веб-сайт для поиска и создания объявлений. Здесь вы будете получать уведомления о совпадениях и сделках.",
			})
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

func processStartDeal(ctx context.Context, pool *pgxpool.Pool, tg *bot.TG, userID, chatID int64, startParam string) {
	log.Printf("[BOT] Processing deep-link (raw): %q", startParam)
	
	// Try to URL-decode in case Telegram didn't decode it automatically
	decoded, err := url.QueryUnescape(startParam)
	if err == nil && decoded != startParam {
		log.Printf("[BOT] URL-decoded parameter: %q -> %q", startParam, decoded)
		startParam = decoded
	}
	
	log.Printf("[BOT] Processing deep-link (after decode): %q", startParam)
	
	parts := strings.Split(startParam, ":")
	log.Printf("[BOT] Split parts: %v (len=%d)", parts, len(parts))
	
	if len(parts) != 3 {
		log.Printf("[BOT] Invalid parts count: expected 3, got %d", len(parts))
		_, _ = tg.API("sendMessage", gin.H{"chat_id": chatID, "text": "Неверная ссылка: неверный формат"})
		return
	}
	
	if parts[0] != "deal" {
		log.Printf("[BOT] Invalid prefix: expected 'deal', got %q", parts[0])
		_, _ = tg.API("sendMessage", gin.H{"chat_id": chatID, "text": "Неверная ссылка: неверный тип"})
		return
	}
	
	payload := parts[0] + ":" + parts[1]
	sig := parts[2]
	isValid := bot.Verify(payload, sig)
	log.Printf("[BOT] Verifying signature: payload=%q, sig=%q, valid=%v", payload, sig, isValid)
	
	if !isValid {
		log.Printf("[BOT] Signature verification failed")
		_, _ = tg.API("sendMessage", gin.H{"chat_id": chatID, "text": "Неверная ссылка: подпись неверна"})
		return
	}

	dealID := parts[1]
	log.Printf("[BOT] Checking if user %d is participant of deal %s", userID, dealID)

	// Ensure participant belongs to deal
	var ok bool
	err = pool.QueryRow(ctx, `
	  SELECT EXISTS(
	    SELECT 1 FROM deal d
	      JOIN publication pr ON pr.id=d.request_pub_id
	      JOIN app_user ur ON ur.id=pr.user_id
	      JOIN publication pt ON pt.id=d.trip_pub_id
	      JOIN app_user ut ON ut.id=pt.user_id
	    WHERE d.id=$1 AND (ur.tg_user_id=$2 OR ut.tg_user_id=$2)
	  )`, dealID, userID).Scan(&ok)

	if err != nil {
		log.Printf("[BOT] Database error checking participant: %v", err)
		_, _ = tg.API("sendMessage", gin.H{"chat_id": chatID, "text": "Ошибка при проверке участника"})
		return
	}
	
	log.Printf("[BOT] User %d is participant: %v", userID, ok)

	if !ok {
		log.Printf("[BOT] User %d is not a participant of deal %s", userID, dealID)
		_, _ = tg.API("sendMessage", gin.H{"chat_id": chatID, "text": "Вы не являетесь участником"})
		return
	}

	log.Printf("[BOT] Successfully connected user %d to deal %s", userID, dealID)
	_, _ = tg.API("sendMessage", gin.H{"chat_id": chatID, "text": "Подключено. Отправляйте сообщения сюда для пересылки.\nКоманды: /agree, /done, /cancel"})
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
