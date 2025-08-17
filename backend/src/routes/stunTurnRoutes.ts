import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { stunTurnService } from '../services/stunTurnService';
import { 
  authenticate, 
  authorize,
  rateLimit,
  handleCorsAuth,
  logAuthenticatedRequests 
} from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply middleware
router.use(handleCorsAuth);
router.use(logAuthenticatedRequests);

// Rate limiting
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200, // 200 requests per window
});

const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // 50 admin requests per window
});

/**
 * GET /api/stun-turn/ice-servers
 * Get ICE servers configuration for WebRTC
 */
router.get('/ice-servers', authenticate, generalRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const {
      region,
      bandwidthRequirement,
      preferredProvider,
      maxServers = '5'
    } = req.query;

    const options = {
      userId: req.user.id,
      region: region as string,
      bandwidthRequirement: bandwidthRequirement ? parseInt(bandwidthRequirement as string) : undefined,
      preferredProvider: preferredProvider as string,
      maxServers: Math.min(parseInt(maxServers as string), 10), // Max 10 servers
    };

    const iceServers = await stunTurnService.getIceServers(options);

    res.json({
      success: true,
      iceServers,
      meta: {
        totalServers: iceServers.length,
        region: options.region,
        userId: req.user.id,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Error getting ICE servers:', error);
    res.status(500).json({
      error: 'Failed to get ICE servers',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/stun-turn/optimal-config
 * Get optimal TURN configuration based on requirements
 */
router.get('/optimal-config', authenticate, generalRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const {
      userRegion,
      bandwidthRequirement,
      latencyRequirement,
      costOptimized = 'false'
    } = req.query;

    const options = {
      userRegion: userRegion as string,
      bandwidthRequirement: bandwidthRequirement ? parseInt(bandwidthRequirement as string) : undefined,
      latencyRequirement: latencyRequirement ? parseInt(latencyRequirement as string) : undefined,
      costOptimized: costOptimized === 'true',
    };

    const optimalProviders = await stunTurnService.getOptimalConfiguration(options);

    res.json({
      success: true,
      optimalProviders: optimalProviders.map(provider => ({
        id: provider.id,
        name: provider.name,
        region: provider.region,
        maxBandwidth: provider.maxBandwidth,
        costPerGb: provider.costPerGb,
        priority: provider.priority,
      })),
      criteria: options,
    });

  } catch (error) {
    console.error('Error getting optimal configuration:', error);
    res.status(500).json({
      error: 'Failed to get optimal configuration',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/stun-turn/stats
 * Get TURN usage statistics (admin only)
 */
router.get('/stats', authenticate, authorize(UserRole.ADMIN), adminRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const providerStats = stunTurnService.getProviderStats();
    const connectionStats = stunTurnService.getConnectionStats();

    // Calculate summary statistics
    const summary = {
      totalProviders: providerStats.length,
      activeProviders: providerStats.filter(p => p.isActive).length,
      healthyProviders: providerStats.filter(p => 
        !p.healthCheck || p.healthCheck.isHealthy !== false
      ).length,
      totalConnections: connectionStats.reduce((sum, stat) => sum + stat.connectionsCount, 0),
      totalBandwidth: connectionStats.reduce((sum, stat) => sum + stat.bytesTransferred, 0),
      averageSuccessRate: connectionStats.length > 0 
        ? connectionStats.reduce((sum, stat) => sum + stat.successRate, 0) / connectionStats.length
        : 100,
      averageLatency: connectionStats.length > 0
        ? connectionStats.reduce((sum, stat) => sum + stat.averageLatency, 0) / connectionStats.length
        : 0,
    };

    res.json({
      success: true,
      summary,
      providers: providerStats.map(provider => ({
        id: provider.id,
        name: provider.name,
        isActive: provider.isActive,
        region: provider.region,
        priority: provider.priority,
        maxBandwidth: provider.maxBandwidth,
        maxConcurrentUsers: provider.maxConcurrentUsers,
        costPerGb: provider.costPerGb,
        healthCheck: provider.healthCheck ? {
          isHealthy: provider.healthCheck.isHealthy,
          lastCheck: provider.healthCheck.lastCheck,
          responseTime: provider.healthCheck.responseTime,
        } : null,
        stats: provider.stats ? {
          connectionsCount: provider.stats.connectionsCount,
          bytesTransferred: provider.stats.bytesTransferred,
          averageLatency: provider.stats.averageLatency,
          successRate: provider.stats.successRate,
          lastUsed: provider.stats.lastUsed,
        } : null,
      })),
    });

  } catch (error) {
    console.error('Error getting TURN stats:', error);
    res.status(500).json({
      error: 'Failed to get TURN statistics',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/stun-turn/test-connectivity
 * Test connectivity to all TURN providers (admin only)
 */
router.post('/test-connectivity', authenticate, authorize(UserRole.ADMIN), adminRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log(`🧪 Testing TURN connectivity requested by admin ${req.user.email}`);

    const results = await stunTurnService.testConnectivity();

    res.json({
      success: true,
      message: 'Connectivity test completed',
      results,
      testedAt: new Date().toISOString(),
      testedBy: req.user.email,
    });

  } catch (error) {
    console.error('Error testing connectivity:', error);
    res.status(500).json({
      error: 'Failed to test connectivity',
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/stun-turn/providers/:providerId
 * Update TURN provider configuration (super admin only)
 */
router.put('/providers/:providerId', authenticate, authorize(UserRole.SUPER_ADMIN), adminRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { providerId } = req.params;
    const updates = req.body;

    // Validate updates (basic validation)
    const allowedUpdates = [
      'name', 'priority', 'isActive', 'region', 'maxBandwidth', 
      'maxConcurrentUsers', 'costPerGb', 'healthCheck'
    ];

    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        error: 'No valid updates provided',
        message: `Allowed fields: ${allowedUpdates.join(', ')}`
      });
    }

    stunTurnService.updateProvider(providerId, filteredUpdates);

    res.json({
      success: true,
      message: 'Provider updated successfully',
      providerId,
      updates: filteredUpdates,
      updatedBy: req.user.email,
      updatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error updating provider:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.status(500).json({
      error: 'Failed to update provider',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/stun-turn/providers
 * Add new TURN provider (super admin only)
 */
router.post('/providers', authenticate, authorize(UserRole.SUPER_ADMIN), adminRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const {
      id,
      name,
      urls,
      username,
      credential,
      sharedSecret,
      ttl,
      priority = 10,
      region = 'custom',
      maxBandwidth,
      maxConcurrentUsers,
      costPerGb,
      healthCheck
    } = req.body;

    // Validation
    if (!id || !name || !urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'id, name, and urls (array) are required'
      });
    }

    if (!username && !credential && !sharedSecret) {
      return res.status(400).json({
        error: 'Authentication required',
        message: 'Provide either username/credential or sharedSecret'
      });
    }

    const provider = {
      id,
      name,
      urls,
      username,
      credential,
      sharedSecret,
      ttl,
      priority,
      isActive: true,
      region,
      maxBandwidth,
      maxConcurrentUsers,
      costPerGb,
      healthCheck,
    };

    stunTurnService.addTurnProvider(provider);

    res.status(201).json({
      success: true,
      message: 'Provider added successfully',
      provider: {
        id: provider.id,
        name: provider.name,
        region: provider.region,
        priority: provider.priority,
        isActive: provider.isActive,
      },
      addedBy: req.user.email,
      addedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error adding provider:', error);
    res.status(500).json({
      error: 'Failed to add provider',
      message: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/stun-turn/providers/:providerId
 * Remove TURN provider (super admin only)
 */
router.delete('/providers/:providerId', authenticate, authorize(UserRole.SUPER_ADMIN), adminRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { providerId } = req.params;

    stunTurnService.removeProvider(providerId);

    res.json({
      success: true,
      message: 'Provider removed successfully',
      providerId,
      removedBy: req.user.email,
      removedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error removing provider:', error);
    res.status(500).json({
      error: 'Failed to remove provider',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/stun-turn/usage-report
 * Generate usage and cost report (admin only)
 */
router.get('/usage-report', authenticate, authorize(UserRole.ADMIN), adminRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const {
      startDate,
      endDate
    } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate as string) : new Date();

    if (start >= end) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: 'Start date must be before end date'
      });
    }

    const report = await stunTurnService.generateUsageReport({ start, end });

    res.json({
      success: true,
      report: {
        ...report,
        generatedBy: req.user.email,
        generatedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Error generating usage report:', error);
    res.status(500).json({
      error: 'Failed to generate usage report',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/stun-turn/health
 * Get health status of TURN service
 */
router.get('/health', authenticate, generalRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const providerStats = stunTurnService.getProviderStats();
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      providers: {
        total: providerStats.length,
        active: providerStats.filter(p => p.isActive).length,
        healthy: providerStats.filter(p => 
          !p.healthCheck || p.healthCheck.isHealthy !== false
        ).length,
      },
      connectivity: 'unknown', // Would be updated by periodic connectivity tests
    };

    // Determine overall health
    if (healthStatus.providers.active === 0) {
      healthStatus.status = 'critical';
    } else if (healthStatus.providers.healthy / healthStatus.providers.active < 0.5) {
      healthStatus.status = 'degraded';
    }

    res.json({
      success: true,
      health: healthStatus
    });

  } catch (error) {
    console.error('Error getting health status:', error);
    res.status(500).json({
      error: 'Failed to get health status',
      message: 'Internal server error',
      health: {
        status: 'error',
        timestamp: new Date().toISOString(),
      }
    });
  }
});

export default router;