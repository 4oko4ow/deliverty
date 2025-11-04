package httpx

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sol/deliverty/backend/internal/bot"
	"github.com/sol/deliverty/backend/internal/match"
)

type MatchOut struct {
	OtherPubID int64  `json:"other_pub_id"`
	Kind       string `json:"kind"`
	From       string `json:"from_iata"`
	To         string `json:"to_iata"`
	DateStart  string `json:"date_start"`
	DateEnd    string `json:"date_end"`
	Item       string `json:"item"`
	Weight     string `json:"weight"`
	Score      int    `json:"score"`
}

func RegisterMatchRoutes(g *gin.RouterGroup, pool *pgxpool.Pool) {
	g.GET("/matches", findMatches(pool)) // ?pub_id=
	g.POST("/deals", createDeal(pool))   // {request_pub_id, trip_pub_id}
}

// RegisterMatchAuthRoutes registers only auth-required match routes
func RegisterMatchAuthRoutes(g *gin.RouterGroup, pool *pgxpool.Pool) {
	g.POST("/deals", createDeal(pool)) // {request_pub_id, trip_pub_id}
}

func findMatches(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		pubIDStr := c.Query("pub_id")
		if pubIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "pub_id required"})
			return
		}

		pubID, err := strconv.ParseInt(pubIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pub_id"})
			return
		}

		// Load anchor pub
		var kind, from, to, item, weight string
		var aStart, aEnd time.Time
		err = pool.QueryRow(c, `
			SELECT kind, from_iata, to_iata, date_start, date_end, item, weight
			FROM publication WHERE id=$1 AND is_active`, pubID).
			Scan(&kind, &from, &to, &aStart, &aEnd, &item, &weight)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "pub not found"})
			return
		}

		// Looking for opposite kind on same route with overlapping window
		opp := "trip"
		if kind == "trip" {
			opp = "request"
		}

		// Get user_id of the anchor publication to exclude own publications
		var anchorUserID int64
		_ = pool.QueryRow(c, `SELECT user_id FROM publication WHERE id=$1`, pubID).Scan(&anchorUserID)

		rows, err := pool.Query(c, `
			SELECT id, kind, from_iata, to_iata, date_start, date_end, item, weight
			FROM publication
			WHERE is_active
			  AND id != $1
			  AND user_id != $7
			  AND kind=$2::pub_type
			  AND from_iata=$3 AND to_iata=$4
			  AND NOT (date_end < $5 OR date_start > $6)
			ORDER BY created_at DESC
			LIMIT 50
		`, pubID, opp, from, to, aStart, aEnd, anchorUserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db"})
			return
		}
		defer rows.Close()

		out := []MatchOut{}

		for rows.Next() {
			var id int64
			var k, f, t, it, w string
			var ds, de time.Time
			if err := rows.Scan(&id, &k, &f, &t, &ds, &de, &it, &w); err != nil {
				continue
			}

			// weight rule applies when trip capacity vs request weight
			ok := true
			if kind == "request" {
				ok = match.WeightOK(weight, w) // trip w must fit request weight
			} else {
				ok = match.WeightOK(w, weight) // anchor trip capacity (weight) must fit request weight (w)
			}
			if !ok {
				continue
			}

			ov := match.OverlapDays(aStart, aEnd, ds, de)
			score := 10 * ov
			if it == item {
				score += 5
			}

			out = append(out, MatchOut{
				OtherPubID: id, Kind: k, From: f, To: t,
				DateStart: ds.Format("2006-01-02"), DateEnd: de.Format("2006-01-02"),
				Item: it, Weight: w, Score: score,
			})
		}

		c.JSON(http.StatusOK, out)
	}
}

type DealIn struct {
	RequestPubID int64 `json:"request_pub_id" binding:"required"`
	TripPubID    int64 `json:"trip_pub_id" binding:"required"`
}

