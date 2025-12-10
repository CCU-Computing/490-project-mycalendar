package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"mycalendar/internal/config"
	"mycalendar/internal/database"
	"mycalendar/internal/handlers"
	"mycalendar/internal/session"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	// Load configuration
	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database
	db, err := database.GetDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Database connection established successfully")

	// Initialize session store
	session.InitStore(config.AppConfig.SessionSecret, config.AppConfig.CookieSecure)
	log.Println("Session store initialized")

	// Initialize router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:*", "http://127.0.0.1:*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check endpoint
	r.Get("/health", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","message":"Server is running"}`))
	})

	// Auth routes
	r.Route("/auth", func(authRouter chi.Router) {
		authRouter.Post("/register", handlers.Register)
		authRouter.Post("/login", handlers.Login)
		authRouter.Post("/logout", handlers.Logout)
		authRouter.Get("/session", handlers.GetSession)
		authRouter.Put("/moodle-token", handlers.UpdateMoodleToken)
	})

	// Placeholder for API routes (will be added in Week 3+)
	r.Route("/api", func(apiRouter chi.Router) {
		apiRouter.Get("/", func(w http.ResponseWriter, req *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"message":"MyCalendar Go API - Coming Soon"}`))
		})
	})

	// Start server
	addr := fmt.Sprintf(":%s", config.AppConfig.Port)
	log.Printf("Starting server on %s", addr)
	log.Printf("Database: %s", config.AppConfig.DBPath)
	log.Printf("Moodle URL: %s", config.AppConfig.MoodleBaseURL)

	// Create server
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	if err := srv.Close(); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
