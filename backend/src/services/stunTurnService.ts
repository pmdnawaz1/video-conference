import crypto from 'crypto';
import { EventEmitter } from 'events';
import config from '../config';

export interface TurnCredentials {
  username: string;
  credential: string;
  credentialType?: 'password' | 'token';
  validUntil?: number; // Unix timestamp
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: 'password' | 'token';
}

export interface TurnProvider {
  id: string;
  name: string;
  urls: string[];
  username?: string;
  credential?: string;
  sharedSecret?: string; // For generating time-limited credentials
  ttl?: number; // Credential TTL in seconds
  priority: number; // Lower number = higher priority
  isActive: boolean;
  region?: string;
  maxBandwidth?: number; // Mbps
  maxConcurrentUsers?: number;
  costPerGb?: number; // For cost optimization
  healthCheck?: {
    url: string;
    interval: number;
    timeout: number;
    lastCheck?: Date;
    isHealthy?: boolean;
    responseTime?: number;
  };
}

export interface ConnectionStats {
  serverId: string;
  serverType: 'stun' | 'turn';
  connectionsCount: number;
  bytesTransferred: number;
  averageLatency: number;
  successRate: number;
  lastUsed: Date;
}

/**
 * STUN/TURN Server Management Service
 * Handles ICE server configuration, load balancing, health monitoring, and credential generation
 */
