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

		auth := api.Group("/")
		auth.Use(WithUser())
		RegisterPublicationRoutes(auth, pool)
		RegisterMatchRoutes(auth, pool)
		RegisterDealRoutes(auth, pool)
	}

	registerBotRoutes(r, pool)
}
