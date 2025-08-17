#!/bin/bash

# Video Conference Production Deployment Script
set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="video-conference"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups"
LOG_FILE="./deployment.log"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

echo -e "${BLUE}🚀 Starting Video Conference Production Deployment${NC}"
echo "================================================="

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"
log "Starting production deployment prerequisites check"

# Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Running as root. Consider using a dedicated deployment user.${NC}"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    log "ERROR: Docker is not running"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose and try again.${NC}"
    log "ERROR: Docker Compose is not installed"
    exit 1
fi

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Production environment file $ENV_FILE not found.${NC}"
    echo -e "${YELLOW}💡 Please create $ENV_FILE with production configuration.${NC}"
    log "ERROR: Production environment file not found"
    exit 1
fi

# Validate critical environment variables
echo -e "${YELLOW}🔐 Validating environment configuration...${NC}"

# Source the environment file to check variables
set -a
source "$ENV_FILE"
set +a

critical_vars=(
    "DATABASE_URL"
    "JWT_SECRET"
    "JWT_REFRESH_SECRET"
    "COOKIE_SECRET"
)

missing_vars=()
for var in "${critical_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing critical environment variables:${NC}"
    for var in "${missing_vars[@]}"; do
        echo -e "${RED}   - $var${NC}"
    done
    log "ERROR: Missing critical environment variables: ${missing_vars[*]}"
    exit 1
fi

# Check for default/insecure values
insecure_patterns=(
    "CHANGE_THIS"
    "your-"
    "example"
    "dev-"
    "test-"
    "12345"
)

insecure_vars=()
for var in "${critical_vars[@]}"; do
    value="${!var}"
    for pattern in "${insecure_patterns[@]}"; do
        if [[ "$value" == *"$pattern"* ]]; then
            insecure_vars+=("$var")
            break
        fi
    done
done