func createDeal(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in DealIn
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad json"})
			return
		}

		// Verify kinds
		var k1, k2 string
		if err := pool.QueryRow(c, `SELECT kind FROM publication WHERE id=$1 AND is_active`, in.RequestPubID).Scan(&k1); err != nil || k1 != "request" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "request_pub invalid"})
			return
		}

		if err := pool.QueryRow(c, `SELECT kind FROM publication WHERE id=$1 AND is_active`, in.TripPubID).Scan(&k2); err != nil || k2 != "trip" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "trip_pub invalid"})
			return
		}

		var dealID int64
		err := pool.QueryRow(c, `
			INSERT INTO deal (request_pub_id, trip_pub_id, status)
			VALUES ($1,$2,'new')
			ON CONFLICT (request_pub_id, trip_pub_id) DO UPDATE SET status='new'
			RETURNING id
		`, in.RequestPubID, in.TripPubID).Scan(&dealID)
		if err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "deal exists?"})
			return
		}

		// Send notification to both participants via Telegram
		go func() {
			ctx := context.Background()
			tg := bot.New()
			if tg.Token == "" {
				return
			}

			var reqTG, tripTG int64
			err := pool.QueryRow(ctx, `
				SELECT ur.tg_user_id, ut.tg_user_id
				FROM deal d
				JOIN publication pr ON pr.id=d.request_pub_id
				JOIN app_user ur ON ur.id=pr.user_id
				JOIN publication pt ON pt.id=d.trip_pub_id
				JOIN app_user ut ON ut.id=pt.user_id
				WHERE d.id=$1
			`, dealID).Scan(&reqTG, &tripTG)

			if err != nil {
				log.Printf("[DEAL] Failed to get participants for deal %d: %v", dealID, err)
				return
			}

			botName := os.Getenv("TG_BOT_NAME")
			if botName == "" {
				log.Printf("[DEAL] TG_BOT_NAME not set, cannot generate deep-link")
				return
			}

			payload := fmt.Sprintf("deal:%d", dealID)
			sig := bot.Sign(payload)
			startParam := fmt.Sprintf("%s:%s", payload, sig)
			encodedStart := url.QueryEscape(startParam)
			link := fmt.Sprintf("https://t.me/%s?start=%s", botName, encodedStart)

			msg := fmt.Sprintf("✅ Создана новая сделка!\n\nНажмите кнопку ниже, чтобы начать общение с другим участником.")

			// Create inline keyboard with button that triggers the /start command via callback
			// Use callback_data to handle the button click
			keyboard := gin.H{
				"inline_keyboard": [][]gin.H{
					{
						{
							"text":          "Начать общение",
							"callback_data": fmt.Sprintf("start_deal:%s", startParam),
						},
					},
					{
						{
							"text": "Открыть ссылку",
							"url":  link,
						},
					},
				},
			}

			// Send to both participants (avoid duplicate if same user)
			if reqTG != 0 {
				_, err := tg.API("sendMessage", gin.H{
					"chat_id":      reqTG,
					"text":         msg,
					"reply_markup": keyboard,
				})
				if err != nil {
					log.Printf("[DEAL] Failed to send message to request user %d: %v", reqTG, err)
				} else {
					log.Printf("[DEAL] Sent notification to request user %d for deal %d", reqTG, dealID)
				}
			}
			// Only send to trip user if different from request user
			if tripTG != 0 && tripTG != reqTG {
				_, err := tg.API("sendMessage", gin.H{
					"chat_id":      tripTG,
					"text":         msg,
					"reply_markup": keyboard,
				})
				if err != nil {
					log.Printf("[DEAL] Failed to send message to trip user %d: %v", tripTG, err)
				} else {
					log.Printf("[DEAL] Sent notification to trip user %d for deal %d", tripTG, dealID)
				}
			}
		}()

		c.JSON(http.StatusOK, gin.H{"id": dealID})
	}
}
