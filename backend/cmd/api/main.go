package main

import (
	"context"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/sol/deliverty/backend/internal/db"
	"github.com/sol/deliverty/backend/internal/httpx"
	"github.com/sol/deliverty/backend/internal/migrations"
	"github.com/sol/deliverty/backend/internal/posthog"
)

func main() {
	_ = godotenv.Load()

	posthog.InitFromEnv()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}

	pool, err := db.Connect(dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	// Run database migrations on startup
	ctx := context.Background()
	if err := migrations.Run(ctx, pool); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	r := gin.Default()
	httpx.RegisterRoutes(r, pool)

	httpx.StartReminders(pool)

	// Support both PORT (Render/Heroku standard) and HTTP_ADDR
	addr := os.Getenv("HTTP_ADDR")
	if addr == "" {
		port := os.Getenv("PORT")
		if port != "" {
			addr = ":" + port
		} else {
			addr = ":8080"
		}
	}

	log.Println("listening on", addr)
	if err := r.Run(addr); err != nil {
		log.Fatal(err)
	}
}
