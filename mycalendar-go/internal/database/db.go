package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

var (
	db   *sqlx.DB
	once sync.Once
)

// GetDB returns a singleton database connection
func GetDB() (*sqlx.DB, error) {
	var err error
	once.Do(func() {
		// Get database path from environment or use default
		dbPath := os.Getenv("DB_PATH")
		if dbPath == "" {
			dbPath = "../data/mycalendar.db"
		}

		// Ensure database directory exists
		dbDir := filepath.Dir(dbPath)
		if err = os.MkdirAll(dbDir, 0755); err != nil {
			return
		}

		// Open database connection
		db, err = sqlx.Open("sqlite3", dbPath)
		if err != nil {
			return
		}

		// Configure connection pool
		db.SetMaxOpenConns(25)
		db.SetMaxIdleConns(5)

		// Enable foreign keys (critical for CASCADE DELETE)
		_, err = db.Exec("PRAGMA foreign_keys = ON")
		if err != nil {
			return
		}

		// Enable WAL mode for better concurrency
		_, err = db.Exec("PRAGMA journal_mode = WAL")
		if err != nil {
			return
		}

		// Initialize schema if needed
		err = initSchema(db.DB)
	})

	return db, err
}

// initSchema creates tables if they don't exist
func initSchema(db *sql.DB) error {
	// Read schema.sql file
	schemaPath := filepath.Join("internal", "database", "schema.sql")
	schemaBytes, err := os.ReadFile(schemaPath)
	if err != nil {
		return fmt.Errorf("failed to read schema.sql: %w", err)
	}

	// Execute schema
	_, err = db.Exec(string(schemaBytes))
	if err != nil {
		return fmt.Errorf("failed to execute schema: %w", err)
	}

	return nil
}

// Close closes the database connection
func Close() error {
	if db != nil {
		return db.Close()
	}
	return nil
}
