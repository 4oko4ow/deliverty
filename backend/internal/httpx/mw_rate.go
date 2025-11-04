package httpx

import (
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type bucket struct {
	tokens int
	last   time.Time
}

var rl = struct {
	sync.Mutex
	m map[string]*bucket
}{m: map[string]*bucket{}}

func RateLimit(maxPerMin int) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip, _, _ := net.SplitHostPort(c.Request.RemoteAddr)
		if ip == "" {
			ip = "unknown"
		}

		rl.Lock()
		b, ok := rl.m[ip]
		now := time.Now()
		if !ok {
			b = &bucket{tokens: maxPerMin, last: now}
			rl.m[ip] = b
		}

		// refill
		el := now.Sub(b.last).Minutes()
		refill := int(el * float64(maxPerMin))
		if refill > 0 {
			b.tokens = min(maxPerMin, b.tokens+refill)
			b.last = now
		}

		if b.tokens <= 0 {
			rl.Unlock()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit"})
			return
		}

		b.tokens--
		rl.Unlock()

		c.Next()
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
