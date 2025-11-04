package migrations

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Migration represents a single migration file
type Migration struct {
	Name     string
	Content  string
	OrderNum int
}

// Run applies all pending migrations to the database
func Run(ctx context.Context, pool *pgxpool.Pool) error {
	// Create migrations table if it doesn't exist
	if err := createMigrationsTable(ctx, pool); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Get all migration files
	migrations, err := loadMigrations()
	if err != nil {
		return fmt.Errorf("failed to load migrations: %w", err)
	}

	// Get already applied migrations
	applied, err := getAppliedMigrations(ctx, pool)
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	// Apply pending migrations in order
	for _, migration := range migrations {
		if applied[migration.Name] {
			log.Printf("Migration %s already applied, skipping", migration.Name)
			continue
		}

		log.Printf("Applying migration %s...", migration.Name)
		if err := applyMigration(ctx, pool, migration); err != nil {
			return fmt.Errorf("failed to apply migration %s: %w", migration.Name, err)
		}
		log.Printf("Migration %s applied successfully", migration.Name)
	}

	return nil
}

// createMigrationsTable creates the schema_migrations table if it doesn't exist
func createMigrationsTable(ctx context.Context, pool *pgxpool.Pool) error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`
	_, err := pool.Exec(ctx, query)
	return err
}

// loadMigrations loads all migration files from the migrations directory
func loadMigrations() ([]Migration, error) {
	// Try to find migrations directory relative to common locations
	migrationsDir := findMigrationsDir()
	if migrationsDir == "" {
		return nil, fmt.Errorf("could not find migrations directory")
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var migrations []Migration
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		filePath := filepath.Join(migrationsDir, entry.Name())
		content, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to read migration %s: %w", entry.Name(), err)
		}

		// Extract order number from filename (e.g., 001_init.sql -> 1)
		orderNum := 0
		if len(entry.Name()) >= 3 {
			fmt.Sscanf(entry.Name(), "%d", &orderNum)
		}

		migrations = append(migrations, Migration{
			Name:     entry.Name(),
			Content:  string(content),
			OrderNum: orderNum,
		})
	}

	// Sort by order number
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].OrderNum < migrations[j].OrderNum
	})

	return migrations, nil
}

// findMigrationsDir finds the migrations directory relative to the binary or source
func findMigrationsDir() string {
	// Try environment variable first (useful for custom deployments)
	if dir := os.Getenv("MIGRATIONS_DIR"); dir != "" {
		if _, err := os.Stat(dir); err == nil {
			return dir
		}
	}

	// Try common paths relative to the binary location
	exe, err := os.Executable()
	if err == nil {
		// Try backend/migrations relative to binary
		tryPaths := []string{
			filepath.Join(filepath.Dir(exe), "migrations"),
			filepath.Join(filepath.Dir(exe), "..", "migrations"),
			filepath.Join(filepath.Dir(exe), "..", "backend", "migrations"),
			filepath.Join(filepath.Dir(exe), "backend", "migrations"),
		}
		for _, p := range tryPaths {
			if abs, err := filepath.Abs(p); err == nil {
				if _, err := os.Stat(abs); err == nil {
					return abs
				}
			}
		}
	}

	// Try relative to current working directory (for development)
	tryPaths := []string{
		"migrations",
		"backend/migrations",
		"../migrations",
		"../backend/migrations",
	}
	for _, p := range tryPaths {
		if abs, err := filepath.Abs(p); err == nil {
			if _, err := os.Stat(abs); err == nil {
				return abs
			}
		}
	}

	return ""
}

// getAppliedMigrations returns a map of already applied migration names
func getAppliedMigrations(ctx context.Context, pool *pgxpool.Pool) (map[string]bool, error) {
	query := `SELECT name FROM schema_migrations`
	rows, err := pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		applied[name] = true
	}

	return applied, rows.Err()
}

// applyMigration applies a single migration and records it
func applyMigration(ctx context.Context, pool *pgxpool.Pool, migration Migration) error {
	// Begin transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Execute migration SQL
	if _, err := tx.Exec(ctx, migration.Content); err != nil {
		return fmt.Errorf("failed to execute migration SQL: %w", err)
	}

	// Record migration
	recordQuery := `INSERT INTO schema_migrations (name) VALUES ($1)`
	if _, err := tx.Exec(ctx, recordQuery, migration.Name); err != nil {
		return fmt.Errorf("failed to record migration: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit migration: %w", err)
	}

	return nil
}

