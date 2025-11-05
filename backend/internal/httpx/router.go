package httpx

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	r.Use(WithCORS(), RateLimit(120)) // per IP, per minute

	r.GET("/healthz", func(c *gin.Context) {
		if err := pool.Ping(c); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"ok": false})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	api := r.Group("/api")
	{
		api.GET("/airports", RateLimit(240), listAirports(pool))
		
		// Telegram Login Widget callback (no auth required)
		api.GET("/auth/telegram", handleTelegramAuth(pool))

		// Public routes (no auth required)
		api.GET("/publications", listPublications(pool))
		api.GET("/publications/:id", getPublication(pool))
		api.GET("/matches", findMatches(pool))

		// Auth required routes
		auth := api.Group("/")
		auth.Use(WithUser(pool))
		auth.GET("/profile", getUserProfile(pool))
		auth.POST("/publications", RateLimit(20), createPublication(pool))
		RegisterPublicationAuthRoutes(auth, pool)
		RegisterMatchAuthRoutes(auth, pool)
		RegisterDealRoutes(auth, pool)
	}

	registerBotRoutes(r, pool)
}
