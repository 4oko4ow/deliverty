package httpx

import (
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/binary"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sol/deliverty/backend/internal/bot"
	"github.com/sol/deliverty/backend/internal/match"
)

// isAdminUser проверяет, является ли пользователь админом по tg_user_id
func isAdminUser(tgUserID int64) bool {
	adminUsersStr := os.Getenv("ADMIN_USER_IDS")
	if adminUsersStr == "" {
		return false
	}

	// Разбираем список ID (через запятую)
	ids := strings.Split(adminUsersStr, ",")
	for _, idStr := range ids {
		idStr = strings.TrimSpace(idStr)
		if idStr == "" {
			continue
		}
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			log.Printf("[ADMIN] Invalid admin user ID in config: %s", idStr)
			continue
		}
		if id == tgUserID {
			return true
		}
	}
	return false
}

// WithAdmin проверяет наличие и валидность админ-ключа в заголовке X-Admin-Key
// ИЛИ проверяет, является ли пользователь админом по tg_user_id
func WithAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Проверка 1: Админ-ключ в заголовке
		adminKey := c.GetHeader("X-Admin-Key")
		expectedKey := os.Getenv("ADMIN_SECRET_KEY")

		if adminKey != "" && expectedKey != "" && adminKey == expectedKey {
			c.Next()
			return
		}

		// Проверка 2: Админ-пользователь по tg_user_id
		raw := c.GetHeader("X-TG-User-ID")
		if raw != "" {
			tgUserID, err := strconv.ParseInt(raw, 10, 64)
			if err == nil && isAdminUser(tgUserID) {
				c.Next()
				return
			}
		}

		// Если ни одна проверка не прошла
		if expectedKey == "" && os.Getenv("ADMIN_USER_IDS") == "" {
			log.Printf("[ADMIN] Admin access not configured")
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access not configured"})
			return
		}

		log.Printf("[ADMIN] Access denied from %s", c.ClientIP())
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "access denied"})
	}
}

// AdminPubIn расширенная структура для админ-создания публикаций
// Позволяет указать пользователя, от имени которого создается публикация
type AdminPubIn struct {
	PubIn
	// Один из этих полей должен быть указан для определения пользователя
	TgUserID   *int64  `json:"tg_user_id"`  // Telegram user ID
	TgUsername *string `json:"tg_username"` // Telegram username (без @)
}

