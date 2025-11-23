package httpx

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ProfileOut struct {
	Username string `json:"username"`
	Rating   int    `json:"rating"`
}

func getUserProfile(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid := c.GetString(CtxUserID)
		if uid == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Требуется авторизация"})
			return
		}

		var profile ProfileOut
		err := pool.QueryRow(c, `
			SELECT COALESCE(tg_username, ''), COALESCE(rating_small, 0)
			FROM app_user WHERE tg_user_id=$1
		`, uid).Scan(&profile.Username, &profile.Rating)

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Пользователь не найден"})
			return
		}

		c.JSON(http.StatusOK, profile)
	}
}

