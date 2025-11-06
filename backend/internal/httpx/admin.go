package httpx

import (
	"crypto/md5"
	"encoding/binary"
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
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
	TgUserID  *int64  `json:"tg_user_id"`  // Telegram user ID
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
			"id":       pubID,
			"user_id":  userID,
			"message":  "публикация создана",
		})
	}
}

// RegisterAdminRoutes регистрирует админ-роуты
func RegisterAdminRoutes(g *gin.RouterGroup, pool *pgxpool.Pool) {
	admin := g.Group("/admin")
	admin.Use(WithAdmin())
	{
		admin.POST("/publications", createAdminPublication(pool))
	}
}