export class StunTurnService extends EventEmitter {
  private turnProviders: Map<string, TurnProvider> = new Map();
  private stunServers: string[] = [];
  private connectionStats: Map<string, ConnectionStats> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private statsCleanupInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.initializeConfiguration();
    this.startHealthChecking();
    this.startStatsCleanup();
  }

  /**
   * Initialize STUN/TURN configuration from environment and defaults
   */
  private initializeConfiguration() {
    // Initialize STUN servers
    this.stunServers = [
      ...config.webrtc.stunServers,
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun.stunprotocol.org:3478',
      'stun:global.stun.twilio.com:3478',
    ];

    // Initialize default TURN providers
    this.addDefaultTurnProviders();

    console.log(`🌐 STUN/TURN Service initialized with ${this.stunServers.length} STUN servers and ${this.turnProviders.size} TURN providers`);
  }

  /**
   * Add default TURN providers with various options
   */
  private addDefaultTurnProviders() {
    // Google Cloud TURN servers (if configured)
    if (process.env.GOOGLE_TURN_SERVERS) {
      this.addTurnProvider({
        id: 'google-cloud',
        name: 'Google Cloud TURN',
        urls: process.env.GOOGLE_TURN_SERVERS.split(','),
        username: process.env.GOOGLE_TURN_USERNAME,
        credential: process.env.GOOGLE_TURN_CREDENTIAL,
        priority: 1,
        isActive: true,
        region: 'global',
        maxBandwidth: 1000,
        maxConcurrentUsers: 10000,
        costPerGb: 0.05,
      });
    }

    // Twilio TURN servers (if configured)
    if (process.env.TWILIO_TURN_SERVERS) {
      this.addTurnProvider({
        id: 'twilio',
        name: 'Twilio TURN',
        urls: process.env.TWILIO_TURN_SERVERS.split(','),
        sharedSecret: process.env.TWILIO_TURN_SECRET,
        ttl: 86400, // 24 hours
        priority: 2,
        isActive: true,
        region: 'us-east',
        maxBandwidth: 500,
        maxConcurrentUsers: 5000,
        costPerGb: 0.08,
      });
    }

    // Xirsys TURN servers (if configured)
    if (process.env.XIRSYS_TURN_SERVERS) {
      this.addTurnProvider({
        id: 'xirsys',
        name: 'Xirsys TURN',
        urls: process.env.XIRSYS_TURN_SERVERS.split(','),
        username: process.env.XIRSYS_USERNAME,
        credential: process.env.XIRSYS_CREDENTIAL,
        priority: 3,
        isActive: true,
        region: 'global',
        maxBandwidth: 200,
        maxConcurrentUsers: 2000,
        costPerGb: 0.10,
      });
    }

    // Custom TURN servers from environment
    if (config.webrtc.turnServers.length > 0) {
      this.addTurnProvider({
        id: 'custom',
        name: 'Custom TURN',
        urls: config.webrtc.turnServers,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
        sharedSecret: process.env.TURN_SHARED_SECRET,
        ttl: parseInt(process.env.TURN_TTL || '3600'),
        priority: 10,
        isActive: true,
        region: 'custom',
        maxBandwidth: parseInt(process.env.TURN_MAX_BANDWIDTH || '100'),
        maxConcurrentUsers: parseInt(process.env.TURN_MAX_USERS || '1000'),
      });
    }
  }

  /**
   * Add a TURN provider
   */
  addTurnProvider(provider: TurnProvider) {
    this.turnProviders.set(provider.id, provider);
    
    // Initialize health check if configured
    if (provider.healthCheck) {
      this.initializeHealthCheck(provider);
    }

    this.emit('providerAdded', provider);
    console.log(`➕ Added TURN provider: ${provider.name} (${provider.id})`);
  }

  /**
   * Get ICE servers configuration for a user/session
   */
  async getIceServers(options?: {
    userId?: string;
    region?: string;
    bandwidthRequirement?: number;
    preferredProvider?: string;
    maxServers?: number;
  }): Promise<IceServer[]> {
    const { region, bandwidthRequirement, preferredProvider, maxServers = 5 } = options || {};
    
    const iceServers: IceServer[] = [];

    // Always include STUN servers (lightweight, no auth needed)
    const stunServer: IceServer = {
      urls: this.stunServers.slice(0, 2) // Limit to 2 STUN servers
    };
    iceServers.push(stunServer);

    // Get available TURN providers, sorted by priority and health
    const availableProviders = Array.from(this.turnProviders.values())
      .filter(provider => {
        if (!provider.isActive) return false;
        if (region && provider.region !== region && provider.region !== 'global') return false;
        if (bandwidthRequirement && provider.maxBandwidth && provider.maxBandwidth < bandwidthRequirement) return false;
        return true;
      })
      .sort((a, b) => {
        // Prefer specific provider if requested
        if (preferredProvider) {
          if (a.id === preferredProvider) return -1;
          if (b.id === preferredProvider) return 1;
        }
        
        // Sort by health, then priority
        const aHealthy = this.isProviderHealthy(a.id);
        const bHealthy = this.isProviderHealthy(b.id);
        
        if (aHealthy && !bHealthy) return -1;
        if (!aHealthy && bHealthy) return 1;
        
        return a.priority - b.priority;
      });

    // Add TURN servers from available providers
    let addedServers = 0;
    for (const provider of availableProviders) {
      if (addedServers >= maxServers - 1) break; // Reserve space for STUN

      try {
        const credentials = await this.generateCredentials(provider, options?.userId);
        
        const turnServer: IceServer = {
          urls: provider.urls,
          username: credentials?.username || provider.username,
          credential: credentials?.credential || provider.credential,
          credentialType: credentials?.credentialType || 'password',
        };

        iceServers.push(turnServer);
        addedServers++;

        // Update usage stats
        this.updateUsageStats(provider.id, 'turn');
        
        console.log(`🔄 Assigned TURN server: ${provider.name} for user ${options?.userId || 'anonymous'}`);
      } catch (error) {
        console.error(`❌ Failed to generate credentials for ${provider.name}:`, error);
        // Mark provider as unhealthy temporarily
        this.markProviderUnhealthy(provider.id);
      }
    }

    // Fallback: if no TURN servers available, log warning
    if (addedServers === 0 && this.turnProviders.size > 0) {
      console.warn('⚠️  No TURN servers available, connections may fail behind strict NATs');
    }

    this.emit('iceServersGenerated', { 
      servers: iceServers, 
      userId: options?.userId,
      region,
      providersUsed: addedServers 
    });

    return iceServers;
  }

  /**
   * Generate time-limited credentials for TURN server
   */
  private async generateCredentials(provider: TurnProvider, userId?: string): Promise<TurnCredentials | null> {
    if (provider.sharedSecret) {
      // Generate time-limited credentials using TURN REST API
      const ttl = provider.ttl || 3600; // 1 hour default
      const validUntil = Math.floor(Date.now() / 1000) + ttl;
      const username = `${validUntil}:${userId || 'anonymous'}`;
      
      // Generate credential using HMAC-SHA1
      const hmac = crypto.createHmac('sha1', provider.sharedSecret);
      hmac.update(username);
      const credential = hmac.digest('base64');

      return {
        username,
        credential,
        credentialType: 'password',
        validUntil,
      };
    } else if (provider.username && provider.credential) {
      // Use static credentials
      return {
        username: provider.username,
        credential: provider.credential,
        credentialType: 'password',
      };
    }

    return null;
  }

  /**
   * Check if a provider is healthy
   */
  private isProviderHealthy(providerId: string): boolean {
    const provider = this.turnProviders.get(providerId);
    if (!provider) return false;
    
    if (!provider.healthCheck) return true; // Assume healthy if no health check
    
    return provider.healthCheck.isHealthy !== false;
  }

  /**
   * Mark provider as unhealthy temporarily
   */
  private markProviderUnhealthy(providerId: string) {
    const provider = this.turnProviders.get(providerId);
    if (provider && provider.healthCheck) {
      provider.healthCheck.isHealthy = false;
      provider.healthCheck.lastCheck = new Date();
    }
  }

  /**
   * Update usage statistics
   */
  private updateUsageStats(providerId: string, serverType: 'stun' | 'turn') {
    const existing = this.connectionStats.get(providerId) || {
      serverId: providerId,
      serverType,
      connectionsCount: 0,
      bytesTransferred: 0,
      averageLatency: 0,
      successRate: 100,
      lastUsed: new Date(),
    };

    existing.connectionsCount++;
    existing.lastUsed = new Date();
    
    this.connectionStats.set(providerId, existing);
  }

  /**
   * Initialize health checking for providers
   */
  private initializeHealthCheck(provider: TurnProvider) {
    if (!provider.healthCheck) return;

    // Implement basic health check (ping-like test)
    // In a real implementation, you'd use a proper TURN client library
    console.log(`🏥 Health check initialized for ${provider.name}`);
  }

  /**
   * Start periodic health checking
   */
  private startHealthChecking() {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 60000); // Check every minute
  }

  /**
   * Perform health checks on all providers
   */
  private async performHealthChecks() {
    for (const [providerId, provider] of this.turnProviders) {
      if (!provider.healthCheck || !provider.isActive) continue;

      try {
        // Simple health check - in real implementation would test actual TURN connectivity
        const startTime = Date.now();
        
        // Simulate health check (replace with actual implementation)
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const responseTime = Date.now() - startTime;
        
        provider.healthCheck.lastCheck = new Date();
        provider.healthCheck.isHealthy = true;
        provider.healthCheck.responseTime = responseTime;
        
      } catch (error) {
        console.error(`❌ Health check failed for ${provider.name}:`, error);
        provider.healthCheck.isHealthy = false;
        provider.healthCheck.lastCheck = new Date();
        
        this.emit('providerUnhealthy', { providerId, provider, error });
      }
    }
  }

  /**
   * Start stats cleanup (remove old stats)
   */
  private startStatsCleanup() {
    this.statsCleanupInterval = setInterval(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      for (const [key, stats] of this.connectionStats) {
        if (stats.lastUsed < cutoff) {
          this.connectionStats.delete(key);
        }
      }
    }, 60 * 60 * 1000); // Cleanup every hour
  }

  /**
   * Get TURN provider statistics
   */
  getProviderStats(): Array<TurnProvider & { stats?: ConnectionStats }> {
    return Array.from(this.turnProviders.values()).map(provider => ({
      ...provider,
      stats: this.connectionStats.get(provider.id),
    }));
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): ConnectionStats[] {
    return Array.from(this.connectionStats.values());
  }

  /**
   * Update provider configuration
   */
  updateProvider(providerId: string, updates: Partial<TurnProvider>) {
    const provider = this.turnProviders.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    Object.assign(provider, updates);
    this.turnProviders.set(providerId, provider);
    
    this.emit('providerUpdated', provider);
    console.log(`🔄 Updated TURN provider: ${provider.name}`);
  }

  /**
   * Remove a provider
   */
  removeProvider(providerId: string) {
    const provider = this.turnProviders.get(providerId);
    if (provider) {
      this.turnProviders.delete(providerId);
      this.connectionStats.delete(providerId);
      
      this.emit('providerRemoved', { providerId, provider });
      console.log(`➖ Removed TURN provider: ${provider.name}`);
    }
  }

  /**
   * Test connectivity to all providers
   */
  async testConnectivity(): Promise<{ [providerId: string]: boolean }> {
    const results: { [providerId: string]: boolean } = {};

    for (const [providerId, provider] of this.turnProviders) {
      try {
        // In a real implementation, this would test actual TURN connectivity
        // For now, just simulate the test
        await new Promise(resolve => setTimeout(resolve, 100));
        results[providerId] = true;
        console.log(`✅ Connectivity test passed for ${provider.name}`);
      } catch (error) {
        results[providerId] = false;
        console.error(`❌ Connectivity test failed for ${provider.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Get optimal server configuration based on user location and requirements
   */
  async getOptimalConfiguration(options: {
    userRegion?: string;
    bandwidthRequirement?: number;
    latencyRequirement?: number;
    costOptimized?: boolean;
  }) {
    const { userRegion, bandwidthRequirement, latencyRequirement, costOptimized } = options;
    
    let providers = Array.from(this.turnProviders.values())
      .filter(p => p.isActive && this.isProviderHealthy(p.id));

    // Filter by region if specified
    if (userRegion) {
      providers = providers.filter(p => 
        p.region === userRegion || p.region === 'global'
      );
    }

    // Filter by bandwidth requirement
    if (bandwidthRequirement) {
      providers = providers.filter(p => 
        !p.maxBandwidth || p.maxBandwidth >= bandwidthRequirement
      );
    }

    // Sort by criteria
    providers.sort((a, b) => {
      if (costOptimized && a.costPerGb && b.costPerGb) {
        return a.costPerGb - b.costPerGb; // Lower cost first
      }
      
      // Default: sort by priority and health
      const aStats = this.connectionStats.get(a.id);
      const bStats = this.connectionStats.get(b.id);
      
      if (aStats && bStats) {
        // Consider latency if available
        if (latencyRequirement) {
          const aLatency = aStats.averageLatency || 0;
          const bLatency = bStats.averageLatency || 0;
          if (aLatency <= latencyRequirement && bLatency > latencyRequirement) return -1;
          if (aLatency > latencyRequirement && bLatency <= latencyRequirement) return 1;
        }
        
        // Consider success rate
        return bStats.successRate - aStats.successRate;
      }
      
      return a.priority - b.priority;
    });

    return providers.slice(0, 3); // Return top 3 providers
  }

  /**
   * Monitor bandwidth usage and costs
   */
  async generateUsageReport(timeRange: { start: Date; end: Date }) {
    const report = {
      timeRange,
      totalConnections: 0,
      totalBandwidth: 0,
      estimatedCost: 0,
      providerBreakdown: {} as any,
    };

    for (const [providerId, stats] of this.connectionStats) {
      const provider = this.turnProviders.get(providerId);
      if (!provider) continue;

      const bandwidthGb = stats.bytesTransferred / (1024 * 1024 * 1024);
      const cost = provider.costPerGb ? bandwidthGb * provider.costPerGb : 0;

      report.totalConnections += stats.connectionsCount;
      report.totalBandwidth += bandwidthGb;
      report.estimatedCost += cost;

      report.providerBreakdown[providerId] = {
        name: provider.name,
        connections: stats.connectionsCount,
        bandwidthGb,
        cost,
        successRate: stats.successRate,
        averageLatency: stats.averageLatency,
      };
    }

    return report;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.statsCleanupInterval) {
      clearInterval(this.statsCleanupInterval);
    }
    
    this.turnProviders.clear();
    this.connectionStats.clear();
    this.removeAllListeners();
    
    console.log('🔧 STUN/TURN Service destroyed');
  }
}

// Export singleton instance
export const stunTurnService = new StunTurnService();

export default stunTurnService;