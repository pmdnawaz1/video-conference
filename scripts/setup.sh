#!/bin/bash

# Video Conference Platform Setup Script
# This script sets up the development environment

set -e  # Exit on any error

echo "🚀 Setting up Video Conference Platform..."

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

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -c2-3)
    if [ "$NODE_VERSION" -lt "18" ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node --version)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL is not installed. Please install PostgreSQL 14 or higher."
        exit 1
    fi
    
    print_success "Prerequisites check passed!"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    npm install
    
    # Install backend dependencies
    print_status "Installing backend dependencies..."
    cd backend && npm install && cd ..
    
    # Install frontend dependencies
    print_status "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    
    print_success "Dependencies installed!"
}

# Setup environment files
setup_environment() {
    print_status "Setting up environment files..."
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.example" ]; then
            cp backend/.env.example backend/.env
            print_status "Created backend/.env from .env.example"
            print_status "Please edit backend/.env with your database credentials and other settings"
        else
            print_status "Creating backend/.env file..."
            cat > backend/.env << EOF
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/video_conference"

# Authentication
JWT_SECRET="your-jwt-secret-change-this-in-production"
JWT_REFRESH_SECRET="your-refresh-secret-change-this-in-production"

# Email Configuration (optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# File Upload
UPLOAD_DIR="uploads"
MAX_FILE_SIZE=10485760

# Application
NODE_ENV="development"
PORT=8181
FRONTEND_URL="http://localhost:5173"
COMPANY_NAME="Video Conference Platform"
SUPPORT_EMAIL="support@localhost"

# WebRTC (Optional)
STUN_SERVERS="stun:stun.l.google.com:19302"
EOF
        fi
    else
        print_status "Backend .env file already exists"
    fi
    
    print_success "Environment setup complete!"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Check if database exists
    DB_EXISTS=$(psql -lqt | cut -d \| -f 1 | grep -w video_conference | wc -l)
    
    if [ $DB_EXISTS -eq 0 ]; then
        print_status "Creating database..."
        createdb video_conference || {
            print_error "Failed to create database. Make sure PostgreSQL is running and you have permissions."
            print_status "You can create the database manually: createdb video_conference"
        }
    else
        print_status "Database already exists"
    fi
    
    # Generate Prisma client and push schema
    print_status "Setting up database schema..."
    cd backend
    npx prisma generate
    npx prisma db push
    
    # Seed database (optional)
    read -p "Do you want to seed the database with sample data? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm run db:seed
        print_success "Database seeded with sample data!"
    fi
    
    cd ..
    print_success "Database setup complete!"
}

# Build applications
build_applications() {
    print_status "Building applications..."
    
    # Build backend
    print_status "Building backend..."
    cd backend && npm run build && cd ..
    
    print_success "Applications built successfully!"
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p backend/uploads
    mkdir -p backend/recordings
    mkdir -p backend/logs
    
    print_success "Directories created!"
}

# Main setup function
main() {
    echo "=================================="
    echo "🎥 Video Conference Platform Setup"
    echo "=================================="
    echo
    
    check_prerequisites
    install_dependencies
    setup_environment
    create_directories
    
    # Ask if user wants to setup database
    read -p "Do you want to setup the database now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_database
    else
        print_status "Database setup skipped. Run 'npm run db:setup' when ready."
    fi
    
    # Ask if user wants to build
    read -p "Do you want to build the applications now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        build_applications
    else
        print_status "Build skipped. Run 'npm run build' when ready."
    fi
    
    echo
    print_success "Setup complete! 🎉"
    echo
    echo "Next steps:"
    echo "1. Edit backend/.env with your configuration"
    echo "2. Start the development server: npm run dev"
    echo "3. Open http://localhost:5173 in your browser"
    echo
    echo "Useful commands:"
    echo "- npm run dev          # Start development servers"
    echo "- npm run build        # Build for production"
    echo "- npm run test         # Run tests"
    echo "- npm run db:studio    # Open database studio"
    echo
}

# Run main function
main "$@"