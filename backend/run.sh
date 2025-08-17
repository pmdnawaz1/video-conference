#!/bin/bash

# Video Conference Backend Start Script

set -e

echo "🚀 Starting Video Conference Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📝 Please edit .env file with your configuration"
    else
        echo "❌ .env.example not found. Please create .env file manually."
        exit 1
    fi
fi

# Build the TypeScript project
echo "🔨 Building TypeScript project..."
npm run build

echo "✅ Build completed successfully!"

# Check if we should run in development or production mode
if [ "${NODE_ENV}" = "production" ]; then
    echo "🌐 Starting server in PRODUCTION mode..."
    npm start
else
    echo "🛠️  Starting server in DEVELOPMENT mode..."
    npm run dev
fi