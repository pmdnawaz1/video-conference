class WebSocketService {
  constructor() {
    this.connection = null;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000;
    this.heartbeatInterval = null;
    this.connectionState = 'disconnected';
    this.messageQueue = [];
    this.lastPingTime = null;
    this.currentLatency = null;
    this.connectionQuality = 'good';
  }

  // Enhanced connection with automatic reconnection
  connect(url, protocols = []) {
    return new Promise((resolve, reject) => {
      try {
        this.connection = new WebSocket(url, protocols);
        this.connectionState = 'connecting';

        this.connection.onopen = (event) => {
          console.log('🟢 WebSocket connected');
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.processMessageQueue();
          this.notifyHandlers('connectionStateChange', { state: 'connected' });
          resolve(event);
        };

        this.connection.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.connection.onclose = (event) => {
          console.log('🔴 WebSocket closed:', event.code, event.reason);
          this.connectionState = 'disconnected';
          this.stopHeartbeat();
          this.notifyHandlers('connectionStateChange', { state: 'disconnected' });
          
          if (event.code !== 1000 && event.code !== 1001) {
            this.attemptReconnect(url, protocols);
          }
        };

        this.connection.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.connectionState = 'error';
          this.notifyHandlers('connectionStateChange', { state: 'error', error });
          reject(error);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  // Enhanced message handling with type-based routing
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      const { type, payload, timestamp } = message;

      // Handle system messages
      switch (type) {
        case 'pong':
          this.handlePong(payload);
          break;
        case 'heartbeat':
          this.handleHeartbeat(payload);
          break;
        case 'connectionQuality':
          this.handleConnectionQuality(payload);
          break;
        default:
          this.notifyHandlers(type, payload || message);
          break;
      }

    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  // Enhanced message sending with queuing and retry
  send(type, payload = null, options = {}) {
    const message = {
      type,
      payload,
      timestamp: Date.now(),
      ...options
    };

    if (this.isConnected()) {
      try {
        this.connection.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Error sending message:', error);
        if (options.queue !== false) {
          this.queueMessage(message);
        }
        return false;
      }
    } else {
      if (options.queue !== false) {
        this.queueMessage(message);
      }
      return false;
    }
  }

  // Queue messages for sending when connection is restored
  queueMessage(message) {
    this.messageQueue.push({
      ...message,
      queuedAt: Date.now()
    });

    // Limit queue size
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }
  }

  // Process queued messages
  processMessageQueue() {
    const now = Date.now();
    const validMessages = this.messageQueue.filter(msg => 
      now - msg.queuedAt < 30000 // 30 second expiry
    );

    validMessages.forEach(message => {
      this.send(message.type, message.payload, { queue: false });
    });

    this.messageQueue = [];
  }

  // Enhanced heartbeat system
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.lastPingTime = Date.now();
        this.send('ping', { timestamp: this.lastPingTime }, { queue: false });
      }
    }, 30000); // 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  handlePong(payload) {
    if (this.lastPingTime && payload?.timestamp) {
      this.currentLatency = Date.now() - payload.timestamp;
      this.updateConnectionQuality();
      this.notifyHandlers('latencyUpdate', { latency: this.currentLatency });
    }
  }

  handleHeartbeat(payload) {
    // Server-initiated heartbeat
    this.send('heartbeatResponse', { timestamp: Date.now() }, { queue: false });
  }

  handleConnectionQuality(payload) {
    this.connectionQuality = payload.quality || 'good';
    this.notifyHandlers('connectionQuality', payload);
  }

  updateConnectionQuality() {
    let quality = 'good';
    
    if (this.currentLatency > 500) {
      quality = 'poor';
    } else if (this.currentLatency > 200) {
      quality = 'fair';
    }

    if (quality !== this.connectionQuality) {
      this.connectionQuality = quality;
      this.notifyHandlers('connectionQuality', { 
        quality, 
        latency: this.currentLatency 
      });
    }
  }

  // Automatic reconnection
  attemptReconnect(url, protocols) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.notifyHandlers('reconnectionFailed', { attempts: this.reconnectAttempts });
      return;
    }

    this.reconnectAttempts++;
    this.connectionState = 'reconnecting';
    this.notifyHandlers('connectionStateChange', { 
      state: 'reconnecting', 
      attempt: this.reconnectAttempts 
    });

    setTimeout(() => {
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect(url, protocols)
        .catch(error => {
          console.error('Reconnection failed:', error);
          this.attemptReconnect(url, protocols);
        });
    }, this.reconnectInterval * this.reconnectAttempts);
  }

  // Message handler registration
  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }
    this.messageHandlers.get(messageType).add(handler);
  }

  off(messageType, handler) {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(messageType);
      }
    }
  }

  // Notify registered handlers
  notifyHandlers(messageType, data) {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${messageType} handler:`, error);
        }
      });
    }
  }

  // Utility methods
  isConnected() {
    return this.connection && this.connection.readyState === WebSocket.OPEN;
  }

  getConnectionState() {
    return this.connectionState;
  }

  getLatency() {
    return this.currentLatency;
  }

  getConnectionQuality() {
    return this.connectionQuality;
  }

  // Meeting-specific message helpers
  sendMeetingMessage(type, payload) {
    return this.send(type, {
      roomId: payload.roomId,
      userId: payload.userId,
      timestamp: Date.now(),
      ...payload
    });
  }

  // Admin control messages
  sendAdminControl(action, targetUserId, roomId, adminId, data = {}) {
    return this.send('participantControl', {
      action,
      targetUserId,
      roomId,
      adminId,
      timestamp: Date.now(),
      ...data
    });
  }

  // Permission management
  sendPermissionRequest(permissionType, roomId, userId, reason = '') {
    return this.send('permissionRequest', {
      permissionType,
      roomId,
      userId,
      reason,
      timestamp: Date.now()
    });
  }

  sendPermissionResponse(requestId, approved, roomId, adminId) {
    return this.send('permissionResponse', {
      requestId,
      approved,
      roomId,
      adminId,
      timestamp: Date.now()
    });
  }

  // State synchronization
  requestStateSync(roomId, userId) {
    return this.send('requestStateSync', {
      roomId,
      userId,
      timestamp: Date.now()
    });
  }

  // Speaking detection
  updateSpeakingStatus(roomId, userId, isSpeaking, audioLevel = 0) {
    return this.send('speakingUpdate', {
      roomId,
      userId,
      isSpeaking,
      audioLevel,
      timestamp: Date.now()
    }, { queue: false }); // Don't queue speaking updates
  }

  // Cleanup
  disconnect() {
    this.stopHeartbeat();
    
    if (this.connection) {
      this.connection.close(1000, 'Client initiated disconnect');
      this.connection = null;
    }
    
    this.connectionState = 'disconnected';
    this.messageHandlers.clear();
    this.messageQueue = [];
    this.reconnectAttempts = 0;
  }
}

// Singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;