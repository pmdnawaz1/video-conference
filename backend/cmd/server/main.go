package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"video-conference-backend/internal/api"
	"video-conference-backend/internal/config"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/services"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database connection
	db, err := database.NewConnection(cfg.Database)
	if err != nil {
		log.Fatalf("❌ Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Run migrations if enabled
	if cfg.Development.AutoMigrate {
		log.Printf("🔄 Running database migrations...")
		if err := database.RunMigrations(db); err != nil {
			log.Fatalf("❌ Migration failed: %v", err)
		}
		log.Printf("✅ Database migrations completed")
	}
	
	// Initialize services with database
	svc := services.NewServices(db, cfg)
	log.Printf("✅ Enterprise services initialized: Client, User, Auth, Meeting, Chat, etc.")

	// Initialize API server
	server := api.NewServer(cfg, svc)
	handler := server.Router()
	log.Printf("🚀 REST API endpoints initialized")

	// Setup HTTP server
	httpServer := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("🚀 Server starting on port %s", cfg.Server.Port)
		log.Printf("🌍 Environment: %s", cfg.Server.Environment)
		log.Printf("🔧 Debug mode: %v", cfg.Server.Debug)
		
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	
	log.Println("🛑 Shutting down server...")

	// Create a deadline for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown server gracefully
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("✅ Server shutdown complete")
}