// createAdminPublication создает публикацию от имени указанного пользователя
// Обходит ограничения (5 активных публикаций, проверка дубликатов)
func createAdminPublication(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in AdminPubIn
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверный json"})
			return
		}

		// Проверка обязательных полей для публикации
		if in.Kind == "" || in.FromIATA == "" || in.ToIATA == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kind, from_iata, to_iata обязательны"})
			return
		}

		// Проверка, что указан хотя бы один способ идентификации пользователя
		if in.TgUserID == nil && (in.TgUsername == nil || *in.TgUsername == "") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "необходимо указать tg_user_id или tg_username"})
			return
		}

		// Валидация описания (если указано)
		if in.Description != "" {
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
		}

		// Парсинг дат
		var ds, de time.Time
		var singleDate time.Time
		if in.Kind == "trip" {
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
			ds = singleDate
			de = singleDate
		} else {
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

		// Найти или создать пользователя
		var userID int64
		var err error

		if in.TgUserID != nil {
			// Поиск/создание по tg_user_id
			err = pool.QueryRow(c, `
				INSERT INTO app_user (tg_user_id, tg_username)
				VALUES ($1, COALESCE($2, ''))
				ON CONFLICT (tg_user_id) 
				DO UPDATE SET tg_username = COALESCE(EXCLUDED.tg_username, app_user.tg_username)
				RETURNING id
			`, *in.TgUserID, in.TgUsername).Scan(&userID)
		} else if in.TgUsername != nil && *in.TgUsername != "" {
			// Поиск по username
			var foundTgUserID int64
			err = pool.QueryRow(c, `
				SELECT id, tg_user_id FROM app_user WHERE tg_username = $1
			`, *in.TgUsername).Scan(&userID, &foundTgUserID)

			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					// Пользователь не найден - создаем нового с сгенерированным отрицательным tg_user_id
					// Генерируем уникальный отрицательный ID на основе username (MD5 хеш)
					log.Printf("[ADMIN] User with username %s not found, creating placeholder user", *in.TgUsername)

					hash := md5.Sum([]byte("external_user:" + *in.TgUsername))
					// Берем первые 8 байт хеша и делаем отрицательным числом
					tempTgID := -int64(binary.BigEndian.Uint64(hash[:8]))
					// Убеждаемся, что число отрицательное (если получилось положительное, инвертируем)
					if tempTgID > 0 {
						tempTgID = -tempTgID
					}

					err = pool.QueryRow(c, `
						INSERT INTO app_user (tg_user_id, tg_username)
						VALUES ($1, $2)
						ON CONFLICT (tg_user_id) 
						DO UPDATE SET tg_username = EXCLUDED.tg_username
						RETURNING id
					`, tempTgID, *in.TgUsername).Scan(&userID)
				}
				// Если ошибка не ErrNoRows, она будет обработана ниже
			}
		}

		if err != nil {
			log.Printf("[ADMIN] Failed to find/create user: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка создания/поиска пользователя"})
			return
		}

		// Создание публикации (без ограничений на количество активных публикаций и дубликаты)
		var pubID int64
		var insertErr error
		if in.Kind == "trip" {
			insertErr = pool.QueryRow(c, `
				INSERT INTO publication
					(user_id, kind, from_iata, to_iata, date_start, date_end, date, item, weight, reward_hint, description, flight_no, airline, capacity_hint)
				VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'documents')::item_type, COALESCE($9, 'envelope')::weight_band, $10, $11, $12, $13, $14)
				RETURNING id
			`, userID, in.Kind, in.FromIATA, in.ToIATA, ds, de, singleDate, in.Item, in.Weight, in.RewardHint, in.Description, in.FlightNo, in.Airline, in.CapacityHint).Scan(&pubID)
		} else {
			insertErr = pool.QueryRow(c, `
				INSERT INTO publication
					(user_id, kind, from_iata, to_iata, date_start, date_end, date, item, weight, reward_hint, description, flight_no, airline, capacity_hint)
				VALUES ($1, $2, $3, $4, $5, $6, NULL, COALESCE($7, 'documents')::item_type, COALESCE($8, 'envelope')::weight_band, $9, $10, $11, $12, $13)
				RETURNING id
			`, userID, in.Kind, in.FromIATA, in.ToIATA, ds, de, in.Item, in.Weight, in.RewardHint, in.Description, in.FlightNo, in.Airline, in.CapacityHint).Scan(&pubID)
		}

		if insertErr != nil {
			log.Printf("[ADMIN] Insert error: %v", insertErr)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка вставки"})
			return
		}

		log.Printf("[ADMIN] Created publication %d for user %d (tg_user_id: %v, username: %v)",
			pubID, userID, in.TgUserID, in.TgUsername)

		c.JSON(http.StatusOK, gin.H{
			"id":      pubID,
			"user_id": userID,
			"message": "публикация создана",
		})
	}
}

