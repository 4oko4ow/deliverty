package httpx

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

const CtxUserID = "uid"        // tg_user_id as string (for backward compatibility)
const CtxDBUserID = "db_uid"   // internal user id from app_user table

// Lightweight auth: read X-TG-User-ID header, verify/upsert user in DB
func WithUser(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := c.GetHeader("X-TG-User-ID")
		if raw == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Требуется авторизация. Пожалуйста, войдите через Telegram."})
			return
		}
		
		tgUserID, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Неверный идентификатор пользователя. Пожалуйста, войдите заново."})
			return
		}
		
		// Upsert user: create if doesn't exist, return existing id
		var userID int64
		err = pool.QueryRow(c, `
			INSERT INTO app_user (tg_user_id) VALUES ($1)
			ON CONFLICT (tg_user_id) DO UPDATE SET tg_user_id=EXCLUDED.tg_user_id
			RETURNING id
		`, tgUserID).Scan(&userID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Ошибка авторизации. Попробуйте позже."})
			return
		}
		
		// Store both for backward compatibility and efficiency
		c.Set(CtxUserID, raw)           // tg_user_id as string
		c.Set(CtxDBUserID, userID)      // internal user id
		c.Next()
	}
}
