package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	// Server configuration
	Port string

	// Database configuration
	DBPath string

	// Session configuration
	SessionSecret string
	CookieSecure  bool

	// Moodle configuration
	MoodleBaseURL string
	MoodleFormat  string
}

var AppConfig *Config

// Load loads configuration from environment variables
func Load() error {
	// Load .env file if it exists (ignore error if file doesn't exist)
	_ = godotenv.Load()

	AppConfig = &Config{
		Port:          getEnv("PORT", "3001"),
		DBPath:        getEnv("DB_PATH", "../data/mycalendar.db"),
		SessionSecret: getEnv("SESSION_SECRET", generateDefaultSecret()),
		CookieSecure:  getEnvBool("COOKIE_SECURE", false),
		MoodleBaseURL: getEnv("MOODLE_BASE_URL", "https://moodle24-26.coastal.edu/webservice/rest/server.php"),
		MoodleFormat:  getEnv("MOODLE_FORMAT", "json"),
	}

	// Warn if using default session secret in production
	if AppConfig.SessionSecret == generateDefaultSecret() {
		log.Println("WARNING: Using default session secret. Set SESSION_SECRET environment variable for production.")
	}

	return nil
}

// getEnv retrieves an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// getEnvBool retrieves a boolean environment variable or returns a default value
func getEnvBool(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	boolValue, err := strconv.ParseBool(value)
	if err != nil {
		return defaultValue
	}
	return boolValue
}

// generateDefaultSecret generates a default session secret (should be overridden in production)
func generateDefaultSecret() string {
	return "change-me-in-production-please"
}
