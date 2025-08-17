# Multi-stage build for production optimization
FROM node:20-alpine AS base

# Install dependencies for building native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS dev
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 8081
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

# Production stage
FROM node:20-alpine AS production

# Create app user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 videoconf

WORKDIR /app

# Copy built application
COPY --from=build --chown=videoconf:nodejs /app/dist ./dist
COPY --from=build --chown=videoconf:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=videoconf:nodejs /app/package*.json ./
COPY --from=build --chown=videoconf:nodejs /app/prisma ./prisma

# Switch to non-root user
USER videoconf

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8081/health', (res) => { \
    res.statusCode === 200 ? process.exit(0) : process.exit(1) \
  }).on('error', () => process.exit(1))"

EXPOSE 8081

CMD ["npm", "start"]