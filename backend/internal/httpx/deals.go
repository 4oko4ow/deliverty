package httpx

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sol/deliverty/backend/internal/bot"
)

func RegisterDealRoutes(g *gin.RouterGroup, pool *pgxpool.Pool) {
	g.GET("/deals/:id/deep-link", dealDeepLink(pool))
	g.POST("/deals/:id/status", updateDealStatus(pool))   // body: {"status":"agreed|handoff_done|cancelled"}
	g.POST("/deals/:id/rate", rateDeal(pool))             // body: {"score":1} increments small rating
}

func dealDeepLink(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		dealID := c.Param("id")
		log.Printf("[DEEPLINK] Generating link for deal %s, user %s", dealID, c.GetString(CtxUserID))

		// ensure caller participates in this deal
		uid := c.GetString(CtxUserID)
		if uid == "" {
			log.Printf("[DEEPLINK] No user ID in context")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}
		
		var ok bool
		err := pool.QueryRow(c, `
			SELECT EXISTS(
			  SELECT 1 FROM deal d
			  JOIN publication pr ON pr.id=d.request_pub_id
			  JOIN app_user ur ON ur.id=pr.user_id
			  JOIN publication pt ON pt.id=d.trip_pub_id
			  JOIN app_user ut ON ut.id=pt.user_id
			  WHERE d.id=$1 AND (ur.tg_user_id=$2::text::bigint OR ut.tg_user_id=$2::text::bigint)
			)`, dealID, uid).Scan(&ok)

		if err != nil {
			log.Printf("[DEEPLINK] Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}
		
		if !ok {
			log.Printf("[DEEPLINK] User %s is not a participant of deal %s", uid, dealID)
			c.JSON(http.StatusForbidden, gin.H{"error": "not allowed"})
			return
		}

		botName := os.Getenv("TG_BOT_NAME")
		if botName == "" {
			log.Printf("[DEEPLINK] TG_BOT_NAME not set")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "bot not configured"})
			return
		}
		
		payload := fmt.Sprintf("deal:%s", dealID)
		sig := bot.Sign(payload)
		// URL-encode the start parameter to avoid issues with colons and special characters
		startParam := fmt.Sprintf("%s:%s", payload, sig)
		encodedStart := url.QueryEscape(startParam)
		link := fmt.Sprintf("https://t.me/%s?start=%s", botName, encodedStart)
		
		log.Printf("[DEEPLINK] Generated link for deal %s", dealID)

		c.JSON(http.StatusOK, gin.H{"url": link})
	}
}

type statusIn struct {
	Status string `json:"status" binding:"required"`
}

func updateDealStatus(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in statusIn
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad json"})
			return
		}

		if in.Status != "agreed" && in.Status != "handoff_done" && in.Status != "cancelled" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad status"})
			return
		}

		dealID := c.Param("id")
		uid := c.GetString(CtxUserID)

		// only participants can update
		cmd := `
		  UPDATE deal SET status=$1, last_message_at=now()
		  WHERE id=$2 AND EXISTS(
		    SELECT 1 FROM deal d
		      JOIN publication pr ON pr.id=d.request_pub_id
		      JOIN app_user ur ON ur.id=pr.user_id
		      JOIN publication pt ON pt.id=d.trip_pub_id
		      JOIN app_user ut ON ut.id=pt.user_id
		    WHERE d.id=$2 AND (ur.tg_user_id=$3::text::bigint OR ut.tg_user_id=$3::text::bigint)
		  )`

		ct, err := pool.Exec(c, cmd, in.Status, dealID, uid)
		if err != nil || ct.RowsAffected() == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "not allowed"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

type rateIn struct {
	Score int `json:"score" binding:"required"` // +1 only in MVP
}

func rateDeal(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in rateIn
		if err := c.ShouldBindJSON(&in); err != nil || in.Score != 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad score"})
			return
		}

		dealID := c.Param("id")
		uid := c.GetString(CtxUserID)

		// Increment counterpart's rating_small once per user per deal
		_, err := pool.Exec(c, `
		  WITH d AS (
		    SELECT d.id, ur.id AS req_user_id, ut.id AS trip_user_id,
		           CASE WHEN ur.tg_user_id=$2::text::bigint THEN ut.id
		                WHEN ut.tg_user_id=$2::text::bigint THEN ur.id END AS target_user_id
		    FROM deal d
		      JOIN publication pr ON pr.id=d.request_pub_id
		      JOIN app_user ur ON ur.id=pr.user_id
		      JOIN publication pt ON pt.id=d.trip_pub_id
		      JOIN app_user ut ON ut.id=pt.user_id
		    WHERE d.id=$1
		  ), once AS (
		    INSERT INTO rating_log(deal_id, rater_tg, target_user_id)
		    SELECT d.id, $2::text::bigint, d.target_user_id FROM d
		    ON CONFLICT DO NOTHING RETURNING 1
		  )
		  UPDATE app_user u SET rating_small = rating_small + 1
		  WHERE u.id = (SELECT target_user_id FROM d)
		    AND EXISTS (SELECT 1 FROM once)
		`, dealID, uid)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "rate failed"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
