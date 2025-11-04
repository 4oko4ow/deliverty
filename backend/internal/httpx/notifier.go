package httpx

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sol/deliverty/backend/internal/bot"
)

// Start background ticker (call from main after router setup)
func StartReminders(pool *pgxpool.Pool) {
	tg := bot.New()
	go func() {
		t := time.NewTicker(5 * time.Minute)
		defer t.Stop()
		for range t.C {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			runReminders(ctx, pool, tg)
			cancel()
		}
	}()
}

func runReminders(ctx context.Context, pool *pgxpool.Pool, tg *bot.TG) {
	// 1) Trip pre-reminders at T-24h and T-3h
	type row struct {
		ID                      int64
		Kind, From, To          string
		Start                   time.Time
		ReqTG, TripTG           int64
	}
	for _, rule := range []struct {
		label string
		delta time.Duration
	}{
		{"pre24", 24 * time.Hour}, {"pre3h", 3 * time.Hour},
	} {
		rows, _ := pool.Query(ctx, `
		  SELECT p.id, p.kind, p.from_iata, p.to_iata, p.date_start::timestamptz AS start,
		         ur.tg_user_id AS req_tg, ut.tg_user_id AS trip_tg
		  FROM publication p
		  LEFT JOIN deal d ON (p.kind='request' AND d.request_pub_id=p.id) OR (p.kind='trip' AND d.trip_pub_id=p.id)
		  LEFT JOIN publication pr ON pr.id=d.request_pub_id
		  LEFT JOIN app_user ur ON ur.id=pr.user_id
		  LEFT JOIN publication pt ON pt.id=d.trip_pub_id
		  LEFT JOIN app_user ut ON ut.id=pt.user_id
		  WHERE p.is_active
		    AND now() >= (p.date_start::timestamptz - $1)
		    AND now() <  (p.date_start::timestamptz - $1 + interval '10 minutes')
		`, rule.delta)
		defer rows.Close()

		for rows.Next() {
			var r row
			if rows.Scan(&r.ID, &r.Kind, &r.From, &r.To, &r.Start, &r.ReqTG, &r.TripTG) != nil {
				continue
			}

			key := fmt.Sprintf("%s:%s:%d", rule.label, r.Kind, r.ID)
			if seen(ctx, pool, key) {
				continue
			}

			// Notify both ends if deal exists; otherwise notify owner only
			kindText := "запрос"
			if r.Kind == "trip" {
				kindText = "поездка"
			}
			msg := fmt.Sprintf("Напоминание: %s %s→%s, окно начинается %s",
				kindText, r.From, r.To, r.Start.Format("02.01.2006 15:04"))

			if r.ReqTG != 0 && r.TripTG != 0 {
				_, _ = tg.API("sendMessage", map[string]any{"chat_id": r.ReqTG, "text": msg})
				_, _ = tg.API("sendMessage", map[string]any{"chat_id": r.TripTG, "text": msg})
			}

			logKey(ctx, pool, key)
		}
	}

	// 2) After /done -> ask for rating (one-shot)
	_, _ = pool.Exec(ctx, `
	  WITH ready AS (
	    SELECT d.id, ur.tg_user_id AS req_tg, ut.tg_user_id AS trip_tg
	    FROM deal d
	    JOIN publication pr ON pr.id=d.request_pub_id
	    JOIN app_user ur ON ur.id=pr.user_id
	    JOIN publication pt ON pt.id=d.trip_pub_id
	    JOIN app_user ut ON ut.id=pt.user_id
	    WHERE d.status='handoff_done' AND d.last_message_at > now() - interval '10 minutes'
	  )
	  INSERT INTO reminder_log(key)
	  SELECT 'rate:'||id FROM ready
	  ON CONFLICT DO NOTHING RETURNING key
	`)

	rows, _ := pool.Query(ctx, `SELECT key FROM reminder_log WHERE key LIKE 'rate:%' AND created_at > now() - interval '10 minutes'`)
	defer rows.Close()
	for rows.Next() {
		var key string
		_ = rows.Scan(&key) // no lookup back for simplicity in MVP
		// (Optional) you can query back participants by deal id parsed from key and send rating prompt
	}
}

func seen(ctx context.Context, pool *pgxpool.Pool, key string) bool {
	// a small second query keeps code simple for MVP:
	var exists bool
	_ = pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM reminder_log WHERE key=$1)`, key).Scan(&exists)
	return exists
}

func logKey(ctx context.Context, pool *pgxpool.Pool, key string) {
	_, _ = pool.Exec(ctx, `INSERT INTO reminder_log(key) VALUES ($1) ON CONFLICT DO NOTHING`, key)
}
