package db

import (
	"context"
	"net"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(dsn string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}

	// Force IPv4 to avoid IPv6 connection issues on Render
	cfg.ConnConfig.DialFunc = func(ctx context.Context, network, addr string) (net.Conn, error) {
		// Resolve hostname to IPv4 address
		host, port, err := net.SplitHostPort(addr)
		if err != nil {
			return nil, err
		}

		// Try to resolve to IPv4 only
		ips, err := net.DefaultResolver.LookupIP(ctx, "ip4", host)
		if err != nil || len(ips) == 0 {
			// Fallback to regular resolution if IPv4 lookup fails
			dialer := &net.Dialer{}
			return dialer.DialContext(ctx, "tcp4", addr)
		}

		// Use first IPv4 address
		ipv4Addr := net.JoinHostPort(ips[0].String(), port)
		dialer := &net.Dialer{}
		return dialer.DialContext(ctx, "tcp4", ipv4Addr)
	}

	cfg.MaxConns = 8
	cfg.MaxConnIdleTime = 5 * time.Minute

	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		return nil, err
	}

	if err := ping(pool); err != nil {
		return nil, err
	}

	return pool, nil
}

func ping(pool *pgxpool.Pool) error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return pool.Ping(ctx)
}