// listAdminPublications возвращает список всех публикаций с фильтрами
func listAdminPublications(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		kind := c.Query("kind")             // request | trip | "" (all)
		from := c.Query("from")             // IATA code
		to := c.Query("to")                 // IATA code
		isActiveStr := c.Query("is_active") // true | false | "" (all)
		limitStr := c.Query("limit")
		limit := 100
		if limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 500 {
				limit = l
			}
		}

		qry := `
			SELECT p.id, p.kind, p.from_iata, p.to_iata, p.date_start, p.date_end, p.date, 
			       p.item, p.weight, p.reward_hint, p.description, p.flight_no, p.airline, 
			       p.capacity_hint, p.is_active, p.created_at,
			       u.id as user_id, u.tg_user_id, COALESCE(u.tg_username, '') as tg_username, 
			       COALESCE(u.rating_small, 0) as rating,
			       COALESCE(deal_count.count, 0) as deal_count,
			       COALESCE(possible_matches.count, 0) as possible_matches_count
			FROM publication p
			JOIN app_user u ON u.id = p.user_id
			LEFT JOIN (
				SELECT pub_id, COUNT(*) as count
				FROM (
					SELECT request_pub_id as pub_id FROM deal WHERE status != 'cancelled'
					UNION ALL
					SELECT trip_pub_id as pub_id FROM deal WHERE status != 'cancelled'
				) all_deals
				GROUP BY pub_id
			) deal_count ON deal_count.pub_id = p.id
			LEFT JOIN (
				SELECT 
					p1.id as pub_id,
					COUNT(DISTINCT p2.id) as count
				FROM publication p1
				JOIN publication p2 ON (
					p1.kind != p2.kind 
					AND p1.is_active 
					AND p2.is_active
					AND p1.id != p2.id
					AND (
						(p1.from_iata = p2.from_iata) OR 
						EXISTS (
							SELECT 1 FROM airport a1, airport a2 
							WHERE a1.iata = p1.from_iata 
							AND a2.iata = p2.from_iata 
							AND a1.city IS NOT NULL 
							AND a2.city IS NOT NULL 
							AND a1.city = a2.city
						)
					)
					AND (
						(p1.to_iata = p2.to_iata) OR 
						EXISTS (
							SELECT 1 FROM airport a1, airport a2 
							WHERE a1.iata = p1.to_iata 
							AND a2.iata = p2.to_iata 
							AND a1.city IS NOT NULL 
							AND a2.city IS NOT NULL 
							AND a1.city = a2.city
						)
					)
					AND (
						(p1.kind = 'trip' AND p1.date IS NOT NULL AND p2.date_start IS NOT NULL AND p2.date_end IS NOT NULL
							AND p1.date >= p2.date_start - INTERVAL '3 days' 
							AND p1.date <= p2.date_end + INTERVAL '3 days'
							AND NOT (p1.date >= p2.date_start AND p1.date <= p2.date_end))
						OR
						(p1.kind = 'request' AND p1.date_start IS NOT NULL AND p1.date_end IS NOT NULL AND p2.date IS NOT NULL
							AND p2.date >= p1.date_start - INTERVAL '3 days' 
							AND p2.date <= p1.date_end + INTERVAL '3 days'
							AND NOT (p2.date >= p1.date_start AND p2.date <= p1.date_end))
					)
					AND NOT EXISTS (
						SELECT 1 FROM deal d 
						WHERE (d.request_pub_id = p1.id AND d.trip_pub_id = p2.id)
						   OR (d.request_pub_id = p2.id AND d.trip_pub_id = p1.id)
					)
				)
				WHERE p1.is_active
				GROUP BY p1.id
			) possible_matches ON possible_matches.pub_id = p.id
			WHERE 1=1`
		args := []any{}
		argIdx := 1

		if kind != "" {
			qry += fmt.Sprintf(" AND p.kind = $%d::pub_type", argIdx)
			args = append(args, kind)
			argIdx++
		}

		if from != "" {
			qry += fmt.Sprintf(" AND p.from_iata = $%d", argIdx)
			args = append(args, from)
			argIdx++
		}

		if to != "" {
			qry += fmt.Sprintf(" AND p.to_iata = $%d", argIdx)
			args = append(args, to)
			argIdx++
		}

		if isActiveStr != "" {
			isActive := isActiveStr == "true"
			qry += fmt.Sprintf(" AND p.is_active = $%d", argIdx)
			args = append(args, isActive)
			argIdx++
		}

		qry += " ORDER BY p.created_at DESC"
		qry += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, limit)

		rows, err := pool.Query(c, qry, args...)
		if err != nil {
			log.Printf("[ADMIN] List publications error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка базы данных"})
			return
		}
		defer rows.Close()

		type Pub struct {
			ID                   int64   `json:"id"`
			Kind                 string  `json:"kind"`
			From                 string  `json:"from_iata"`
			To                   string  `json:"to_iata"`
			DateStart            *string `json:"date_start,omitempty"`
			DateEnd              *string `json:"date_end,omitempty"`
			Date                 *string `json:"date,omitempty"`
			Item                 string  `json:"item"`
			Weight               string  `json:"weight"`
			RewardHint           *int    `json:"reward_hint,omitempty"`
			Description          string  `json:"description"`
			FlightNo             *string `json:"flight_no,omitempty"`
			Airline              *string `json:"airline,omitempty"`
			CapacityHint         *string `json:"capacity_hint,omitempty"`
			IsActive             bool    `json:"is_active"`
			CreatedAt            string  `json:"created_at"`
			UserID               int64   `json:"user_id"`
			TgUserID             int64   `json:"tg_user_id"`
			TgUsername           string  `json:"tg_username"`
			UserRating           int     `json:"user_rating"`
			DealCount            int     `json:"deal_count"`
			PossibleMatchesCount int     `json:"possible_matches_count"`
		}

		out := []Pub{}

		for rows.Next() {
			var p Pub
			var ds, de sql.NullTime
			var singleDate sql.NullTime
			var createdAt time.Time

			err := rows.Scan(&p.ID, &p.Kind, &p.From, &p.To, &ds, &de, &singleDate,
				&p.Item, &p.Weight, &p.RewardHint, &p.Description, &p.FlightNo, &p.Airline,
				&p.CapacityHint, &p.IsActive, &createdAt,
				&p.UserID, &p.TgUserID, &p.TgUsername, &p.UserRating,
				&p.DealCount, &p.PossibleMatchesCount)
			if err != nil {
				log.Printf("[ADMIN] Scan error: %v", err)
				continue
			}

			if p.Kind == "trip" && singleDate.Valid {
				dateStr := singleDate.Time.Format("2006-01-02")
				p.Date = &dateStr
			} else if ds.Valid && de.Valid {
				dsStr := ds.Time.Format("2006-01-02")
				deStr := de.Time.Format("2006-01-02")
				p.DateStart = &dsStr
				p.DateEnd = &deStr
			}

			p.CreatedAt = createdAt.Format(time.RFC3339)
			out = append(out, p)
		}

		c.JSON(http.StatusOK, out)
	}
}

