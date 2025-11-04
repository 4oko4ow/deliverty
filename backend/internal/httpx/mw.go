package httpx

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

const CtxUserID = "uid"

// MVP auth: read X-TG-User-ID header and ensure app_user exists later
func WithUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := c.GetHeader("X-TG-User-ID")
		if raw == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "no tg user"})
			return
		}
		if _, err := strconv.ParseInt(raw, 10, 64); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "bad tg id"})
			return
		}
		c.Set(CtxUserID, raw)
		c.Next()
	}
}
