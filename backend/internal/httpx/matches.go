package httpx

import (
	"context"
	"database/sql"
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
	DateStart  string `json:"date_start,omitempty"`
	DateEnd    string `json:"date_end,omitempty"`
	Date       string `json:"date,omitempty"`
	Item       string `json:"item"`
	Weight     string `json:"weight"`
	Score      int    `json:"score"`
	UserRating int    `json:"user_rating"`
	Username   string `json:"username"`
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
		var aStart, aEnd sql.NullTime
		var aDate sql.NullTime
		err = pool.QueryRow(c, `
			SELECT kind, from_iata, to_iata, date_start, date_end, date, item, weight
			FROM publication WHERE id=$1 AND is_active`, pubID).
			Scan(&kind, &from, &to, &aStart, &aEnd, &aDate, &item, &weight)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "pub not found"})
			return
		}

		// Determine anchor date range
		var anchorStart, anchorEnd time.Time
		if kind == "trip" && aDate.Valid {
			anchorStart = aDate.Time
			anchorEnd = aDate.Time
		} else if aStart.Valid && aEnd.Valid {
			anchorStart = aStart.Time
			anchorEnd = aEnd.Time
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date range"})
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

		// Build query based on opposite kind with city-based matching
		var rows interface {
			Close()
			Err() error
			Next() bool
			Scan(dest ...interface{}) error
		}
		if opp == "trip" {
			// Looking for trips - use date field, match by city
			rows, err = pool.Query(c, `
				SELECT p.id, p.kind, p.from_iata, p.to_iata, p.date_start, p.date_end, p.date, p.item, p.weight,
				       COALESCE(u.rating_small, 0), COALESCE(u.tg_username, '')
				FROM publication p
				JOIN app_user u ON u.id = p.user_id
				LEFT JOIN airport a_from ON a_from.iata = p.from_iata
				LEFT JOIN airport a_to ON a_to.iata = p.to_iata
				LEFT JOIN airport a_from_search ON a_from_search.iata = $3
				LEFT JOIN airport a_to_search ON a_to_search.iata = $4
				WHERE p.is_active
				  AND p.id != $1
				  AND p.user_id != $7
				  AND p.kind=$2::pub_type
				  AND (
				    -- Match by exact IATA or by city
				    a_from.iata = $3 OR (a_from.city IS NOT NULL AND a_from.city = a_from_search.city)
				  )
				  AND (
				    -- Match by exact IATA or by city
				    a_to.iata = $4 OR (a_to.city IS NOT NULL AND a_to.city = a_to_search.city)
				  )
				  AND p.date IS NOT NULL
				  AND p.date >= $5 AND p.date <= $6
				ORDER BY p.created_at DESC
				LIMIT 50
			`, pubID, opp, from, to, anchorStart, anchorEnd, anchorUserID)
		} else {
			// Looking for requests - use date_start/date_end, match by city
			rows, err = pool.Query(c, `
				SELECT p.id, p.kind, p.from_iata, p.to_iata, p.date_start, p.date_end, p.date, p.item, p.weight,
				       COALESCE(u.rating_small, 0), COALESCE(u.tg_username, '')
				FROM publication p
				JOIN app_user u ON u.id = p.user_id
				LEFT JOIN airport a_from ON a_from.iata = p.from_iata
				LEFT JOIN airport a_to ON a_to.iata = p.to_iata
				LEFT JOIN airport a_from_search ON a_from_search.iata = $3
				LEFT JOIN airport a_to_search ON a_to_search.iata = $4
				WHERE p.is_active
				  AND p.id != $1
				  AND p.user_id != $7
				  AND p.kind=$2::pub_type
				  AND (
				    -- Match by exact IATA or by city
				    a_from.iata = $3 OR (a_from.city IS NOT NULL AND a_from.city = a_from_search.city)
				  )
				  AND (
				    -- Match by exact IATA or by city
				    a_to.iata = $4 OR (a_to.city IS NOT NULL AND a_to.city = a_to_search.city)
				  )
				  AND NOT (p.date_end < $5 OR p.date_start > $6)
				ORDER BY p.created_at DESC
				LIMIT 50
			`, pubID, opp, from, to, anchorStart, anchorEnd, anchorUserID)
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db"})
			return
		}
		defer rows.Close()

		out := []MatchOut{}

		for rows.Next() {
			var id int64
			var k, f, t, it, w string
			var ds, de sql.NullTime
			var singleDate sql.NullTime
			var userRating int
			var username string
			if err := rows.Scan(&id, &k, &f, &t, &ds, &de, &singleDate, &it, &w, &userRating, &username); err != nil {
				continue
			}

			// Determine candidate date range
			var candidateStart, candidateEnd time.Time
			if k == "trip" && singleDate.Valid {
				candidateStart = singleDate.Time
				candidateEnd = singleDate.Time
			} else if ds.Valid && de.Valid {
				candidateStart = ds.Time
				candidateEnd = de.Time
			} else {
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

			ov := match.OverlapDays(anchorStart, anchorEnd, candidateStart, candidateEnd)
			score := 10 * ov
			if it == item {
				score += 5
			}

			m := MatchOut{
				OtherPubID: id, Kind: k, From: f, To: t,
				Item: it, Weight: w, Score: score,
				UserRating: userRating, Username: username,
			}

			if k == "trip" && singleDate.Valid {
				m.Date = singleDate.Time.Format("2006-01-02")
			} else if ds.Valid && de.Valid {
				m.DateStart = ds.Time.Format("2006-01-02")
				m.DateEnd = de.Time.Format("2006-01-02")
			}

			out = append(out, m)
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
			var reqRating, tripRating int
			var reqUsername, tripUsername string
			err := pool.QueryRow(ctx, `
				SELECT 
					ur.tg_user_id, ut.tg_user_id,
					COALESCE(ur.rating_small, 0), COALESCE(ut.rating_small, 0),
					COALESCE(ur.tg_username, ''), COALESCE(ut.tg_username, '')
				FROM deal d
				JOIN publication pr ON pr.id=d.request_pub_id
				JOIN app_user ur ON ur.id=pr.user_id
				JOIN publication pt ON pt.id=d.trip_pub_id
				JOIN app_user ut ON ut.id=pt.user_id
				WHERE d.id=$1
			`, dealID).Scan(&reqTG, &tripTG, &reqRating, &tripRating, &reqUsername, &tripUsername)

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

			// Build counterpart info for each user
			reqCounterpartInfo := buildProfileText(tripUsername, tripRating)
			tripCounterpartInfo := buildProfileText(reqUsername, reqRating)

			msgToReq := fmt.Sprintf("✅ Создана новая сделка!\n\n👤 Участник:\n%s\n\nНажмите кнопку ниже, чтобы начать общение.", reqCounterpartInfo)
			msgToTrip := fmt.Sprintf("✅ Создана новая сделка!\n\n👤 Участник:\n%s\n\nНажмите кнопку ниже, чтобы начать общение.", tripCounterpartInfo)

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
					"text":         msgToReq,
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
					"text":         msgToTrip,
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
