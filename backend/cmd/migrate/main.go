package main

import (
	"context"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/sol/deliverty/backend/internal/db"
	"github.com/sol/deliverty/backend/internal/migrations"
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

	// Run database migrations
	ctx := context.Background()
	if err := migrations.Run(ctx, pool); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	log.Println("Migrations completed successfully")
}
