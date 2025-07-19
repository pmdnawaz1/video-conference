# Docker Setup Guide for Enterprise Video Platform

This guide provides comprehensive instructions for setting up and running the Enterprise Video Platform using Docker containers for both local development and production deployment.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- Docker Engine (version 20.10 or later)
- Docker Compose (version 2.0 or later)
- Git (for cloning the repository)
- A hosted PostgreSQL database (we recommend AWS RDS, Google Cloud SQL, or similar)

## Project Structure

The dockerized application consists of two main services:

```
enterprise-video-platform/
├── backend/                 # Go backend service
│   ├── Dockerfile          # Production Dockerfile
│   ├── docker-compose.local.yml
│   ├── docker-compose.dev.yml
│   └── .env.example
├── frontend/               # React frontend service
│   ├── Dockerfile         # Production Dockerfile
│   ├── Dockerfile.dev     # Development Dockerfile
│   ├── nginx.conf         # Nginx configuration
│   ├── docker-compose.local.yml
│   ├── docker-compose.dev.yml
│   └── .env.example
├── docker-compose.yml     # Main production compose file
├── docker-compose.local.yml # Local development compose file
└── .env.example          # Main environment variables
```

## Environment Configuration

### 1. Copy Environment Files

First, copy the example environment files and configure them for your setup:

```bash
# Main environment file
cp .env.example .env

# Backend environment file
cp backend/.env.example backend/.env

# Frontend environment file
cp frontend/.env.example frontend/.env
```

### 2. Configure Database Connection

Edit the `.env` file and configure your hosted PostgreSQL database:

```env
# Database Configuration (Hosted PostgreSQL)
DB_HOST=your-postgres-host.com
DB_PORT=5432
DB_NAME=enterprise_video_platform
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SSLMODE=require
```

### 3. Configure JWT Secret

Generate a secure JWT secret for authentication:

```bash
# Generate a random JWT secret
openssl rand -base64 32
```

Add this to your `.env` file:

```env
JWT_SECRET=your-generated-secret-here
```

### 4. Configure Email Settings

For email notifications, configure your SMTP settings:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Database Setup

Before running the application, you need to set up your PostgreSQL database schema:

### 1. Connect to Your Database

Use your preferred PostgreSQL client (psql, pgAdmin, etc.) to connect to your hosted database.

### 2. Create the Database Schema

Execute the SQL schema file to create all necessary tables:

```sql
-- Run the contents of database/schema.sql
-- This will create all tables, indexes, and constraints
```

### 3. Verify Schema Creation

Ensure all tables are created successfully:

```sql
\dt  -- List all tables
```

You should see tables for clients, users, groups, meetings, invitations, etc.

## Running the Application

### Local Development (with Hot Reload)

For local development with hot reload capabilities:

```bash
# Start both backend and frontend in development mode
docker-compose -f docker-compose.local.yml up -d

# View logs
docker-compose -f docker-compose.local.yml logs -f

# Stop services
docker-compose -f docker-compose.local.yml down
```

This will start:
- Backend on `http://localhost:8081`
- Frontend on `http://localhost:5173`

### Production Deployment

For production deployment:

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

This will start:
- Backend on `http://localhost:8081`
- Frontend on `http://localhost:80`

### Individual Service Management

You can also run services individually:

#### Backend Only

```bash
# Local development
cd backend
docker-compose -f docker-compose.local.yml up -d

# Production
cd backend
docker-compose -f docker-compose.dev.yml up -d
```

#### Frontend Only

```bash
# Local development
cd frontend
docker-compose -f docker-compose.local.yml up -d

# Production
cd frontend
docker-compose -f docker-compose.dev.yml up -d
```

## Health Checks and Monitoring

The application includes health checks for both services:

### Backend Health Check

```bash
curl http://localhost:8081/health
```

### Frontend Health Check

```bash
curl http://localhost:80
```

### Docker Health Status

```bash
# Check health status of all services
docker-compose ps

# View detailed health information
docker inspect <container_name> | grep -A 10 Health
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Issues

If you encounter database connection errors:

```bash
# Check if database credentials are correct
docker-compose logs backend | grep -i database

# Test database connection manually
docker run --rm -it postgres:13 psql -h your-host -U your-user -d your-database
```

#### 2. Port Conflicts

If ports are already in use:

```bash
# Check what's using the ports
netstat -tulpn | grep :8081
netstat -tulpn | grep :80

# Modify port mappings in docker-compose.yml if needed
```

#### 3. Build Issues

If Docker builds fail:

```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

#### 4. Permission Issues

If you encounter permission issues:

```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Ensure Docker daemon is running
sudo systemctl status docker
```

### Debugging

#### View Container Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

#### Execute Commands in Containers

```bash
# Access backend container
docker-compose exec backend sh

# Access frontend container
docker-compose exec frontend sh
```

#### Monitor Resource Usage

```bash
# View resource usage
docker stats

# View detailed container information
docker-compose ps
```

## Scaling and Performance

### Horizontal Scaling

To scale services horizontally:

```bash
# Scale backend to 3 instances
docker-compose up -d --scale backend=3

# Scale with load balancer (requires additional configuration)
```

### Resource Limits

Configure resource limits in docker-compose.yml:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

## Security Considerations

### 1. Environment Variables

- Never commit `.env` files to version control
- Use Docker secrets for sensitive data in production
- Rotate JWT secrets regularly

### 2. Network Security

- Use Docker networks to isolate services
- Configure firewall rules appropriately
- Use HTTPS in production with proper SSL certificates

### 3. Container Security

- Regularly update base images
- Scan images for vulnerabilities
- Run containers as non-root users when possible

## Backup and Recovery

### Database Backups

Since you're using a hosted PostgreSQL database, follow your provider's backup procedures. For manual backups:

```bash
# Create database backup
pg_dump -h your-host -U your-user -d your-database > backup.sql

# Restore from backup
psql -h your-host -U your-user -d your-database < backup.sql
```

### Application Data

```bash
# Backup application logs
docker-compose logs > application-logs-$(date +%Y%m%d).log

# Backup configuration
tar -czf config-backup-$(date +%Y%m%d).tar.gz .env backend/.env frontend/.env
```

## Maintenance

### Regular Updates

```bash
# Update Docker images
docker-compose pull

# Rebuild and restart services
docker-compose up -d --build

# Clean up unused images
docker image prune -a
```

### Log Rotation

Configure log rotation to prevent disk space issues:

```bash
# Configure Docker daemon log rotation in /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Configure all environment variables
- [ ] Set up hosted PostgreSQL database
- [ ] Configure SMTP settings for email notifications
- [ ] Set up SSL certificates for HTTPS
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Set up automated backups
- [ ] Test disaster recovery procedures
- [ ] Configure load balancing (if needed)
- [ ] Set up CI/CD pipeline

## Support and Documentation

For additional support:

1. Check the application logs for error messages
2. Review the troubleshooting section above
3. Consult the main README.md for application-specific documentation
4. Check Docker and Docker Compose documentation for container-related issues

## Quick Reference Commands

```bash
# Start all services (production)
docker-compose up -d

# Start all services (local development)
docker-compose -f docker-compose.local.yml up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Scale services
docker-compose up -d --scale backend=3

# Health check
curl http://localhost:8081/health
curl http://localhost:80

# Clean up
docker system prune -a
```

This Docker setup provides a robust, scalable foundation for deploying the Enterprise Video Platform in both development and production environments.

