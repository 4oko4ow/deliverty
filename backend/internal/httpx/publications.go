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
	g.GET("/publications/popular-routes", getPopularRoutes(pool))
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

		// Build query with city-based matching
		// Match publications where from_iata/to_iata are in the same city as the search airports
		qry := `
		  SELECT p.id, p.kind, p.from_iata, p.to_iata, p.date_start, p.date_end, p.date, p.item, p.weight, p.reward_hint, p.description,
		         COALESCE(u.rating_small, 0), COALESCE(u.tg_username, '')
		  FROM publication p
		  LEFT JOIN app_user u ON u.id = p.user_id
		  LEFT JOIN airport a_from ON a_from.iata = p.from_iata
		  LEFT JOIN airport a_to ON a_to.iata = p.to_iata
		  LEFT JOIN airport a_from_search ON a_from_search.iata = $1
		  LEFT JOIN airport a_to_search ON a_to_search.iata = $2
		  WHERE p.is_active
		    AND (
		      -- Match by exact IATA or by city
		      a_from.iata = $1 OR (a_from.city IS NOT NULL AND a_from.city = a_from_search.city)
		    )
		    AND (
		      -- Match by exact IATA or by city
		      a_to.iata = $2 OR (a_to.city IS NOT NULL AND a_to.city = a_to_search.city)
		    )`
		args := []any{from, to}

		if kind != "" {
			qry += " AND p.kind = $3::pub_type"
			args = append(args, kind)
		}

		// Sort by date proximity: closer dates first
		// For trips: use date field, for requests: use date_start
		// Use ABS to get distance from current date, then sort ascending (closer = smaller difference)
		qry += `
		  ORDER BY 
		    CASE 
		      WHEN p.kind = 'trip' AND p.date IS NOT NULL THEN ABS(EXTRACT(EPOCH FROM (p.date - CURRENT_DATE) * INTERVAL '1 day'))
		      WHEN p.kind = 'request' AND p.date_start IS NOT NULL THEN ABS(EXTRACT(EPOCH FROM (p.date_start - CURRENT_DATE) * INTERVAL '1 day'))
		      ELSE 999999999
		    END ASC,
		    p.created_at DESC
		  LIMIT 50`

		rows, err := pool.Query(c, qry, args...)
		if err != nil {
			log.Printf("[PUBLICATIONS] Database error: %v", err)
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
			// Support city-based matching for my publications search
			qry += `
			  AND EXISTS (
			    SELECT 1 FROM airport a_from, airport a_from_search
			    WHERE a_from.iata = p.from_iata 
			      AND a_from_search.iata = $2
			      AND (a_from.iata = $2 OR (a_from.city IS NOT NULL AND a_from.city = a_from_search.city))
			  )
			  AND EXISTS (
			    SELECT 1 FROM airport a_to, airport a_to_search
			    WHERE a_to.iata = p.to_iata
			      AND a_to_search.iata = $3
			      AND (a_to.iata = $3 OR (a_to.city IS NOT NULL AND a_to.city = a_to_search.city))
			  )`
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
			log.Printf("[PUBLICATIONS] Database error: %v", err)
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
		var ownerUsername string
		var pubKind string
		var fromIATA, toIATA string
		err = pool.QueryRow(c, `
			SELECT p.user_id, u.tg_user_id, COALESCE(u.tg_username, ''), p.kind, p.from_iata, p.to_iata
			FROM publication p
			JOIN app_user u ON u.id = p.user_id
			WHERE p.id=$1 AND p.is_active
		`, pubID).Scan(&ownerUserID, &ownerTGID, &ownerUsername, &pubKind, &fromIATA, &toIATA)
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
		var contactRequestID int64
		err = pool.QueryRow(c, `
			SELECT id FROM contact_request
			WHERE publication_id=$1 AND requester_user_id=$2
		`, pubID, requesterUID).Scan(&existingID)
		if err == nil {
			// Request already exists
			contactRequestID = existingID
		} else {
			// Create new contact request
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
		}

		// Get publication details for notifications
		var pubFrom, pubTo, pubDescription string
		var pubItem, pubWeight string
		var pubDate sql.NullTime
		var pubDateStart, pubDateEnd sql.NullTime
		err = pool.QueryRow(c, `
			SELECT from_iata, to_iata, description, item, weight, date, date_start, date_end
			FROM publication WHERE id=$1
		`, pubID).Scan(&pubFrom, &pubTo, &pubDescription, &pubItem, &pubWeight, &pubDate, &pubDateStart, &pubDateEnd)
		if err != nil {
			log.Printf("[PUBLICATIONS] Failed to get publication details: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get publication details"})
			return
		}

		// Format publication date
		var dateStr string
		if pubKind == "trip" && pubDate.Valid {
			dateStr = pubDate.Time.Format("02.01.2006")
		} else if pubDateStart.Valid && pubDateEnd.Valid {
			dateStr = fmt.Sprintf("%s - %s", pubDateStart.Time.Format("02.01.2006"), pubDateEnd.Time.Format("02.01.2006"))
		}

		// Format item and weight
		itemText := "Документы"
		if pubItem == "small" {
			itemText = "Мелкие вещи"
		}
		weightText := "Конверт"
		if pubWeight == "le1kg" {
			weightText = "До 1 кг"
		} else if pubWeight == "le3kg" {
			weightText = "До 3 кг"
		}

		tg := bot.New()

		// Send notification to requester with owner's contact and publication info
		requesterUsernameText := requesterUsername
		if requesterUsernameText == "" {
			requesterUsernameText = "пользователь"
		} else {
			requesterUsernameText = "@" + requesterUsernameText
		}

		ownerUsernameText := ownerUsername
		if ownerUsernameText == "" {
			ownerUsernameText = "пользователь"
		} else {
			ownerUsernameText = "@" + ownerUsernameText
		}

		// Message to requester - always send info about publication and owner contacts
		requesterMsg := fmt.Sprintf("📋 Информация об объявлении:\n\n")
		requesterMsg += fmt.Sprintf("📍 Маршрут: %s → %s\n", pubFrom, pubTo)
		requesterMsg += fmt.Sprintf("📅 Дата: %s\n", dateStr)
		requesterMsg += fmt.Sprintf("📦 Тип: %s, %s\n", itemText, weightText)
		if pubDescription != "" {
			requesterMsg += fmt.Sprintf("📝 Описание: %s\n\n", pubDescription)
		}
		requesterMsg += fmt.Sprintf("👤 Контакты создателя:\n")
		if ownerUsername != "" {
			requesterMsg += fmt.Sprintf("Telegram: @%s\n", ownerUsername)
			requesterMsg += fmt.Sprintf("Ссылка: https://t.me/%s", ownerUsername)
		} else if ownerTGID != 0 {
			requesterMsg += fmt.Sprintf("ID: %d\n", ownerTGID)
			requesterMsg += fmt.Sprintf("Ссылка: tg://user?id=%d", ownerTGID)
		} else {
			requesterMsg += "Контакты не указаны (пользователь не указал username в Telegram)"
		}

		if requesterTGID != 0 {
			_, err := tg.API("sendMessage", gin.H{
				"chat_id": requesterTGID,
				"text":    requesterMsg,
			})
			if err != nil {
				log.Printf("[PUBLICATIONS] Failed to send message to requester: %v", err)
			}
		}

		// Message to publication owner - always send info about requester
		ownerMsg := fmt.Sprintf("📋 Кто-то запросил контакты к вашему объявлению:\n\n")
		ownerMsg += fmt.Sprintf("📍 Маршрут: %s → %s\n", pubFrom, pubTo)
		ownerMsg += fmt.Sprintf("📅 Дата: %s\n", dateStr)
		ownerMsg += fmt.Sprintf("📦 Тип: %s, %s\n", itemText, weightText)
		if pubDescription != "" {
			ownerMsg += fmt.Sprintf("📝 Описание: %s\n\n", pubDescription)
		}
		ownerMsg += fmt.Sprintf("👤 Контакты запросившего:\n")
		if requesterUsername != "" {
			ownerMsg += fmt.Sprintf("Telegram: @%s\n", requesterUsername)
			ownerMsg += fmt.Sprintf("Ссылка: https://t.me/%s", requesterUsername)
		} else if requesterTGID != 0 {
			ownerMsg += fmt.Sprintf("ID: %d\n", requesterTGID)
			ownerMsg += fmt.Sprintf("Ссылка: tg://user?id=%d", requesterTGID)
		} else {
			ownerMsg += "Контакты не указаны (пользователь не указал username в Telegram)"
		}

		// Create inline keyboard with buttons (only if request is pending)
		var keyboard gin.H
		var status string
		_ = pool.QueryRow(c, `SELECT status FROM contact_request WHERE id=$1`, contactRequestID).Scan(&status)
		if status == "pending" {
			keyboard = gin.H{
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
		}

		if ownerTGID != 0 {
			msgParams := gin.H{
				"chat_id": ownerTGID,
				"text":    ownerMsg,
			}
			if keyboard != nil {
				msgParams["reply_markup"] = keyboard
			}
			_, err := tg.API("sendMessage", msgParams)
			if err != nil {
				log.Printf("[PUBLICATIONS] Failed to send message to owner: %v", err)
			}
		}

		// Return owner's contact info to requester
		c.JSON(http.StatusOK, gin.H{
			"ok":         true,
			"username":   ownerUsername,
			"tg_user_id": ownerTGID,
		})
	}
}

