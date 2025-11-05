package httpx

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sol/deliverty/backend/internal/bot"
)

var contactsRe = regexp.MustCompile(`(?i)(\+?\d[\d\-\s]{6,}|@[\w_]{3,}|https?://)`)

type PubIn struct {
	Kind         string `json:"kind" binding:"required"` // request|trip
	FromIATA     string `json:"from_iata" binding:"required,len=3"`
	ToIATA       string `json:"to_iata" binding:"required,len=3"`
	DateStart    string `json:"date_start"` // YYYY-MM-DD, required for request
	DateEnd      string `json:"date_end"`   // required for request
	Date         string `json:"date"`       // YYYY-MM-DD, required for trip
	Item         string `json:"item"`       // documents|small
	Weight       string `json:"weight"`     // envelope|le1kg|le3kg
	RewardHint   *int   `json:"reward_hint"`
	Description  string `json:"description"`
	FlightNo     string `json:"flight_no"`
	Airline      string `json:"airline"`
	CapacityHint string `json:"capacity_hint"`
}

func RegisterPublicationRoutes(g *gin.RouterGroup, pool *pgxpool.Pool) {
	g.POST("/publications", RateLimit(20), createPublication(pool))
	g.GET("/publications", listPublications(pool))
	g.GET("/publications/:id", getPublication(pool))
}

// RegisterPublicationAuthRoutes registers auth-required publication routes
func RegisterPublicationAuthRoutes(g *gin.RouterGroup, pool *pgxpool.Pool) {
	g.GET("/publications/mine", listMyPublications(pool))
	g.PATCH("/publications/:id", updatePublication(pool))
	g.POST("/publications/:id/request-contacts", requestContacts(pool))
}

func createPublication(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in PubIn
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверный json"})
			return
		}

		if contactsRe.MatchString(in.Description) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "контакты не разрешены в описании"})
			return
		}

		if len(in.Description) > 500 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "описание слишком длинное (≤500)"})
			return
		}

		if hasBannedItem(in.Description) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "предмет не разрешен политикой"})
			return
		}

		var ds, de time.Time
		var singleDate time.Time
		if in.Kind == "trip" {
			// For trips, use single date
			if in.Date == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "дата обязательна для поездки"})
				return
			}
			var err error
			singleDate, err = time.Parse("2006-01-02", in.Date)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "неверная дата"})
				return
			}
			// For trips, set date_start and date_end to the same date for compatibility
			ds = singleDate
			de = singleDate
		} else {
			// For requests, use date range
			if in.DateStart == "" || in.DateEnd == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "даты обязательны для запроса"})
				return
			}
			var err error
			ds, de, err = parseWindow(in.DateStart, in.DateEnd)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "неверные даты"})
				return
			}
			if de.Sub(ds) > 14*24*time.Hour || de.Before(ds) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "окно дат должно быть 1–14 дней"})
				return
			}
		}

		// Get user ID from context (set by WithUser middleware)
		userID, exists := c.Get(CtxDBUserID)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "user not authenticated"})
			return
		}
		uid := userID.(int64)

		// reject same user posting identical from/to/dates/desc in last 1h
		var dup int
		_ = pool.QueryRow(c, `
		  SELECT count(*) FROM publication
		  WHERE user_id=$1 AND is_active
		    AND from_iata=$2 AND to_iata=$3
		    AND date_start=$4 AND date_end=$5
		    AND coalesce(description,'')=$6
		    AND created_at > now() - interval '1 hour'
		`, uid, in.FromIATA, in.ToIATA, ds, de, in.Description).Scan(&dup)
		if dup > 0 {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "дубликат слишком скоро"})
			return
		}

		// enforce ≤5 active pubs per user
		var cnt int
		if err := pool.QueryRow(c, `SELECT count(*) FROM publication WHERE user_id=$1 AND is_active`, uid).Scan(&cnt); err == nil && cnt >= 5 {
			c.JSON(http.StatusForbidden, gin.H{"error": "лимит 5 активных публикаций"})
			return
		}

		var pubID int64
		var insertErr error
		if in.Kind == "trip" {
			// For trips, insert with date field
			insertErr = pool.QueryRow(c, `
			  INSERT INTO publication
			    (user_id,kind,from_iata,to_iata,date_start,date_end,date,item,weight,reward_hint,description,flight_no,airline,capacity_hint)
			  VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'documents')::item_type,COALESCE($9,'envelope')::weight_band,$10,$11,$12,$13,$14)
			  RETURNING id
			`, userID, in.Kind, in.FromIATA, in.ToIATA, ds, de, singleDate, in.Item, in.Weight, in.RewardHint, in.Description, in.FlightNo, in.Airline, in.CapacityHint).Scan(&pubID)
		} else {
			// For requests, insert without date field (it's NULL)
			insertErr = pool.QueryRow(c, `
			  INSERT INTO publication
			    (user_id,kind,from_iata,to_iata,date_start,date_end,date,item,weight,reward_hint,description,flight_no,airline,capacity_hint)
			  VALUES ($1,$2,$3,$4,$5,$6,NULL,COALESCE($7,'documents')::item_type,COALESCE($8,'envelope')::weight_band,$9,$10,$11,$12,$13)
			  RETURNING id
			`, userID, in.Kind, in.FromIATA, in.ToIATA, ds, de, in.Item, in.Weight, in.RewardHint, in.Description, in.FlightNo, in.Airline, in.CapacityHint).Scan(&pubID)
		}
		if insertErr != nil {
			log.Printf("[PUBLICATIONS] Insert error: %v", insertErr)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка вставки"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"id": pubID})
	}
}

