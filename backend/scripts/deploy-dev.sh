#!/bin/bash

# Video Conference Development Deployment Script
set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="video-conference"
COMPOSE_FILE="docker-compose.dev.yml"
ENV_FILE=".env.dev"

echo -e "${BLUE}🚀 Starting Video Conference Development Deployment${NC}"
echo "=================================="

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose and try again.${NC}"
    exit 1
fi

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file $ENV_FILE not found.${NC}"
    echo -e "${YELLOW}💡 Copying from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example "$ENV_FILE"
        echo -e "${GREEN}✅ Created $ENV_FILE from example${NC}"
    else
        echo -e "${RED}❌ .env.example not found. Please create $ENV_FILE manually.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Build and start services
echo -e "${YELLOW}🔨 Building and starting services...${NC}"

# Stop any existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-dev" down --remove-orphans

# Build images
echo -e "${YELLOW}🏗️ Building Docker images...${NC}"
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-dev" build --no-cache

# Start services in background
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-dev" up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"

# Function to check service health
check_service_health() {
    local service_name=$1
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-dev" ps "$service_name" | grep -q "healthy\|Up"; then
            echo -e "${GREEN}✅ $service_name is healthy${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ Waiting for $service_name (attempt $attempt/$max_attempts)...${NC}"
        sleep 5
        ((attempt++))
    done
    
    echo -e "${RED}❌ $service_name failed to become healthy${NC}"
    return 1
}

# Check health of critical services
check_service_health "postgres" || exit 1
check_service_health "redis" || exit 1

# Wait a bit more for the backend to initialize
echo -e "${YELLOW}⏳ Waiting for backend to initialize...${NC}"
sleep 15

# Check backend health endpoint
echo -e "${YELLOW}🔍 Checking backend health...${NC}"
max_attempts=10
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -f -s http://localhost:8081/health > /dev/null; then
        echo -e "${GREEN}✅ Backend is healthy and responding${NC}"
        break
    fi
    
    echo -e "${YELLOW}⏳ Waiting for backend health check (attempt $attempt/$max_attempts)...${NC}"
    sleep 5
    ((attempt++))
    
    if [ $attempt -gt $max_attempts ]; then
        echo -e "${RED}❌ Backend health check failed${NC}"
        echo -e "${YELLOW}📋 Showing backend logs:${NC}"
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-dev" logs --tail=20 video-conference-backend
        exit 1
    fi
done

# Run database migrations and seeding
echo -e "${YELLOW}🗄️ Running database setup...${NC}"
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-dev" exec -T video-conference-backend npm run db:generate
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-dev" exec -T video-conference-backend npm run db:push

# Show service status
echo -e "${YELLOW}📊 Service Status:${NC}"
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-dev" ps

# Show useful URLs
echo -e "${GREEN}🎉 Development deployment completed successfully!${NC}"
echo "=================================="
echo -e "${BLUE}📍 Service URLs:${NC}"
echo "  🖥️  Backend API:          http://localhost:8081"
echo "  🏥  Health Check:         http://localhost:8081/health"
echo "  🗄️  Database:             localhost:5432"
echo "  📨  Redis:                localhost:6379"
echo "  📧  MailHog UI:           http://localhost:8025"
echo "  📊  Prometheus:           http://localhost:9091"
echo "  📈  Grafana:              http://localhost:3001 (admin/admin)"
echo ""
echo -e "${YELLOW}🔧 Useful Commands:${NC}"
echo "  📋  View logs:            docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME-dev logs -f"
echo "  🛑  Stop services:        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME-dev down"
echo "  🔄  Restart backend:      docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME-dev restart video-conference-backend"
echo "  🗄️  Database studio:       docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME-dev exec video-conference-backend npm run db:studio"
echo ""
echo -e "${GREEN}✨ Happy coding! ✨${NC}"