// getAdminPublication возвращает детали публикации
func getAdminPublication(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверный идентификатор"})
			return
		}

		type Pub struct {
			ID           int64   `json:"id"`
			Kind         string  `json:"kind"`
			From         string  `json:"from_iata"`
			To           string  `json:"to_iata"`
			DateStart    *string `json:"date_start,omitempty"`
			DateEnd      *string `json:"date_end,omitempty"`
			Date         *string `json:"date,omitempty"`
			Item         string  `json:"item"`
			Weight       string  `json:"weight"`
			RewardHint   *int    `json:"reward_hint,omitempty"`
			Description  string  `json:"description"`
			FlightNo     *string `json:"flight_no,omitempty"`
			Airline      *string `json:"airline,omitempty"`
			CapacityHint *string `json:"capacity_hint,omitempty"`
			IsActive     bool    `json:"is_active"`
			CreatedAt    string  `json:"created_at"`
			UserID       int64   `json:"user_id"`
			TgUserID     int64   `json:"tg_user_id"`
			TgUsername   string  `json:"tg_username"`
			UserRating   int     `json:"user_rating"`
		}

		var p Pub
		var ds, de sql.NullTime
		var singleDate sql.NullTime
		var createdAt time.Time

		err = pool.QueryRow(c, `
			SELECT p.id, p.kind, p.from_iata, p.to_iata, p.date_start, p.date_end, p.date,
			       p.item, p.weight, p.reward_hint, p.description, p.flight_no, p.airline,
			       p.capacity_hint, p.is_active, p.created_at,
			       u.id as user_id, u.tg_user_id, COALESCE(u.tg_username, '') as tg_username,
			       COALESCE(u.rating_small, 0) as rating
			FROM publication p
			JOIN app_user u ON u.id = p.user_id
			WHERE p.id = $1
		`, id).Scan(&p.ID, &p.Kind, &p.From, &p.To, &ds, &de, &singleDate,
			&p.Item, &p.Weight, &p.RewardHint, &p.Description, &p.FlightNo, &p.Airline,
			&p.CapacityHint, &p.IsActive, &createdAt,
			&p.UserID, &p.TgUserID, &p.TgUsername, &p.UserRating)

		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusNotFound, gin.H{"error": "публикация не найдена"})
				return
			}
			log.Printf("[ADMIN] Get publication error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка базы данных"})
			return
		}

		if p.Kind == "trip" && singleDate.Valid {
			dateStr := singleDate.Time.Format("2006-01-02")
			p.Date = &dateStr
		} else if ds.Valid && de.Valid {
			dsStr := ds.Time.Format("2006-01-02")
			deStr := de.Time.Format("2006-01-02")
			p.DateStart = &dsStr
			p.DateEnd = &deStr
		}

		p.CreatedAt = createdAt.Format(time.RFC3339)
		c.JSON(http.StatusOK, p)
	}
}