func listPublications(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		from := c.Query("from")
		to := c.Query("to")
		kind := c.Query("kind") // optional

		qry := `
		  SELECT p.id, p.kind, p.from_iata, p.to_iata, p.date_start, p.date_end, p.date, p.item, p.weight, p.reward_hint, p.description,
		         COALESCE(u.rating_small, 0), COALESCE(u.tg_username, '')
		  FROM publication p
		  LEFT JOIN app_user u ON u.id = p.user_id
		  WHERE p.is_active AND p.from_iata=$1 AND p.to_iata=$2`
		args := []any{from, to}

		if kind != "" {
			qry += " AND p.kind = $3::pub_type"
			args = append(args, kind)
		}

		qry += " ORDER BY p.created_at DESC LIMIT 50"

		rows, err := pool.Query(c, qry, args...)
		if err != nil {
			log.Printf("[PUBLICATIONS] Database error: %v, query: %s, args: %v", err, qry, args)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка базы данных"})
			return
		}
		defer rows.Close()

		type Pub struct {
			ID          int64  `json:"id"`
			Kind        string `json:"kind"`
			From        string `json:"from_iata"`
			To          string `json:"to_iata"`
			DateStart   string `json:"date_start,omitempty"`
			DateEnd     string `json:"date_end,omitempty"`
			Date        string `json:"date,omitempty"`
			Item        string `json:"item"`
			Weight      string `json:"weight"`
			RewardHint  *int   `json:"reward_hint"`
			Description string `json:"description"`
			UserRating  int    `json:"user_rating"`
			Username    string `json:"username"`
		}

		out := []Pub{}

		for rows.Next() {
			var p Pub
			var ds, de sql.NullTime
			var singleDate sql.NullTime
			if err := rows.Scan(&p.ID, &p.Kind, &p.From, &p.To, &ds, &de, &singleDate, &p.Item, &p.Weight, &p.RewardHint, &p.Description, &p.UserRating, &p.Username); err != nil {
				log.Printf("[PUBLICATIONS] Scan error: %v", err)
				continue
			}
			if p.Kind == "trip" && singleDate.Valid {
				p.Date = singleDate.Time.Format("2006-01-02")
			} else if ds.Valid && de.Valid {
				p.DateStart = ds.Time.Format("2006-01-02")
				p.DateEnd = de.Time.Format("2006-01-02")
			}
			out = append(out, p)
		}

		if err := rows.Err(); err != nil {
			log.Printf("[PUBLICATIONS] Rows error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка базы данных"})
			return
		}

		c.JSON(http.StatusOK, out)
	}
}

