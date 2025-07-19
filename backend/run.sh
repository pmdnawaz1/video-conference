#!/bin/bash

# Video Conference Backend Runner

echo "🚀 Starting Video Conference Backend..."

# Check if go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
go mod tidy

# Build the server
echo "🔨 Building server..."
go build -o video-server .

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "🌐 Starting server on http://localhost:8081"
    echo "🔌 WebSocket available at ws://localhost:8081/ws"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo "----------------------------------------"
    
    # Run the server
    ./video-server
else
    echo "❌ Build failed!"
    exit 1
fi