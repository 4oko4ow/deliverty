package db

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(dsn string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}

	// Force IPv4 to avoid IPv6 connection issues on Render
	// This handles cases where DNS resolves to IPv6 but network only supports IPv4
	cfg.ConnConfig.DialFunc = func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(addr)
		if err != nil {
			return nil, err
		}

		// Check if addr is already an IP address (IPv6)
		if ip := net.ParseIP(host); ip != nil {
			// If it's an IPv6 address, we need to resolve the original hostname
			// This shouldn't happen with proper DNS, but handle it gracefully
			if ip.To4() == nil {
				// It's IPv6, try to get hostname from connection config
				originalHost := cfg.ConnConfig.Host
				if originalHost != "" {
					// Resolve original hostname to IPv4
					ips, err := net.DefaultResolver.LookupIP(ctx, "ip4", originalHost)
					if err == nil && len(ips) > 0 {
						ipv4Addr := net.JoinHostPort(ips[0].String(), port)
						dialer := &net.Dialer{}
						return dialer.DialContext(ctx, "tcp4", ipv4Addr)
					}
				}
				// Can't resolve to IPv4, return error
				return nil, fmt.Errorf("IPv6 address %s not supported, use Supabase Session Pooler (port 6543) instead", host)
			}
		}

		// Resolve hostname to IPv4 address
		ips, err := net.DefaultResolver.LookupIP(ctx, "ip4", host)
		if err != nil || len(ips) == 0 {
			// Try IPv6 if IPv4 fails, but prefer IPv4
			ips6, err6 := net.DefaultResolver.LookupIP(ctx, "ip6", host)
			if err6 == nil && len(ips6) > 0 {
				return nil, fmt.Errorf("hostname %s resolves to IPv6 only, use Supabase Session Pooler (port 6543) for IPv4 support", host)
			}
			return nil, fmt.Errorf("failed to resolve %s to IPv4: %v", host, err)
		}

		// Use first IPv4 address
		ipv4Addr := net.JoinHostPort(ips[0].String(), port)
		dialer := &net.Dialer{}
		return dialer.DialContext(ctx, "tcp4", ipv4Addr)
	}

	cfg.MaxConns = 8
	cfg.MaxConnIdleTime = 5 * time.Minute

	// Use simple query protocol to avoid prepared statement name collisions
	// This prevents "prepared statement already exists" errors when connections are reused
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

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