// createAdminDeal создает сделку вручную (для менеджера)
func createAdminDeal(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in DealIn
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверный формат данных"})
			return
		}

		// Verify kinds
		var k1, k2 string
		if err := pool.QueryRow(c, `SELECT kind FROM publication WHERE id=$1`, in.RequestPubID).Scan(&k1); err != nil || k1 != "request" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверное объявление запроса"})
			return
		}

		if err := pool.QueryRow(c, `SELECT kind FROM publication WHERE id=$1`, in.TripPubID).Scan(&k2); err != nil || k2 != "trip" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверное объявление поездки"})
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
			log.Printf("[ADMIN] Create deal error: %v", err)
			c.JSON(http.StatusConflict, gin.H{"error": "не удалось создать сделку"})
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
				log.Printf("[ADMIN] Failed to get participants for deal %d: %v", dealID, err)
				return
			}

			botName := os.Getenv("TG_BOT_NAME")
			if botName == "" {
				log.Printf("[ADMIN] TG_BOT_NAME not set, cannot generate deep-link")
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

			if reqTG != 0 {
				_, err := tg.API("sendMessage", gin.H{
					"chat_id":      reqTG,
					"text":         msgToReq,
					"reply_markup": keyboard,
				})
				if err != nil {
					log.Printf("[ADMIN] Failed to send message to request user %d: %v", reqTG, err)
				}
			}
			if tripTG != 0 && tripTG != reqTG {
				_, err := tg.API("sendMessage", gin.H{
					"chat_id":      tripTG,
					"text":         msgToTrip,
					"reply_markup": keyboard,
				})
				if err != nil {
					log.Printf("[ADMIN] Failed to send message to trip user %d: %v", tripTG, err)
				}
			}
		}()

		c.JSON(http.StatusOK, gin.H{"id": dealID})
	}
}

// listAdminDeals возвращает список всех сделок
func listAdminDeals(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := c.Query("status") // new | agreed | handoff_done | cancelled | "" (all)
		limitStr := c.Query("limit")
		limit := 100
		if limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 500 {
				limit = l
			}
		}

		qry := `
			SELECT d.id, d.status, d.created_at, d.last_message_at,
			       pr.id as request_pub_id, pr.from_iata as request_from, pr.to_iata as request_to,
			       pr.date_start as request_date_start, pr.date_end as request_date_end, pr.date as request_date,
			       ur.tg_user_id as request_tg_user_id, COALESCE(ur.tg_username, '') as request_username,
			       pt.id as trip_pub_id, pt.from_iata as trip_from, pt.to_iata as trip_to,
			       pt.date as trip_date,
			       ut.tg_user_id as trip_tg_user_id, COALESCE(ut.tg_username, '') as trip_username
			FROM deal d
			JOIN publication pr ON pr.id = d.request_pub_id
			JOIN app_user ur ON ur.id = pr.user_id
			JOIN publication pt ON pt.id = d.trip_pub_id
			JOIN app_user ut ON ut.id = pt.user_id
			WHERE 1=1`
		args := []any{}
		argIdx := 1

		if status != "" {
			qry += fmt.Sprintf(" AND d.status = $%d::deal_status", argIdx)
			args = append(args, status)
			argIdx++
		}

		qry += " ORDER BY d.created_at DESC"
		qry += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, limit)

		rows, err := pool.Query(c, qry, args...)
		if err != nil {
			log.Printf("[ADMIN] List deals error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка базы данных"})
			return
		}
		defer rows.Close()

		type Deal struct {
			ID               int64   `json:"id"`
			Status           string  `json:"status"`
			CreatedAt        string  `json:"created_at"`
			LastMessageAt    *string `json:"last_message_at,omitempty"`
			RequestPubID     int64   `json:"request_pub_id"`
			RequestFrom      string  `json:"request_from"`
			RequestTo        string  `json:"request_to"`
			RequestDateStart *string `json:"request_date_start,omitempty"`
			RequestDateEnd   *string `json:"request_date_end,omitempty"`
			RequestDate      *string `json:"request_date,omitempty"`
			RequestTgUserID  int64   `json:"request_tg_user_id"`
			RequestUsername  string  `json:"request_username"`
			TripPubID        int64   `json:"trip_pub_id"`
			TripFrom         string  `json:"trip_from"`
			TripTo           string  `json:"trip_to"`
			TripDate         *string `json:"trip_date,omitempty"`
			TripTgUserID     int64   `json:"trip_tg_user_id"`
			TripUsername     string  `json:"trip_username"`
		}

		out := []Deal{}

		for rows.Next() {
			var d Deal
			var createdAt time.Time
			var lastMessageAt sql.NullTime
			var reqDateStart, reqDateEnd sql.NullTime
			var reqDate, tripDate sql.NullTime

			err := rows.Scan(&d.ID, &d.Status, &createdAt, &lastMessageAt,
				&d.RequestPubID, &d.RequestFrom, &d.RequestTo,
				&reqDateStart, &reqDateEnd, &reqDate,
				&d.RequestTgUserID, &d.RequestUsername,
				&d.TripPubID, &d.TripFrom, &d.TripTo,
				&tripDate,
				&d.TripTgUserID, &d.TripUsername)
			if err != nil {
				log.Printf("[ADMIN] Scan error: %v", err)
				continue
			}

			d.CreatedAt = createdAt.Format(time.RFC3339)
			if lastMessageAt.Valid {
				lmStr := lastMessageAt.Time.Format(time.RFC3339)
				d.LastMessageAt = &lmStr
			}

			if reqDate.Valid {
				dateStr := reqDate.Time.Format("2006-01-02")
				d.RequestDate = &dateStr
			} else if reqDateStart.Valid && reqDateEnd.Valid {
				dsStr := reqDateStart.Time.Format("2006-01-02")
				deStr := reqDateEnd.Time.Format("2006-01-02")
				d.RequestDateStart = &dsStr
				d.RequestDateEnd = &deStr
			}

			if tripDate.Valid {
				dateStr := tripDate.Time.Format("2006-01-02")
				d.TripDate = &dateStr
			}

			out = append(out, d)
		}

		c.JSON(http.StatusOK, out)
	}
}

