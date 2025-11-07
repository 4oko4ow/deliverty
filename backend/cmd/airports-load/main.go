package main

import (
	"context"
	"encoding/csv"
	"log"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	if len(os.Args) < 3 {
		log.Fatal("usage: airports-load <DATABASE_URL> <airports.csv>")
	}

	dsn, file := os.Args[1], os.Args[2]
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	f, err := os.Open(file)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	_, _ = r.Read() // skip header

	tx, _ := pool.Begin(context.Background())
	defer tx.Rollback(context.Background())

	stmt := `INSERT INTO airport(iata,name,city,country,tz)
	         VALUES ($1,$2,$3,$4,$5)
	         ON CONFLICT (iata) DO UPDATE SET name=EXCLUDED.name, city=EXCLUDED.city, country=EXCLUDED.country, tz=EXCLUDED.tz`

	count := 0
	for {
		rec, err := r.Read()
		if err != nil {
			break
		}

		if len(rec) < 5 {
			continue
		}

		iata := strings.TrimSpace(rec[0])
		if len(iata) != 3 {
			continue
		}

		name, city, country, tz := rec[1], rec[2], rec[3], rec[4]
		if tz == "" {
			tz = "UTC"
		}

		if _, err := tx.Exec(context.Background(), stmt, strings.ToUpper(iata), name, city, country, tz); err != nil {
			log.Println("skip", iata, err)
			continue
		}
		count++
	}

	if err := tx.Commit(context.Background()); err != nil {
		log.Fatal(err)
	}

	log.Printf("done: loaded %d airports\n", count)
}

