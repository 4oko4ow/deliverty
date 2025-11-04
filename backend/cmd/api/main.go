package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/sol/deliverty/backend/internal/db"
	"github.com/sol/deliverty/backend/internal/httpx"
)

func main() {
	_ = godotenv.Load()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}

	pool, err := db.Connect(dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

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
