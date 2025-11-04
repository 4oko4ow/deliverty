package httpx

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sol/deliverty/backend/internal/auth"
)

// getFrontendURL returns the frontend URL for redirects
// Tries FRONTEND_URL env var first, then derives from Referer header
func getFrontendURL(c *gin.Context) string {
	// Try environment variable first
	if frontendURL := os.Getenv("FRONTEND_URL"); frontendURL != "" {
		return strings.TrimSuffix(frontendURL, "/")
	}

	// Try to derive from Referer header
	referer := c.GetHeader("Referer")
	if referer != "" {
		// Extract origin from referer
		// Referer format: https://frontend.com/auth or https://frontend.com/path
		// We want: https://frontend.com
		if idx := strings.Index(referer, "://"); idx != -1 {
			if rest := referer[idx+3:]; rest != "" {
				if slashIdx := strings.Index(rest, "/"); slashIdx != -1 {
					return referer[:idx+3+slashIdx]
				}
				return referer
			}
		}
	}

	// Fallback for local development
	return "http://localhost:5173"
}

// Handle Telegram Login Widget callback
// GET /api/auth/telegram?id=...&first_name=...&hash=...&auth_date=...
// Supports both redirect mode (browser) and callback mode (AJAX)
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

		// Check if this is a callback mode request (AJAX) or redirect mode (browser)
		// Callback mode: Accept header contains "application/json" or X-Requested-With header
		isCallbackMode := c.GetHeader("Accept") == "application/json" ||
			c.GetHeader("X-Requested-With") == "XMLHttpRequest" ||
			c.Query("callback") == "1"

		frontendURL := getFrontendURL(c)

		// Validate required fields
		if id == "" || authDate == "" || hash == "" {
			if isCallbackMode {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_auth", "message": "Missing required fields"})
				return
			}
			c.Redirect(http.StatusFound, frontendURL+"/auth?error=invalid_auth")
			return
		}

		// Validate Telegram auth data
		userID, err := auth.ValidateTelegramAuth(id, firstName, lastName, username, photoURL, authDate, hash)
		if err != nil {
			if isCallbackMode {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "auth_failed", "message": err.Error()})
				return
			}
			c.Redirect(http.StatusFound, frontendURL+"/auth?error=auth_failed")
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
			if isCallbackMode {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "db_error", "message": "Database error"})
				return
			}
			c.Redirect(http.StatusFound, frontendURL+"/auth?error=db_error")
			return
		}

		// Note: We don't send Telegram notification here because:
		// - Bots can't send messages to users who haven't started a conversation
		// - User is logging in via web, not through bot
		// - Notification will be shown in the web interface instead

		// Return JSON for callback mode, redirect for redirect mode
		if isCallbackMode {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"user_id": id,
				"message": "Authentication successful",
			})
			return
		}

		// Redirect to frontend with success and user ID
		// Frontend will save user ID to localStorage and show success notification
		c.Redirect(http.StatusFound, frontendURL+"/auth?auth_success=1&user_id="+id)
	}
}

