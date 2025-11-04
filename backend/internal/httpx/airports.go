package httpx

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func listAirports(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := c.Query("q")

		rows, err := pool.Query(c,
			`SELECT iata, name, city, country, tz
			 FROM airport
			 WHERE (iata ILIKE $1 OR name ILIKE $1 OR city ILIKE $1)
			 ORDER BY iata LIMIT 20`, "%"+q+"%")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db"})
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
				continue
			}
			out = append(out, a)
		}

		c.JSON(http.StatusOK, out)
	}
}