func getPublication(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}

		type Pub struct {
			ID          int64  `json:"id"`
			Kind        string `json:"kind"`
			From        string `json:"from_iata"`
			To          string `json:"to_iata"`
			DateStart   string `json:"date_start,omitempty"`
			DateEnd     string `json:"date_end,omitempty"`
			Date        string `json:"date,omitempty"`
			Item        string `json:"item"`
			Weight      string `json:"weight"`
			RewardHint  *int   `json:"reward_hint"`
			Description string `json:"description"`
			UserRating  int    `json:"user_rating"`
			Username    string `json:"username"`
		}

		var p Pub
		var ds, de sql.NullTime
		var singleDate sql.NullTime
		err = pool.QueryRow(c, `
			SELECT p.id, p.kind, p.from_iata, p.to_iata, p.date_start, p.date_end, p.date, p.item, p.weight, p.reward_hint, p.description,
			       COALESCE(u.rating_small, 0), COALESCE(u.tg_username, '')
			FROM publication p
			LEFT JOIN app_user u ON u.id = p.user_id
			WHERE p.id=$1 AND p.is_active
		`, id).Scan(&p.ID, &p.Kind, &p.From, &p.To, &ds, &de, &singleDate, &p.Item, &p.Weight, &p.RewardHint, &p.Description, &p.UserRating, &p.Username)
		if err != nil {
			log.Printf("[PUBLICATIONS] getPublication error: %v, id: %d", err, id)
			c.JSON(http.StatusNotFound, gin.H{"error": "publication not found"})
			return
		}

		if p.Kind == "trip" && singleDate.Valid {
			p.Date = singleDate.Time.Format("2006-01-02")
		} else if ds.Valid && de.Valid {
			p.DateStart = ds.Time.Format("2006-01-02")
			p.DateEnd = de.Time.Format("2006-01-02")
		}
		c.JSON(http.StatusOK, p)
	}
}

func listMyPublications(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context (set by WithUser middleware)
		userID, exists := c.Get(CtxDBUserID)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}
		uid := userID.(int64)

		from := c.Query("from")
		to := c.Query("to")
		kind := c.Query("kind") // optional

		qry := `
		  SELECT p.id, p.kind, p.from_iata, p.to_iata, p.date_start, p.date_end, p.date, p.item, p.weight, p.reward_hint, p.description,
		         COALESCE(u.rating_small, 0), COALESCE(u.tg_username, ''), p.is_active
		  FROM publication p
		  LEFT JOIN app_user u ON u.id = p.user_id
		  WHERE p.user_id=$1`
		args := []any{uid}

		if from != "" && to != "" {
			qry += " AND p.from_iata=$2 AND p.to_iata=$3"
			args = append(args, from, to)
		}

		if kind != "" {
			idx := len(args) + 1
			qry += fmt.Sprintf(" AND p.kind = $%d::pub_type", idx)
			args = append(args, kind)
		}

		qry += " ORDER BY p.created_at DESC LIMIT 50"

		rows, err := pool.Query(c, qry, args...)
		if err != nil {
			log.Printf("[PUBLICATIONS] Database error: %v, query: %s, args: %v", err, qry, args)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка базы данных"})
			return
		}
		defer rows.Close()

		type Pub struct {
			ID          int64  `json:"id"`
			Kind        string `json:"kind"`
			From        string `json:"from_iata"`
			To          string `json:"to_iata"`
			DateStart   string `json:"date_start,omitempty"`
			DateEnd     string `json:"date_end,omitempty"`
			Date        string `json:"date,omitempty"`
			Item        string `json:"item"`
			Weight      string `json:"weight"`
			RewardHint  *int   `json:"reward_hint"`
			Description string `json:"description"`
			UserRating  int    `json:"user_rating"`
			Username    string `json:"username"`
			IsActive    bool   `json:"is_active"`
		}

		out := []Pub{}

		for rows.Next() {
			var p Pub
			var ds, de sql.NullTime
			var singleDate sql.NullTime
			if err := rows.Scan(&p.ID, &p.Kind, &p.From, &p.To, &ds, &de, &singleDate, &p.Item, &p.Weight, &p.RewardHint, &p.Description, &p.UserRating, &p.Username, &p.IsActive); err != nil {
				log.Printf("[PUBLICATIONS] Scan error: %v", err)
				continue
			}
			if p.Kind == "trip" && singleDate.Valid {
				p.Date = singleDate.Time.Format("2006-01-02")
			} else if ds.Valid && de.Valid {
				p.DateStart = ds.Time.Format("2006-01-02")
				p.DateEnd = de.Time.Format("2006-01-02")
			}
			out = append(out, p)
		}

		if err := rows.Err(); err != nil {
			log.Printf("[PUBLICATIONS] Rows error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка базы данных"})
			return
		}

		c.JSON(http.StatusOK, out)
	}
}

