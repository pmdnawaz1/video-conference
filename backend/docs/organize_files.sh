#!/bin/bash

# This script organizes the downloaded files into the correct project structure.
# It assumes all files are in the same directory where this script is executed.

# Define the main project directory
PROJECT_DIR="enterprise-video-platform"

# Create the main project directory and its subdirectories if they don't exist
mkdir -p "$PROJECT_DIR"/{backend,frontend,database,docs,scripts}

echo "Organizing files into $PROJECT_DIR/ ..."

# Move backend files
mv main.go "$PROJECT_DIR"/backend/ 2>/dev/null
mv go.mod "$PROJECT_DIR"/backend/ 2>/dev/null
mv go.sum "$PROJECT_DIR"/backend/ 2>/dev/null
mv handlers "$PROJECT_DIR"/backend/ 2>/dev/null
mv middleware "$PROJECT_DIR"/backend/ 2>/dev/null
mv models "$PROJECT_DIR"/backend/ 2>/dev/null
mv services "$PROJECT_DIR"/backend/ 2>/dev/null
mv config "$PROJECT_DIR"/backend/ 2>/dev/null
mv utils "$PROJECT_DIR"/backend/ 2>/dev/null
mv backend/Dockerfile "$PROJECT_DIR"/backend/ 2>/dev/null
mv backend/.dockerignore "$PROJECT_DIR"/backend/ 2>/dev/null
mv backend/docker-compose.local.yml "$PROJECT_DIR"/backend/ 2>/dev/null
mv backend/docker-compose.dev.yml "$PROJECT_DIR"/backend/ 2>/dev/null
mv backend/.env.example "$PROJECT_DIR"/backend/ 2>/dev/null

# Move frontend files
mv index.html "$PROJECT_DIR"/frontend/ 2>/dev/null
mv src "$PROJECT_DIR"/frontend/ 2>/dev/null
mv package.json "$PROJECT_DIR"/frontend/ 2>/dev/null
mv pnpm-lock.yaml "$PROJECT_DIR"/frontend/ 2>/dev/null
mv frontend/Dockerfile "$PROJECT_DIR"/frontend/ 2>/dev/null
mv frontend/Dockerfile.dev "$PROJECT_DIR"/frontend/ 2>/dev/null
mv frontend/nginx.conf "$PROJECT_DIR"/frontend/ 2>/dev/null
mv frontend/.dockerignore "$PROJECT_DIR"/frontend/ 2>/dev/null
mv frontend/docker-compose.local.yml "$PROJECT_DIR"/frontend/ 2>/dev/null
mv frontend/docker-compose.dev.yml "$PROJECT_DIR"/frontend/ 2>/dev/null
mv frontend/.env.example "$PROJECT_DIR"/frontend/ 2>/dev/null

# Move database schema
mv schema.sql "$PROJECT_DIR"/database/ 2>/dev/null

# Move documentation and root docker files
mv README.md "$PROJECT_DIR"/docs/ 2>/dev/null
mv DOCKER_SETUP.md "$PROJECT_DIR"/docs/ 2>/dev/null
mv docker-compose.yml "$PROJECT_DIR"/ 2>/dev/null
mv docker-compose.local.yml "$PROJECT_DIR"/ 2>/dev/null
mv .env.example "$PROJECT_DIR"/ 2>/dev/null

# Move scripts
mv scripts/start-local.sh "$PROJECT_DIR"/scripts/ 2>/dev/null
mv scripts/start-production.sh "$PROJECT_DIR"/scripts/ 2>/dev/null

echo "File organization complete!"


