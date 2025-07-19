# Environment Variables Setup Guide

This guide explains how to configure environment variables for the Enterprise Video Platform using separate `.env` files for different environments.

## Overview

The application uses separate environment files for different deployment scenarios:

- **Local Development**: Uses `.env.local` files for hot-reload development
- **Development/Staging**: Uses `.env.dev` files for staging environments
- **Production**: Uses `.env` files for production deployment

## File Structure

```
enterprise-video-platform/
├── backend/
│   ├── .env.example        # Template for all environments
│   ├── .env.local          # Local development
│   ├── .env.dev            # Development/staging
│   └── .env                # Production (create manually)
├── frontend/
│   ├── .env.example        # Template for all environments
│   ├── .env.local          # Local development
│   ├── .env.dev            # Development/staging
│   └── .env                # Production (create manually)
└── docker-compose files use env_file directive to load these
```

## Backend Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ENV` | Environment name | `local`, `development`, `production` |
| `DB_HOST` | PostgreSQL host | `localhost` or `your-db-host.com` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `enterprise_video_platform` |
| `DB_USER` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `your-secure-password` |
| `DB_SSLMODE` | SSL mode | `disable` (local), `require` (production) |
| `JWT_SECRET` | JWT signing secret | Generate with `openssl rand -base64 32` |
| `SMTP_HOST` | Email server host | `smtp.gmail.com` |
| `SMTP_PORT` | Email server port | `587` |
| `SMTP_USER` | Email username | `your-email@gmail.com` |
| `SMTP_PASSWORD` | Email password | `your-app-password` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:5173` or `*` |
| `PORT` | Application port | `8081` |

### Backend .env.local (Local Development)

```env
ENV=local
DB_HOST=localhost
DB_PORT=5432
DB_NAME=enterprise_video_platform
DB_USER=postgres
DB_PASSWORD=password
DB_SSLMODE=disable
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
PORT=8081
```

### Backend .env.dev (Development/Staging)

```env
ENV=development
DB_HOST=your-postgres-host.com
DB_PORT=5432
DB_NAME=enterprise_video_platform
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SSLMODE=require
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
CORS_ORIGINS=*
PORT=8081
```

## Frontend Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `development`, `production` |
| `VITE_API_URL` | Backend API URL | `http://localhost:8081` |
| `VITE_WS_URL` | WebSocket URL | `ws://localhost:8081` |
| `VITE_DEV_MODE` | Development mode flag | `true`, `false` |
| `VITE_DEBUG` | Debug mode flag | `true`, `false` |

### Frontend .env.local (Local Development)

```env
NODE_ENV=development
VITE_API_URL=http://localhost:8081
VITE_WS_URL=ws://localhost:8081
VITE_DEV_MODE=true
VITE_DEBUG=true
```

### Frontend .env.dev (Development/Staging)

```env
NODE_ENV=production
VITE_API_URL=http://your-backend-domain.com:8081
VITE_WS_URL=ws://your-backend-domain.com:8081
VITE_DEV_MODE=false
VITE_DEBUG=false
```

## Setup Instructions

### 1. Initial Setup

```bash
# Navigate to project directory
cd enterprise-video-platform

# Copy example files for local development
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local

# Copy example files for development environment
cp backend/.env.example backend/.env.dev
cp frontend/.env.example frontend/.env.dev
```

### 2. Configure Local Development

Edit `backend/.env.local`:
```bash
# Use your local PostgreSQL or hosted database
DB_HOST=localhost  # or your hosted DB
DB_PASSWORD=your-local-password
JWT_SECRET=$(openssl rand -base64 32)
```

Edit `frontend/.env.local`:
```bash
# Usually no changes needed for local development
# API URLs point to local backend
```

### 3. Configure Development Environment

Edit `backend/.env.dev`:
```bash
# Use your hosted PostgreSQL database
DB_HOST=your-postgres-host.com
DB_USER=your_db_user
DB_PASSWORD=your_secure_password
DB_SSLMODE=require
JWT_SECRET=$(openssl rand -base64 32)
```

Edit `frontend/.env.dev`:
```bash
# Point to your development backend
VITE_API_URL=http://your-backend-domain.com:8081
VITE_WS_URL=ws://your-backend-domain.com:8081
```

## Docker Compose Integration

### How env_file Works

Each Docker Compose file uses the `env_file` directive to load environment variables:

```yaml
services:
  backend:
    build: .
    env_file:
      - .env.local  # Loads all variables from this file
    # No need to specify individual environment variables
```

### Local Development

```bash
# Uses backend/.env.local and frontend/.env.local
docker-compose -f docker-compose.local.yml up -d
```

### Development Environment

```bash
# Uses backend/.env.dev and frontend/.env.dev
docker-compose -f docker-compose.dev.yml up -d
```

## Security Best Practices

### 1. Environment File Security

- **Never commit `.env` files to version control**
- Add to `.gitignore`:
  ```
  .env
  .env.local
  .env.dev
  .env.production
  ```

### 2. JWT Secret Generation

Generate secure JWT secrets:
```bash
# Generate a new secret
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Database Security

- Use strong passwords
- Enable SSL for production (`DB_SSLMODE=require`)
- Restrict database access by IP
- Use connection pooling

### 4. SMTP Security

- Use app-specific passwords for Gmail
- Consider using OAuth2 for production
- Restrict SMTP access by IP if possible

## Troubleshooting

### Common Issues

#### 1. Environment Variables Not Loading

```bash
# Check if file exists
ls -la backend/.env.local

# Check file contents (be careful with sensitive data)
cat backend/.env.local

# Verify Docker Compose syntax
docker-compose -f docker-compose.local.yml config
```

#### 2. Database Connection Issues

```bash
# Test database connection
docker run --rm -it postgres:13 psql -h your-host -U your-user -d your-database

# Check environment variables in container
docker-compose exec backend env | grep DB_
```

#### 3. CORS Issues

```bash
# Check CORS configuration
docker-compose exec backend env | grep CORS

# Update CORS_ORIGINS in backend/.env.local
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:80
```

### Debugging Environment Variables

#### View Loaded Variables

```bash
# Check what variables are loaded in containers
docker-compose exec backend env
docker-compose exec frontend env
```

#### Validate Configuration

```bash
# Test backend health endpoint
curl http://localhost:8081/health

# Check backend logs for environment issues
docker-compose logs backend | grep -i env
```

## Environment-Specific Configurations

### Local Development Features

- Hot reload enabled
- Debug logging
- Relaxed CORS
- Local database connections
- Development SMTP settings

### Development/Staging Features

- Production builds
- Health checks
- Hosted database connections
- Production-like CORS
- Real SMTP configuration

### Production Features (when you create .env files)

- Optimized builds
- Strict security settings
- SSL/TLS enforcement
- Monitoring and logging
- Backup configurations

## Quick Reference Commands

```bash
# Start local development
./scripts/start-local.sh

# Start development environment
./scripts/start-dev.sh

# View environment-specific logs
docker-compose -f docker-compose.local.yml logs -f
docker-compose -f docker-compose.dev.yml logs -f

# Update environment and restart
docker-compose -f docker-compose.local.yml restart

# Check loaded environment variables
docker-compose exec backend env | grep -E "(DB_|JWT_|SMTP_)"
```

This setup provides clean separation of environment configurations while maintaining security and ease of deployment across different environments.