type UpdatePubIn struct {
	IsActive *bool `json:"is_active"` // optional, if provided updates is_active
}

func updatePublication(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context
		userID, exists := c.Get(CtxDBUserID)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}
		uid := userID.(int64)

		idStr := c.Param("id")
		pubID, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}

		// Verify publication belongs to user
		var ownerID int64
		err = pool.QueryRow(c, `SELECT user_id FROM publication WHERE id=$1`, pubID).Scan(&ownerID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "publication not found"})
			return
		}
		if ownerID != uid {
			c.JSON(http.StatusForbidden, gin.H{"error": "not your publication"})
			return
		}

		var in UpdatePubIn
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad json"})
			return
		}

		// Update is_active if provided
		if in.IsActive != nil {
			_, err = pool.Exec(c, `UPDATE publication SET is_active=$1 WHERE id=$2`, *in.IsActive, pubID)
			if err != nil {
				log.Printf("[PUBLICATIONS] Update error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка обновления"})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

func requestContacts(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context
		userID, exists := c.Get(CtxDBUserID)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}
		requesterUID := userID.(int64)

		// Get requester telegram user id for username
		var requesterTGID int64
		var requesterUsername string
		err := pool.QueryRow(c, `SELECT tg_user_id, COALESCE(tg_username, '') FROM app_user WHERE id=$1`, requesterUID).Scan(&requesterTGID, &requesterUsername)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "user not found"})
			return
		}

		idStr := c.Param("id")
		pubID, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}

		// Get publication owner info
		var ownerTGID int64
		var ownerUserID int64
		var pubKind string
		var fromIATA, toIATA string
		err = pool.QueryRow(c, `
			SELECT p.user_id, u.tg_user_id, p.kind, p.from_iata, p.to_iata
			FROM publication p
			JOIN app_user u ON u.id = p.user_id
			WHERE p.id=$1 AND p.is_active
		`, pubID).Scan(&ownerUserID, &ownerTGID, &pubKind, &fromIATA, &toIATA)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "publication not found"})
			return
		}

		// Don't allow requesting own publication
		if ownerUserID == requesterUID {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot request contacts for own publication"})
			return
		}

		// Check if request already exists
		var existingID int64
		err = pool.QueryRow(c, `
			SELECT id FROM contact_request
			WHERE publication_id=$1 AND requester_user_id=$2
		`, pubID, requesterUID).Scan(&existingID)
		if err == nil {
			// Request already exists, check status
			var status string
			_ = pool.QueryRow(c, `SELECT status FROM contact_request WHERE id=$1`, existingID).Scan(&status)
			if status == "agreed" {
				c.JSON(http.StatusOK, gin.H{"ok": true, "message": "contacts already shared"})
				return
			}
			// If pending, just return success
			c.JSON(http.StatusOK, gin.H{"ok": true})
			return
		}

		// Create contact request
		var contactRequestID int64
		err = pool.QueryRow(c, `
			INSERT INTO contact_request (publication_id, requester_user_id, status)
			VALUES ($1, $2, 'pending')
			RETURNING id
		`, pubID, requesterUID).Scan(&contactRequestID)
		if err != nil {
			log.Printf("[PUBLICATIONS] Contact request insert error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create request"})
			return
		}

		// Send notification to publication owner via bot
		tg := bot.New()
		usernameText := requesterUsername
		if usernameText == "" {
			usernameText = "пользователь"
		} else {
			usernameText = "@" + usernameText
		}

		messageText := fmt.Sprintf("Ваши контакты были отправлены юзеру %s", usernameText)

		// Create inline keyboard with buttons
		keyboard := gin.H{
			"inline_keyboard": [][]gin.H{
				{
					{
						"text":          "✅ Договорились",
						"callback_data": fmt.Sprintf("contact_agreed:%d", contactRequestID),
					},
					{
						"text":          "❌ Не договорились",
						"callback_data": fmt.Sprintf("contact_declined:%d", contactRequestID),
					},
				},
			},
		}

		_, _ = tg.API("sendMessage", gin.H{
			"chat_id":      ownerTGID,
			"text":         messageText,
			"reply_markup": keyboard,
		})

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

func parseWindow(a, b string) (time.Time, time.Time, error) {
	ds, err := time.Parse("2006-01-02", a)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	de, err := time.Parse("2006-01-02", b)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	return ds, de, nil
}