func getPopularRoutes(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get popular routes with count of active publications
		// Group by from_iata and to_iata, count publications
		// Order by count descending, limit to top 10
		qry := `
		  SELECT 
		    p.from_iata,
		    p.to_iata,
		    COUNT(*) as count,
		    COALESCE(a_from.city_ru, a_from.city, a_from.name) as from_city,
		    COALESCE(a_to.city_ru, a_to.city, a_to.name) as to_city
		  FROM publication p
		  LEFT JOIN airport a_from ON a_from.iata = p.from_iata
		  LEFT JOIN airport a_to ON a_to.iata = p.to_iata
		  WHERE p.is_active
		  GROUP BY p.from_iata, p.to_iata, a_from.city_ru, a_from.city, a_from.name, a_to.city_ru, a_to.city, a_to.name
		  HAVING COUNT(*) > 0
		  ORDER BY count DESC
		  LIMIT 10`

		rows, err := pool.Query(c, qry)
		if err != nil {
			log.Printf("[PUBLICATIONS] Popular routes query error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка базы данных"})
			return
		}
		defer rows.Close()

		type Route struct {
			FromIATA string `json:"from_iata"`
			ToIATA   string `json:"to_iata"`
			Count    int    `json:"count"`
			FromCity string `json:"from_city"`
			ToCity   string `json:"to_city"`
		}

		out := []Route{}

		for rows.Next() {
			var r Route
			if err := rows.Scan(&r.FromIATA, &r.ToIATA, &r.Count, &r.FromCity, &r.ToCity); err != nil {
				log.Printf("[PUBLICATIONS] Popular routes scan error: %v", err)
				continue
			}
			out = append(out, r)
		}

		if err := rows.Err(); err != nil {
			log.Printf("[PUBLICATIONS] Popular routes rows error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка базы данных"})
			return
		}

		c.JSON(http.StatusOK, out)
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
