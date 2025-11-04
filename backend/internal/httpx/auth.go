package httpx

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sol/deliverty/backend/internal/auth"
)

// Handle Telegram Login Widget callback
// GET /api/auth/telegram?id=...&first_name=...&hash=...&auth_date=...
func handleTelegramAuth(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get all query parameters
		id := c.Query("id")
		firstName := c.Query("first_name")
		lastName := c.Query("last_name")
		username := c.Query("username")
		photoURL := c.Query("photo_url")
		authDate := c.Query("auth_date")
		hash := c.Query("hash")

		// Validate required fields
		if id == "" || authDate == "" || hash == "" {
			c.Redirect(http.StatusFound, "/?error=invalid_auth")
			return
		}

		// Validate Telegram auth data
		userID, err := auth.ValidateTelegramAuth(id, firstName, lastName, username, photoURL, authDate, hash)
		if err != nil {
			c.Redirect(http.StatusFound, "/?error=auth_failed")
			return
		}

		// Upsert user in database
		var dbUserID int64
		err = pool.QueryRow(c, `
			INSERT INTO app_user (tg_user_id, tg_username)
			VALUES ($1, $2)
			ON CONFLICT (tg_user_id) 
			DO UPDATE SET tg_username=EXCLUDED.tg_username
			RETURNING id
		`, userID, username).Scan(&dbUserID)
		if err != nil {
			c.Redirect(http.StatusFound, "/?error=db_error")
			return
		}

		// Redirect to frontend with success and user ID
		// Frontend will save user ID to localStorage
		c.Redirect(http.StatusFound, "/?auth_success=1&user_id="+id)
	}
}

