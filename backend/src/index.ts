import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config';
import WebRTCSignalingService from './services/webrtcSignalingService';
import { prisma } from './services/prismaService';
import roomRoutes from './routes/roomRoutes';
import authRoutes from './routes/authRoutes';
import meetingRoutes from './routes/meetingRoutes';
import userRoutes from './routes/userRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import adminRoutes from './routes/adminRoutes';
import stunTurnRoutes from './routes/stunTurnRoutes';
import emailRoutes from './routes/emailRoutes';
import invitationRoutes from './routes/invitationRoutes';
import chatRoutes from './routes/chatRoutes';
import reactionsRoutes from './routes/reactionsRoutes';
import { stunTurnService } from './services/stunTurnService';
import { initializeAnalyticsService } from './services/analyticsService';
import { handleAuthErrors, securityHeaders } from './middleware/authMiddleware';
import cookieParser from 'cookie-parser';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO with CORS configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.cors.allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Needed for WebRTC
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:", ...config.cors.allowedOrigins],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
    },
  },
}));

app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
}));

app.use(morgan(config.server.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(securityHeaders);

// Serve static files for testing
app.use(express.static('public'));

// Serve test clients
app.get('/test', (req, res) => {
  res.sendFile(__dirname + '/../test-client.html');
});

app.get('/auth-test', (req, res) => {
  res.sendFile(__dirname + '/../auth-test.html');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stun-turn', stunTurnRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reactions', reactionsRoutes);

// Enhanced health check endpoint with detailed monitoring
app.get('/health', async (req, res) => {
  const healthCheck: any = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    services: {},
    resources: {},
    api: {}
  };

  try {
    // Database health check
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbStart;
    
    // Get database statistics
    const [totalRooms, activeRooms, totalUsers, recentActivity] = await Promise.all([
      prisma.room.count(),
      prisma.room.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.room.count({ 
        where: { 
          updatedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
        } 
      })
    ]);

    healthCheck.services = {
      ...healthCheck.services,
      database: {
        status: 'healthy',
        responseTime: dbResponseTime,
        statistics: {
          totalRooms,
          activeRooms,
          totalUsers,
          recentActivity
        }
      },
      webrtc: {
        status: 'healthy',
        activeRooms: webrtcSignaling.getActiveRoomsCount(),
        activeUsers: webrtcSignaling.getActiveUsersCount(),
        connections: 'operational'
      },
      stunTurn: {
        status: 'healthy',
        providers: stunTurnService.getProviderStats().map(p => ({
          id: p.id,
          name: p.name,
          isActive: p.isActive,
          isHealthy: !p.healthCheck || p.healthCheck.isHealthy !== false,
          region: p.region
        })),
        totalProviders: stunTurnService.getProviderStats().length,
        activeProviders: stunTurnService.getProviderStats().filter(p => p.isActive).length
      }
    };

    // System resources
    healthCheck.resources = {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      cpu: {
        loadAverage: process.platform === 'linux' ? require('os').loadavg() : null
      }
    };

    // API status
    healthCheck.api = {
      endpoints: [
        '/api/auth/*',
        '/api/rooms/*',
        '/api/meetings/*',
        '/api/users/*',
        '/api/analytics/*',
        '/api/admin/*',
        '/api/stun-turn/*',
        '/api/email/*',
        '/api/invitations/*',
        '/api/reactions/*',
        '/api/createRoom',
        '/api/webrtc-config',
        '/health'
      ],
      cors: 'enabled',
      rateLimit: 'active'
    };

    res.json(healthCheck);
    
  } catch (error) {
    console.error('Health check error:', error);
    
    healthCheck.status = 'ERROR';
    healthCheck.services = {
      ...healthCheck.services,
      database: {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Database connectivity issue'
      },
      webrtc: {
        status: 'unknown',
        activeRooms: 0,
        activeUsers: 0,
        error: 'Unable to verify WebRTC service status'
      }
    };

    res.status(503).json(healthCheck);
  }
});

// WebRTC configuration endpoint for frontend
app.get('/api/webrtc-config', async (req, res) => {
  try {
    const { region, userId, bandwidthRequirement } = req.query;
    
    // Get optimized ICE servers from STUN/TURN service
    const iceServers = await stunTurnService.getIceServers({
      userId: userId as string,
      region: region as string,
      bandwidthRequirement: bandwidthRequirement ? parseInt(bandwidthRequirement as string) : undefined,
      maxServers: 5,
    });

    res.json({
      iceServers,
      meta: {
        totalServers: iceServers.length,
        region: region || 'auto',
        userId: userId || 'anonymous',
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Error getting WebRTC config:', error);
    
    // Fallback to basic configuration
    res.json({
      iceServers: [
        ...config.webrtc.stunServers.map(server => ({ urls: server })),
        ...config.webrtc.turnServers.map(server => ({ urls: server }))
      ],
      meta: {
        fallback: true,
        error: 'Advanced STUN/TURN configuration unavailable'
      }
    });
  }
});

// Enhanced room creation endpoint
app.post('/api/createRoom', async (req, res) => {
  try {
    const { name, maxParticipants, clientId } = req.body;
    
    // For now, use a default client if not provided
    let actualClientId = clientId;
    if (!actualClientId) {
      const defaultClient = await prisma.client.findFirst({
        where: { domain: 'localhost' }
      });
      actualClientId = defaultClient?.id;
    }

    if (!actualClientId) {
      return res.status(400).json({
        error: 'Client ID required',
        message: 'No default client found. Please specify clientId.'
      });
    }

    // Create room in database
    const room = await prisma.room.create({
      data: {
        name: name || `Room ${generateRoomId()}`,
        maxParticipants: maxParticipants || 50,
        clientId: actualClientId,
        isActive: true,
      },
    });

    res.json({ 
      roomId: room.id,
      roomName: room.name,
      maxParticipants: room.maxParticipants,
      success: true,
      message: 'Room created successfully'
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({
      error: 'Failed to create room',
      message: 'Internal server error'
    });
  }
});

// Legacy room endpoint removed - use /api/rooms/:roomId instead

// Initialize WebRTC Signaling Service
const webrtcSignaling = new WebRTCSignalingService(io);

// Initialize Analytics Service with Socket.IO for real-time tracking
const analyticsService = initializeAnalyticsService(io);

// Auth error handling middleware
app.use(handleAuthErrors);

// General error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.server.nodeEnv === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Utility function to generate room IDs
function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Start server
httpServer.listen(config.server.port, config.server.host, () => {
  console.log(`🚀 Video Conference Server started`);
  console.log(`📡 Server running on http://${config.server.host}:${config.server.port}`);
  console.log(`🌍 Environment: ${config.server.nodeEnv}`);
  console.log(`🔧 CORS Origins: ${config.cors.allowedOrigins.join(', ')}`);
  console.log(`📊 Health check: http://${config.server.host}:${config.server.port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📝 SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📝 SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export { app, httpServer, io };