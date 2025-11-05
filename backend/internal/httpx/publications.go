package httpx

import (
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

var contactsRe = regexp.MustCompile(`(?i)(\+?\d[\d\-\s]{6,}|@[\w_]{3,}|https?://)`)

type PubIn struct {
	Kind         string `json:"kind" binding:"required"` // request|trip
	FromIATA     string `json:"from_iata" binding:"required,len=3"`
	ToIATA       string `json:"to_iata" binding:"required,len=3"`
	DateStart    string `json:"date_start" binding:"required"` // YYYY-MM-DD
	DateEnd      string `json:"date_end" binding:"required"`
	Item         string `json:"item"`   // documents|small
	Weight       string `json:"weight"` // envelope|le1kg|le3kg
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

		ds, de, err := parseWindow(in.DateStart, in.DateEnd)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверные даты"})
			return
		}

		if de.Sub(ds) > 14*24*time.Hour || de.Before(ds) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "окно дат должно быть 1–14 дней"})
			return
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
		err = pool.QueryRow(c, `
		  INSERT INTO publication
		    (user_id,kind,from_iata,to_iata,date_start,date_end,item,weight,reward_hint,description,flight_no,airline,capacity_hint)
		  VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'documents')::item_type,COALESCE($8,'envelope')::weight_band,$9,$10,$11,$12,$13)
		  RETURNING id
		`, userID, in.Kind, in.FromIATA, in.ToIATA, ds, de, in.Item, in.Weight, in.RewardHint, in.Description, in.FlightNo, in.Airline, in.CapacityHint).Scan(&pubID)
		if err != nil {
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
		  SELECT p.id, p.kind, p.from_iata, p.to_iata, p.date_start, p.date_end, p.item, p.weight, p.reward_hint, p.description,
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
			DateStart   string `json:"date_start"`
			DateEnd     string `json:"date_end"`
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
			var ds, de time.Time
			if err := rows.Scan(&p.ID, &p.Kind, &p.From, &p.To, &ds, &de, &p.Item, &p.Weight, &p.RewardHint, &p.Description, &p.UserRating, &p.Username); err != nil {
				log.Printf("[PUBLICATIONS] Scan error: %v", err)
				continue
			}
			p.DateStart = ds.Format("2006-01-02")
			p.DateEnd = de.Format("2006-01-02")
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
			DateStart   string `json:"date_start"`
			DateEnd     string `json:"date_end"`
			Item        string `json:"item"`
			Weight      string `json:"weight"`
			RewardHint  *int   `json:"reward_hint"`
			Description string `json:"description"`
			UserRating  int    `json:"user_rating"`
			Username    string `json:"username"`
		}

		var p Pub
		var ds, de time.Time
		err = pool.QueryRow(c, `
			SELECT p.id, p.kind, p.from_iata, p.to_iata, p.date_start, p.date_end, p.item, p.weight, p.reward_hint, p.description,
			       COALESCE(u.rating_small, 0), COALESCE(u.tg_username, '')
			FROM publication p
			LEFT JOIN app_user u ON u.id = p.user_id
			WHERE p.id=$1 AND p.is_active
		`, id).Scan(&p.ID, &p.Kind, &p.From, &p.To, &ds, &de, &p.Item, &p.Weight, &p.RewardHint, &p.Description, &p.UserRating, &p.Username)
		if err != nil {
			log.Printf("[PUBLICATIONS] getPublication error: %v, id: %d", err, id)
			c.JSON(http.StatusNotFound, gin.H{"error": "publication not found"})
			return
		}

		p.DateStart = ds.Format("2006-01-02")
		p.DateEnd = de.Format("2006-01-02")
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
		  SELECT p.id, p.kind, p.from_iata, p.to_iata, p.date_start, p.date_end, p.item, p.weight, p.reward_hint, p.description,
		         COALESCE(u.rating_small, 0), COALESCE(u.tg_username, '')
		  FROM publication p
		  LEFT JOIN app_user u ON u.id = p.user_id
		  WHERE p.is_active AND p.user_id=$1`
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
			DateStart   string `json:"date_start"`
			DateEnd     string `json:"date_end"`
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
			var ds, de time.Time
			if err := rows.Scan(&p.ID, &p.Kind, &p.From, &p.To, &ds, &de, &p.Item, &p.Weight, &p.RewardHint, &p.Description, &p.UserRating, &p.Username); err != nil {
				log.Printf("[PUBLICATIONS] Scan error: %v", err)
				continue
			}
			p.DateStart = ds.Format("2006-01-02")
			p.DateEnd = de.Format("2006-01-02")
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
