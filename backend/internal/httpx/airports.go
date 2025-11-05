package httpx

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Simple transliteration map for common Russian cities
var translitMap = map[rune]string{
	'а': "a", 'б': "b", 'в': "v", 'г': "g", 'д': "d", 'е': "e", 'ё': "e",
	'ж': "zh", 'з': "z", 'и': "i", 'й': "y", 'к': "k", 'л': "l", 'м': "m",
	'н': "n", 'о': "o", 'п': "p", 'р': "r", 'с': "s", 'т': "t", 'у': "u",
	'ф': "f", 'х': "h", 'ц': "ts", 'ч': "ch", 'ш': "sh", 'щ': "sch",
	'ъ': "", 'ы': "y", 'ь': "", 'э': "e", 'ю': "yu", 'я': "ya",
	'А': "A", 'Б': "B", 'В': "V", 'Г': "G", 'Д': "D", 'Е': "E", 'Ё': "E",
	'Ж': "Zh", 'З': "Z", 'И': "I", 'Й': "Y", 'К': "K", 'Л': "L", 'М': "M",
	'Н': "N", 'О': "O", 'П': "P", 'Р': "R", 'С': "S", 'Т': "T", 'У': "U",
	'Ф': "F", 'Х': "H", 'Ц': "Ts", 'Ч': "Ch", 'Ш': "Sh", 'Щ': "Sch",
	'Ъ': "", 'Ы': "Y", 'Ь': "", 'Э': "E", 'Ю': "Yu", 'Я': "Ya",
}

func transliterate(s string) string {
	var result strings.Builder
	for _, r := range s {
		if translit, ok := translitMap[r]; ok {
			result.WriteString(translit)
		} else {
			result.WriteRune(r)
		}
	}
	return result.String()
}

func listAirports(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := c.Query("q")
		if q == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required"})
			return
		}

		// Create transliterated version for search
		qTranslit := transliterate(q)
		pattern := "%" + q + "%"
		patternTranslit := "%" + qTranslit + "%"

		rows, err := pool.Query(c,
			`SELECT iata, name, city, country, tz
			 FROM airport
			 WHERE (iata ILIKE $1 OR name ILIKE $1 OR city ILIKE $1
			        OR iata ILIKE $2 OR name ILIKE $2 OR city ILIKE $2)
			 ORDER BY iata LIMIT 20`, pattern, patternTranslit)
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

