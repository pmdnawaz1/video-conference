#!/bin/bash

# Video Conference Production Backup Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_NAME="video-conference"
BACKUP_DIR="./backups"
RETENTION_DAYS=30
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
LOG_FILE="./backup.log"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

echo -e "${BLUE}💾 Starting Production Backup${NC}"
echo "============================="
log "Starting production backup"

# Backup timestamp
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PREFIX="videoconf_backup_$BACKUP_TIMESTAMP"

# Database backup
echo -e "${YELLOW}🗄️ Backing up database...${NC}"
log "Starting database backup"

DB_BACKUP_FILE="$BACKUP_DIR/${BACKUP_PREFIX}_database.sql"

# Get database URL from environment
if [ -f ".env.production" ]; then
    source .env.production
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not found in environment${NC}"
    log "ERROR: DATABASE_URL not found"
    exit 1
fi

# Create database dump
docker-compose -f docker-compose.prod.yml -p "$PROJECT_NAME-prod" exec -T video-conference-backend-prod \
    pg_dump "$DATABASE_URL" > "$DB_BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database backup completed: $DB_BACKUP_FILE${NC}"
    log "Database backup completed: $DB_BACKUP_FILE"
    
    # Compress database backup
    gzip "$DB_BACKUP_FILE"
    DB_BACKUP_FILE="${DB_BACKUP_FILE}.gz"
    echo -e "${GREEN}✅ Database backup compressed: $DB_BACKUP_FILE${NC}"
    log "Database backup compressed: $DB_BACKUP_FILE"
else
    echo -e "${RED}❌ Database backup failed${NC}"
    log "ERROR: Database backup failed"
    exit 1
fi

# Volume backups
echo -e "${YELLOW}📁 Backing up Docker volumes...${NC}"
log "Starting volume backups"

VOLUMES_BACKUP_FILE="$BACKUP_DIR/${BACKUP_PREFIX}_volumes.tar.gz"

# Get list of volumes
VOLUMES=$(docker volume ls --filter name="${PROJECT_NAME}-prod" --format "{{.Name}}")

if [ ! -z "$VOLUMES" ]; then
    # Create temporary container to backup volumes
    docker run --rm \
        $(echo "$VOLUMES" | sed 's/^/-v /' | sed 's/$/:\/backup\/&/') \
        -v "$PWD/$BACKUP_DIR:/host_backup" \
        alpine:latest \
        sh -c "cd /backup && tar czf /host_backup/$(basename $VOLUMES_BACKUP_FILE) ."
    
    echo -e "${GREEN}✅ Volume backup completed: $VOLUMES_BACKUP_FILE${NC}"
    log "Volume backup completed: $VOLUMES_BACKUP_FILE"
else
    echo -e "${YELLOW}⚠️  No volumes found to backup${NC}"
    log "No volumes found to backup"
fi

# Configuration backup
echo -e "${YELLOW}⚙️ Backing up configuration...${NC}"
log "Starting configuration backup"

CONFIG_BACKUP_FILE="$BACKUP_DIR/${BACKUP_PREFIX}_config.tar.gz"

# Backup configuration files (excluding sensitive data)
tar czf "$CONFIG_BACKUP_FILE" \
    --exclude='.env*' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='backups' \
    --exclude='*.log' \
    docker-compose*.yml \
    config/ \
    scripts/ \
    package*.json \
    Dockerfile \
    prisma/ \
    src/ || true

echo -e "${GREEN}✅ Configuration backup completed: $CONFIG_BACKUP_FILE${NC}"
log "Configuration backup completed: $CONFIG_BACKUP_FILE"

# Application logs backup
echo -e "${YELLOW}📋 Backing up application logs...${NC}"
log "Starting logs backup"

LOGS_BACKUP_FILE="$BACKUP_DIR/${BACKUP_PREFIX}_logs.tar.gz"

# Export container logs
docker-compose -f docker-compose.prod.yml -p "$PROJECT_NAME-prod" logs --no-color > "$BACKUP_DIR/container_logs_$BACKUP_TIMESTAMP.log"

# Backup logs directory and container logs
tar czf "$LOGS_BACKUP_FILE" \
    -C "$BACKUP_DIR" \
    "container_logs_$BACKUP_TIMESTAMP.log" \
    2>/dev/null || true

# Cleanup temporary log file
rm -f "$BACKUP_DIR/container_logs_$BACKUP_TIMESTAMP.log"

echo -e "${GREEN}✅ Logs backup completed: $LOGS_BACKUP_FILE${NC}"
log "Logs backup completed: $LOGS_BACKUP_FILE"

# Create manifest file
echo -e "${YELLOW}📋 Creating backup manifest...${NC}"
log "Creating backup manifest"

