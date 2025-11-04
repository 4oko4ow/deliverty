package httpx

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func listAirports(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := c.Query("q")
		if q == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required"})
			return
		}

		rows, err := pool.Query(c,
			`SELECT iata, name, city, country, tz
			 FROM airport
			 WHERE (iata ILIKE $1 OR name ILIKE $1 OR city ILIKE $1)
			 ORDER BY iata LIMIT 20`, "%"+q+"%")
		if err != nil {
			log.Printf("ERROR: airports query failed: %v (query=%q)", err, q)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db", "details": err.Error()})
			return
		}
		defer rows.Close()

		type A struct {
			IATA, Name, City, Country, TZ string
		}

		out := []A{}

		for rows.Next() {
			var a A
			if err := rows.Scan(&a.IATA, &a.Name, &a.City, &a.Country, &a.TZ); err != nil {
				log.Printf("WARN: failed to scan airport row: %v", err)
				continue
			}
			out = append(out, a)
		}

		if err := rows.Err(); err != nil {
			log.Printf("ERROR: rows iteration error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db", "details": err.Error()})
			return
		}

		c.JSON(http.StatusOK, out)
	}
}