// getAdminMatches возвращает матчи для конкретной публикации
func getAdminMatches(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		pubIDStr := c.Param("pub_id")
		pubID, err := strconv.ParseInt(pubIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверный идентификатор публикации"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "публикация не найдена или неактивна"})
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
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверный диапазон дат"})
			return
		}

		// Looking for opposite kind
		opp := "trip"
		if kind == "trip" {
			opp = "request"
		}

		var anchorUserID int64
		_ = pool.QueryRow(c, `SELECT user_id FROM publication WHERE id=$1`, pubID).Scan(&anchorUserID)

		var rows interface {
			Close()
			Err() error
			Next() bool
			Scan(dest ...interface{}) error
		}
		if opp == "trip" {
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
				    a_from.iata = $3 OR (a_from.city IS NOT NULL AND a_from.city = a_from_search.city)
				  )
				  AND (
				    a_to.iata = $4 OR (a_to.city IS NOT NULL AND a_to.city = a_to_search.city)
				  )
				  AND p.date IS NOT NULL
				  AND p.date >= $5 AND p.date <= $6
				ORDER BY p.created_at DESC
				LIMIT 50
			`, pubID, opp, from, to, anchorStart, anchorEnd, anchorUserID)
		} else {
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
				    a_from.iata = $3 OR (a_from.city IS NOT NULL AND a_from.city = a_from_search.city)
				  )
				  AND (
				    a_to.iata = $4 OR (a_to.city IS NOT NULL AND a_to.city = a_to_search.city)
				  )
				  AND NOT (p.date_end < $5 OR p.date_start > $6)
				ORDER BY p.created_at DESC
				LIMIT 50
			`, pubID, opp, from, to, anchorStart, anchorEnd, anchorUserID)
		}
		if err != nil {
			log.Printf("[ADMIN] Matches query error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка при поиске совпадений"})
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

			ok := true
			if kind == "request" {
				ok = match.WeightOK(weight, w)
			} else {
				ok = match.WeightOK(w, weight)
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

// RegisterAdminRoutes регистрирует админ-роуты
func RegisterAdminRoutes(g *gin.RouterGroup, pool *pgxpool.Pool) {
	admin := g.Group("/admin")
	admin.Use(WithAdmin())
	{
		admin.POST("/publications", createAdminPublication(pool))
		admin.GET("/publications", listAdminPublications(pool))
		admin.GET("/publications/:id", getAdminPublication(pool))
		admin.POST("/deals", createAdminDeal(pool))
		admin.GET("/deals", listAdminDeals(pool))
		admin.GET("/matches/:pub_id", getAdminMatches(pool))
	}
}