if [ ${#insecure_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ Insecure/default values detected in:${NC}"
    for var in "${insecure_vars[@]}"; do
        echo -e "${RED}   - $var${NC}"
    done
    echo -e "${YELLOW}💡 Please update these variables with secure production values.${NC}"
    log "ERROR: Insecure/default values detected: ${insecure_vars[*]}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites and security check passed${NC}"
log "Prerequisites and security check passed"

# Create backup of current deployment
if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-prod" ps -q > /dev/null 2>&1; then
    echo -e "${YELLOW}💾 Creating backup of current deployment...${NC}"
    
    backup_timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="$BACKUP_DIR/backup_$backup_timestamp.tar.gz"
    
    # Export current containers and volumes
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-prod" exec -T video-conference-backend-prod pg_dump "$DATABASE_URL" > "$BACKUP_DIR/db_backup_$backup_timestamp.sql" || true
    
    # Create deployment backup
    tar -czf "$backup_file" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=dist \
        . || true
    
    echo -e "${GREEN}✅ Backup created: $backup_file${NC}"
    log "Backup created: $backup_file"
fi

# Build and deploy
echo -e "${YELLOW}🔨 Building production images...${NC}"
log "Starting production image build"

# Build images with production target
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-prod" build --no-cache

# Tag images for deployment
docker tag video-conference-backend:latest video-conference-backend:$(date +%Y%m%d_%H%M%S)

echo -e "${GREEN}✅ Production images built${NC}"
log "Production images built successfully"

# Deploy with rolling update strategy
echo -e "${YELLOW}🚀 Deploying production services...${NC}"
log "Starting production service deployment"

# Start infrastructure services first
echo -e "${YELLOW}🏗️ Starting infrastructure services...${NC}"
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-prod" up -d \
    redis \
    prometheus \
    grafana \
    traefik

# Wait for infrastructure to be ready
echo -e "${YELLOW}⏳ Waiting for infrastructure services...${NC}"
sleep 30

# Start application services
echo -e "${YELLOW}🏗️ Starting application services...${NC}"
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-prod" up -d \
    video-conference-backend \
    nginx

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"

# Function to check service health with retries
check_service_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=60  # 5 minutes
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if [ -n "$health_url" ]; then
            # Use HTTP health check if URL provided
            if curl -f -s "$health_url" > /dev/null; then
                echo -e "${GREEN}✅ $service_name is healthy${NC}"
                log "$service_name is healthy"
                return 0
            fi
        else
            # Use Docker health check
            if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-prod" ps "$service_name" | grep -q "healthy\|Up"; then
                echo -e "${GREEN}✅ $service_name is healthy${NC}"
                log "$service_name is healthy"
                return 0
            fi
        fi
        
        echo -e "${YELLOW}⏳ Waiting for $service_name (attempt $attempt/$max_attempts)...${NC}"
        sleep 5
        ((attempt++))
    done
    
    echo -e "${RED}❌ $service_name failed to become healthy${NC}"
    log "ERROR: $service_name failed to become healthy"
    return 1
}

# Check critical services
check_service_health "redis" || exit 1
check_service_health "video-conference-backend" "http://localhost:8081/health" || exit 1
check_service_health "nginx" "http://localhost/health" || exit 1

# Run database migrations
echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
log "Running database migrations"

docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-prod" exec -T video-conference-backend-prod npm run db:generate
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-prod" exec -T video-conference-backend-prod npm run db:push

echo -e "${GREEN}✅ Database migrations completed${NC}"
log "Database migrations completed"

# Validate deployment
echo -e "${YELLOW}🔍 Validating deployment...${NC}"
log "Starting deployment validation"

# Test critical endpoints
critical_endpoints=(
    "http://localhost/health"
    "http://localhost/api/auth/status"
)

for endpoint in "${critical_endpoints[@]}"; do
    if curl -f -s "$endpoint" > /dev/null; then
        echo -e "${GREEN}✅ $endpoint is responding${NC}"
        log "$endpoint is responding"
    else
        echo -e "${RED}❌ $endpoint is not responding${NC}"
        log "ERROR: $endpoint is not responding"
        
        # Show logs for debugging
        echo -e "${YELLOW}📋 Showing recent logs:${NC}"
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-prod" logs --tail=50
        exit 1
    fi
done

# Performance check
echo -e "${YELLOW}⚡ Running performance check...${NC}"
response_time=$(curl -w "%{time_total}" -s -o /dev/null http://localhost/health)
if (( $(echo "$response_time < 2.0" | bc -l) )); then
    echo -e "${GREEN}✅ Response time: ${response_time}s (good)${NC}"
    log "Performance check passed: ${response_time}s"
else
    echo -e "${YELLOW}⚠️  Response time: ${response_time}s (consider optimization)${NC}"
    log "Performance check warning: ${response_time}s"
fi

# Show final status
echo -e "${YELLOW}📊 Final Service Status:${NC}"
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME-prod" ps

# Cleanup old images
echo -e "${YELLOW}🧹 Cleaning up old images...${NC}"
docker image prune -f
docker system prune -f --volumes

# Success summary
echo -e "${GREEN}🎉 Production deployment completed successfully!${NC}"
echo "================================================="
log "Production deployment completed successfully"

echo -e "${BLUE}📍 Production Service URLs:${NC}"
echo "  🖥️  Application:          https://your-domain.com"
echo "  🏥  Health Check:         https://your-domain.com/health"
echo "  🔧  API:                  https://api.your-domain.com"
echo "  📊  Monitoring:           https://monitoring.your-domain.com"
echo "  🚦  Traefik Dashboard:    https://traefik.your-domain.com"
echo ""
echo -e "${YELLOW}🔧 Management Commands:${NC}"
echo "  📋  View logs:            docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME-prod logs -f"
echo "  🛑  Stop services:        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME-prod down"
echo "  🔄  Rolling restart:      docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME-prod restart video-conference-backend"
echo "  💾  Create backup:        ./scripts/backup-prod.sh"
echo "  📊  View metrics:         curl http://localhost:9091/metrics"
echo ""
echo -e "${BLUE}📋 Post-deployment checklist:${NC}"
echo "  ☐ Verify SSL certificates are working"
echo "  ☐ Check monitoring dashboards"
echo "  ☐ Test critical user flows"
echo "  ☐ Verify backup automation"
echo "  ☐ Update DNS records if needed"
echo "  ☐ Notify stakeholders"
echo ""
echo -e "${GREEN}✨ Production deployment successful! ✨${NC}"