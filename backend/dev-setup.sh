#!/bin/bash

# Development Setup Script for Video Conference Backend

set -e

echo "🚀 Setting up Video Conference Backend for Development..."

# Check if Docker is available
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "🐳 Docker detected. Setting up with Docker..."
    
    # Stop any existing containers
    docker-compose down || true
    
    # Start PostgreSQL and Redis
    echo "📦 Starting PostgreSQL and Redis containers..."
    docker-compose up -d postgres redis
    
    # Wait for PostgreSQL to be ready
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Use local environment file for development
    if [ ! -f ".env.local" ]; then
        echo "❌ .env.local file not found. Please create it first."
        exit 1
    fi
    
    export $(grep -v '^#' .env.local | xargs)
    
    # Push database schema
    echo "📊 Pushing database schema..."
    DATABASE_URL="postgresql://postgres:password@localhost:5432/video_conference_dev" npx prisma db push
    
    # Generate Prisma client
    echo "🔧 Generating Prisma client..."
    npx prisma generate
    
    # Run database seeding
    echo "🌱 Seeding database with initial data..."
    DATABASE_URL="postgresql://postgres:password@localhost:5432/video_conference_dev" npm run db:seed
    
    echo "✅ Development environment setup complete!"
    echo ""
    echo "📋 Next steps:"
    echo "  • Run 'npm run dev' to start the development server"
    echo "  • Visit http://localhost:8081/health to check server status"
    echo "  • Run 'npx prisma studio' to view database data"
    echo "  • The database is running on localhost:5432"
    echo ""
    echo "📊 Demo credentials:"
    echo "  • Super Admin: admin@videoconf.local / admin123"
    echo "  • Demo User: john.doe@videoconf.local / demo123"
    echo "  • Demo User: jane.smith@videoconf.local / demo123"
    echo "  • Moderator: moderator@videoconf.local / demo123"
    
else
    echo "❌ Docker not found. Please install Docker and Docker Compose for development setup."
    echo "Alternatively, set up PostgreSQL manually and update the .env.local file."
    exit 1
fi