MANIFEST_FILE="$BACKUP_DIR/${BACKUP_PREFIX}_manifest.txt"

cat > "$MANIFEST_FILE" << EOF
Video Conference Backup Manifest
==============================
Backup Date: $(date)
Backup Timestamp: $BACKUP_TIMESTAMP

Files in this backup:
- Database: ${BACKUP_PREFIX}_database.sql.gz
- Volumes: ${BACKUP_PREFIX}_volumes.tar.gz
- Configuration: ${BACKUP_PREFIX}_config.tar.gz
- Logs: ${BACKUP_PREFIX}_logs.tar.gz

System Information:
- Docker Version: $(docker --version)
- Docker Compose Version: $(docker-compose --version)
- System: $(uname -a)

Service Status at Backup Time:
$(docker-compose -f docker-compose.prod.yml -p "$PROJECT_NAME-prod" ps)

EOF

echo -e "${GREEN}✅ Backup manifest created: $MANIFEST_FILE${NC}"
log "Backup manifest created: $MANIFEST_FILE"

# Upload to S3 if configured
if [ ! -z "$S3_BUCKET" ]; then
    echo -e "${YELLOW}☁️ Uploading to S3...${NC}"
    log "Starting S3 upload"
    
    # Check if AWS CLI is available
    if command -v aws > /dev/null 2>&1; then
        # Upload all backup files
        for file in "$BACKUP_DIR"/${BACKUP_PREFIX}_*; do
            if [ -f "$file" ]; then
                aws s3 cp "$file" "s3://$S3_BUCKET/backups/$(basename $file)"
                echo -e "${GREEN}✅ Uploaded: $(basename $file)${NC}"
                log "Uploaded to S3: $(basename $file)"
            fi
        done
    else
        echo -e "${YELLOW}⚠️  AWS CLI not found, skipping S3 upload${NC}"
        log "AWS CLI not found, skipping S3 upload"
    fi
fi

# Cleanup old backups
echo -e "${YELLOW}🧹 Cleaning up old backups...${NC}"
log "Cleaning up old backups"

# Remove local backups older than retention period
find "$BACKUP_DIR" -name "videoconf_backup_*" -type f -mtime +$RETENTION_DAYS -delete

# Remove old backups from S3 if configured
if [ ! -z "$S3_BUCKET" ] && command -v aws > /dev/null 2>&1; then
    CUTOFF_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)
    aws s3 ls "s3://$S3_BUCKET/backups/" | while read -r line; do
        backup_date=$(echo "$line" | grep -o 'videoconf_backup_[0-9]\{8\}' | head -1 | cut -d'_' -f3)
        if [ ! -z "$backup_date" ] && [ "$backup_date" -lt "$CUTOFF_DATE" ]; then
            backup_file=$(echo "$line" | awk '{print $4}')
            aws s3 rm "s3://$S3_BUCKET/backups/$backup_file"
            echo -e "${GREEN}✅ Removed old S3 backup: $backup_file${NC}"
            log "Removed old S3 backup: $backup_file"
        fi
    done
fi

# Calculate backup sizes
echo -e "${YELLOW}📊 Backup Summary:${NC}"
echo "=================="

total_size=0
for file in "$BACKUP_DIR"/${BACKUP_PREFIX}_*; do
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
        human_size=$(numfmt --to=iec --suffix=B $size 2>/dev/null || echo "${size}B")
        echo -e "${BLUE}  $(basename "$file"): $human_size${NC}"
        total_size=$((total_size + size))
    fi
done

total_human_size=$(numfmt --to=iec --suffix=B $total_size 2>/dev/null || echo "${total_size}B")
echo -e "${GREEN}  Total backup size: $total_human_size${NC}"

echo -e "${GREEN}🎉 Backup completed successfully!${NC}"
echo "================================="
log "Backup completed successfully - Total size: $total_human_size"

echo -e "${BLUE}📍 Backup Location:${NC}"
echo "  📁 Local: $BACKUP_DIR"
if [ ! -z "$S3_BUCKET" ]; then
    echo "  ☁️  S3: s3://$S3_BUCKET/backups/"
fi

echo ""
echo -e "${YELLOW}🔧 Restore Commands:${NC}"
echo "  🗄️  Database: gunzip -c $DB_BACKUP_FILE | docker-compose exec -T postgres psql -U postgres -d video_conference_prod"
echo "  📁 Volumes: docker run --rm -v videoconf_volume:/backup -v $PWD/$BACKUP_DIR:/host_backup alpine sh -c 'cd /backup && tar xzf /host_backup/$(basename $VOLUMES_BACKUP_FILE)'"
echo ""
echo -e "${GREEN}✨ Backup complete! ✨${NC}"