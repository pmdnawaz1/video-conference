#!/bin/bash

# Database backup script for Docker environment
# This script creates automated backups of the PostgreSQL database

set -e

# Configuration
DB_HOST="${DB_HOST:-database}"
DB_NAME="${DB_NAME:-video_conference}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${PGPASSWORD}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
if [ -z "$DB_PASSWORD" ]; then
    print_error "DB_PASSWORD environment variable is not set"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql"

print_status "Starting database backup..."
print_status "Database: $DB_NAME"
print_status "Host: $DB_HOST"
print_status "Backup file: $BACKUP_FILE"

# Create database backup
if pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" --no-password > "$BACKUP_FILE"; then
    print_success "Database backup created successfully: $BACKUP_FILE"
    
    # Compress backup file
    if gzip "$BACKUP_FILE"; then
        print_success "Backup file compressed: ${BACKUP_FILE}.gz"
        BACKUP_FILE="${BACKUP_FILE}.gz"
    fi
    
    # Set proper permissions
    chmod 600 "$BACKUP_FILE"
    
    # Get file size
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    print_status "Backup file size: $FILE_SIZE"
    
else
    print_error "Database backup failed"
    exit 1
fi

# Clean up old backups
print_status "Cleaning up backups older than $RETENTION_DAYS days..."
OLD_BACKUPS=$(find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -type f -mtime +$RETENTION_DAYS)

if [ -n "$OLD_BACKUPS" ]; then
    echo "$OLD_BACKUPS" | while read -r file; do
        rm "$file"
        print_status "Deleted old backup: $(basename "$file")"
    done
else
    print_status "No old backups to clean up"
fi

# List current backups
print_status "Current backups:"
ls -lh "$BACKUP_DIR"/backup_${DB_NAME}_*.sql.gz 2>/dev/null | while read -r line; do
    echo "  $line"
done

print_success "Backup process completed successfully"

# Optional: Upload to cloud storage
if [ -n "$AWS_S3_BUCKET" ]; then
    print_status "Uploading backup to AWS S3..."
    if command -v aws >/dev/null 2>&1; then
        S3_PATH="s3://$AWS_S3_BUCKET/database-backups/$(basename "$BACKUP_FILE")"
        if aws s3 cp "$BACKUP_FILE" "$S3_PATH"; then
            print_success "Backup uploaded to S3: $S3_PATH"
        else
            print_error "Failed to upload backup to S3"
        fi
    else
        print_error "AWS CLI not installed, skipping S3 upload"
    fi
fi

# Optional: Send notification
if [ -n "$WEBHOOK_URL" ]; then
    print_status "Sending backup notification..."
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"Database backup completed successfully\",
            \"attachments\": [{
                \"color\": \"good\",
                \"fields\": [{
                    \"title\": \"Database\",
                    \"value\": \"$DB_NAME\",
                    \"short\": true
                }, {
                    \"title\": \"File Size\",
                    \"value\": \"$FILE_SIZE\",
                    \"short\": true
                }, {
                    \"title\": \"Timestamp\",
                    \"value\": \"$(date)\",
                    \"short\": false
                }]
            }]
        }" || print_error "Failed to send notification"
fi

exit 0