/**
 * Notification Service
 * Handles frontend notification management, WebSocket integration, and push notifications
 * Manages notification queue for offline scenarios and real-time updates
 */

class NotificationService {
  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    this.wsUrl = import.meta.env.VITE_WS_URL;

    // WebSocket connection for real-time notifications
    this.wsConnection = null;
    this.wsReconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;

    // Notification queue and management
    this.notificationQueue = [];
    this.displayedNotifications = new Map();
    this.notificationCallbacks = new Map();
    this.maxDisplayedNotifications = 5;

    // Push notification support
    this.pushSubscription = null;
    this.vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

    // Online/offline state
    this.isOnline = navigator.onLine;

    // Notification types and their handlers
    this.notificationTypes = {
      meeting_invitation: this.handleMeetingInvitation.bind(this),
      meeting_reminder: this.handleMeetingReminder.bind(this),
      meeting_started: this.handleMeetingStarted.bind(this),
      meeting_ended: this.handleMeetingEnded.bind(this),
      participant_joined: this.handleParticipantJoined.bind(this),
      participant_left: this.handleParticipantLeft.bind(this),
      permission_request: this.handlePermissionRequest.bind(this),
      permission_granted: this.handlePermissionGranted.bind(this),
      hand_raised: this.handleHandRaised.bind(this),
      system_alert: this.handleSystemAlert.bind(this),
      user_message: this.handleUserMessage.bind(this),
      system_update: this.handleSystemUpdate.bind(this),
    };

    // Initialize the service
    this.initialize();
  }

  // ===========================================
  // Initialization and Setup
  // ===========================================

  async initialize() {
    // Setup online/offline listeners
    window.addEventListener("online", this.handleOnline.bind(this));
    window.addEventListener("offline", this.handleOffline.bind(this));

    // Request notification permission
    await this.requestNotificationPermission();

    // Initialize push notifications if supported
    if ("serviceWorker" in navigator && "PushManager" in window) {
      await this.initializePushNotifications();
    }

    // Initialize WebSocket connection
    this.initializeWebSocket();

    // Load persistent notifications from storage
    this.loadPersistedNotifications();

    // Setup periodic cleanup
    setInterval(() => this.cleanupOldNotifications(), 5 * 60 * 1000); // 5 minutes
  }

  async requestNotificationPermission() {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      console.log("Notification permission:", permission);
      return permission === "granted";
    }
    return false;
  }

  async initializePushNotifications() {
    try {
      const registration = await navigator.serviceWorker.ready;

      // Check if push subscription exists
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription && this.vapidKey) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.vapidKey),
        });
      }

      if (subscription) {
        this.pushSubscription = subscription;
        await this.sendSubscriptionToServer(subscription);
      }
    } catch (error) {
      console.error("Error initializing push notifications:", error);
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)));
  }

  async sendSubscriptionToServer(subscription) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/push-subscription`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            subscription: subscription.toJSON(),
          }),
        },
      );

      if (response.ok) {
        console.log("Push subscription sent to server");
      }
    } catch (error) {
      console.error("Error sending subscription to server:", error);
    }
  }

  // ===========================================
  // WebSocket Connection Management
  // ===========================================

  initializeWebSocket() {
    if (!this.isOnline || this.wsConnection) return;

    try {
      const token = this.getAccessTokenFromStore();
      const wsUrl = `${this.wsUrl}/notifications?token=${encodeURIComponent(token)}`;

      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = this.handleWebSocketOpen.bind(this);
      this.wsConnection.onmessage = this.handleWebSocketMessage.bind(this);
      this.wsConnection.onclose = this.handleWebSocketClose.bind(this);
      this.wsConnection.onerror = this.handleWebSocketError.bind(this);
    } catch (error) {
      console.error("Failed to initialize notification WebSocket:", error);
    }
  }

  handleWebSocketOpen() {
    console.log("Notification WebSocket connected");
    this.wsReconnectAttempts = 0;

    // Send authentication message
    const token = this.getAccessTokenFromStore();
    if (token) {
      this.sendWebSocketMessage({
        type: "authenticate",
        token: token,
      });
    }

    // Process queued notifications
    this.processNotificationQueue();
  }

  handleWebSocketMessage(event) {
    try {
      const message = JSON.parse(event.data);
      this.processNotification(message);
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  }

  handleWebSocketClose() {
    console.log("Notification WebSocket disconnected");
    this.wsConnection = null;
    this.attemptReconnect();
  }

  handleWebSocketError(error) {
    console.error("Notification WebSocket error:", error);
  }

  sendWebSocketMessage(message) {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  attemptReconnect() {
    if (
      this.wsReconnectAttempts >= this.maxReconnectAttempts ||
      !this.isOnline
    ) {
      return;
    }

    this.wsReconnectAttempts++;
    const delay =
      this.reconnectDelay * Math.pow(2, this.wsReconnectAttempts - 1);

    setTimeout(() => {
      this.initializeWebSocket();
    }, delay);
  }

  disconnectWebSocket() {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  // ===========================================
  // Online/Offline Handling
  // ===========================================

  handleOnline() {
    this.isOnline = true;
    this.initializeWebSocket();
    this.processNotificationQueue();
    console.log("Notification service: Back online");
  }

  handleOffline() {
    this.isOnline = false;
    this.disconnectWebSocket();
    console.log("Notification service: Gone offline");
  }

  // ===========================================
  // Notification Processing
  // ===========================================

  processNotification(notification) {
    const { type, payload, timestamp, id } = notification;

    // Prevent duplicate notifications
    if (this.displayedNotifications.has(id)) {
      return;
    }

    // Store notification
    this.displayedNotifications.set(id, {
      ...notification,
      receivedAt: Date.now(),
    });

    // Process based on type
    if (this.notificationTypes[type]) {
      this.notificationTypes[type](payload, notification);
    } else {
      this.handleGenericNotification(payload, notification);
    }

    // Persist important notifications
    if (this.isImportantNotification(type)) {
      this.persistNotification(notification);
    }

    // Trigger callbacks
    this.triggerNotificationCallbacks(type, payload, notification);

    // Clean up old notifications
    this.cleanupDisplayedNotifications();
  }

  queueNotification(notification) {
    this.notificationQueue.push({
      ...notification,
      queuedAt: Date.now(),
    });

    // Limit queue size
    if (this.notificationQueue.length > 100) {
      this.notificationQueue.shift();
    }
  }

  processNotificationQueue() {
    while (this.notificationQueue.length > 0 && this.isOnline) {
      const notification = this.notificationQueue.shift();
      this.processNotification(notification);
    }
  }

  // ===========================================
  // Notification Type Handlers
  // ===========================================

  handleMeetingInvitation(payload, notification) {
    const { inviter_name, meeting_title, scheduled_start, join_url } = payload;

    this.showBrowserNotification({
      title: `Meeting Invitation from ${inviter_name}`,
      body: `You're invited to "${meeting_title}" on ${new Date(scheduled_start).toLocaleString()}`,
      icon: "/icons/meeting-invitation.png",
      tag: `meeting-invitation-${notification.id}`,
      actions: [
        { action: "accept", title: "Accept" },
        { action: "decline", title: "Decline" },
      ],
      data: { type: "meeting_invitation", payload, notification },
    });

    this.showInAppNotification({
      type: "meeting_invitation",
      title: `Meeting Invitation`,
      message: `${inviter_name} invited you to "${meeting_title}"`,
      actions: [
        {
          label: "Accept",
          action: () => this.acceptMeetingInvitation(notification.id, join_url),
          variant: "primary",
        },
        {
          label: "Decline",
          action: () => this.declineMeetingInvitation(notification.id),
          variant: "secondary",
        },
      ],
      persistent: true,
      priority: "high",
    });
  }

  handleMeetingReminder(payload, notification) {
    const { meeting_title, time_until_start_minutes, join_url } = payload;

    this.showBrowserNotification({
      title: `Meeting Reminder`,
      body: `"${meeting_title}" starts in ${time_until_start_minutes} minutes`,
      icon: "/icons/meeting-reminder.png",
      tag: `meeting-reminder-${notification.id}`,
      actions: [
        { action: "join", title: "Join Now" },
        { action: "snooze", title: "Remind in 5 min" },
      ],
      data: { type: "meeting_reminder", payload, notification },
    });

    this.showInAppNotification({
      type: "meeting_reminder",
      title: `Meeting Starting Soon`,
      message: `"${meeting_title}" starts in ${time_until_start_minutes} minutes`,
      actions: [
        {
          label: "Join Meeting",
          action: () => window.open(join_url, "_blank"),
          variant: "primary",
        },
      ],
      autoHide: time_until_start_minutes <= 5 ? false : 10000,
      priority: "high",
    });
  }

  handleMeetingStarted(payload, notification) {
    const { meeting_title } = payload;

    this.showInAppNotification({
      type: "meeting_started",
      title: `Meeting Started`,
      message: `"${meeting_title}" has begun`,
      autoHide: 5000,
      priority: "medium",
    });
  }

  handleMeetingEnded(payload, notification) {
    const { reason } = payload;

    this.showInAppNotification({
      type: "meeting_ended",
      title: `Meeting Ended`,
      message: reason || "The meeting has ended",
      autoHide: 5000,
      priority: "medium",
    });
  }

  handleParticipantJoined(payload, notification) {
    const { user_name } = payload;

    this.showInAppNotification({
      type: "participant_joined",
      title: `Participant Joined`,
      message: `${user_name} joined the meeting`,
      autoHide: 3000,
      priority: "low",
    });
  }

  handleParticipantLeft(payload, notification) {
    const { user_name } = payload;

    this.showInAppNotification({
      type: "participant_left",
      title: `Participant Left`,
      message: `${user_name} left the meeting`,
      autoHide: 3000,
      priority: "low",
    });
  }

  handlePermissionRequest(payload, notification) {
    const { user_name, meeting_title, permission } = payload;

    this.showInAppNotification({
      type: "permission_request",
      title: `Permission Request`,
      message: `${user_name} requests ${permission} permission in "${meeting_title}"`,
      actions: [
        {
          label: "Grant",
          action: () => this.grantPermission(notification.id, permission),
          variant: "primary",
        },
        {
          label: "Deny",
          action: () => this.denyPermission(notification.id, permission),
          variant: "secondary",
        },
      ],
      persistent: true,
      priority: "high",
    });
  }

  handlePermissionGranted(payload, notification) {
    const { permission } = payload;

    this.showInAppNotification({
      type: "permission_granted",
      title: `Permission Granted`,
      message: `Your ${permission} permission has been granted`,
      autoHide: 5000,
      priority: "medium",
    });
  }

  handleHandRaised(payload, notification) {
    const { user_name, meeting_title, queue_position } = payload;

    this.showInAppNotification({
      type: "hand_raised",
      title: `Hand Raised`,
      message: `${user_name} raised their hand in "${meeting_title}" (Position: ${queue_position})`,
      actions: [
        {
          label: "Allow to Speak",
          action: () => this.allowToSpeak(notification.id),
          variant: "primary",
        },
      ],
      persistent: true,
      priority: "high",
    });
  }

  handleSystemAlert(payload, notification) {
    const { title, message, alert_type, priority, action_url, action_label } =
      payload;

    const actions = action_url
      ? [
          {
            label: action_label || "View Details",
            action: () => window.open(action_url, "_blank"),
            variant: "primary",
          },
        ]
      : [];

    this.showBrowserNotification({
      title: `System Alert: ${title}`,
      body: message,
      icon: `/icons/alert-${alert_type}.png`,
      tag: `system-alert-${notification.id}`,
      data: { type: "system_alert", payload, notification },
    });

    this.showInAppNotification({
      type: "system_alert",
      title: title,
      message: message,
      actions: actions,
      variant: alert_type,
      priority: priority,
      persistent: priority === "critical",
    });
  }

  handleUserMessage(payload, notification) {
    const { sender_name, message } = payload;

    this.showInAppNotification({
      type: "user_message",
      title: `Message from ${sender_name}`,
      message: message,
      autoHide: 8000,
      priority: "medium",
    });
  }

  handleSystemUpdate(payload, notification) {
    const { title, message, version } = payload;

    this.showInAppNotification({
      type: "system_update",
      title: `System Update Available`,
      message: `${title} (v${version})`,
      actions: [
        {
          label: "Update Now",
          action: () => this.triggerSystemUpdate(),
          variant: "primary",
        },
        {
          label: "Later",
          action: () => this.dismissNotification(notification.id),
          variant: "secondary",
        },
      ],
      persistent: true,
      priority: "medium",
    });
  }

  handleGenericNotification(payload, notification) {
    this.showInAppNotification({
      type: "generic",
      title: payload.title || "Notification",
      message: payload.message || "You have a new notification",
      autoHide: 5000,
      priority: "medium",
    });
  }

  // ===========================================
  // Notification Display Methods
  // ===========================================

  showBrowserNotification(options) {
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon,
        tag: options.tag,
        data: options.data,
        actions: options.actions || [],
      });

      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        if (options.data?.payload?.join_url) {
          window.open(options.data.payload.join_url, "_blank");
        }
        notification.close();
      };

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);
    }
  }

  showInAppNotification(options) {
    // This will integrate with the UI store to display in-app notifications
    const { useUIStore } = require("../stores");
    const uiStore = useUIStore.getState();

    if (uiStore.addNotification) {
      uiStore.addNotification({
        id: `notification-${Date.now()}-${Math.random()}`,
        type: options.type,
        title: options.title,
        message: options.message,
        actions: options.actions || [],
        variant: options.variant || "info",
        priority: options.priority || "medium",
        persistent: options.persistent || false,
        autoHide: options.autoHide !== false ? options.autoHide || 5000 : false,
        timestamp: Date.now(),
      });
    }
  }

  // ===========================================
  // Notification Actions
  // ===========================================

  async acceptMeetingInvitation(notificationId, joinUrl) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/meeting-invitations/accept`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ notification_id: notificationId }),
        },
      );

      if (response.ok) {
        window.open(joinUrl, "_blank");
        this.dismissNotification(notificationId);
      }
    } catch (error) {
      console.error("Error accepting meeting invitation:", error);
    }
  }

  async declineMeetingInvitation(notificationId) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/meeting-invitations/decline`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ notification_id: notificationId }),
        },
      );

      if (response.ok) {
        this.dismissNotification(notificationId);
      }
    } catch (error) {
      console.error("Error declining meeting invitation:", error);
    }
  }

  async grantPermission(notificationId, permission) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/admin/permissions/grant`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            notification_id: notificationId,
            permission: permission,
          }),
        },
      );

      if (response.ok) {
        this.dismissNotification(notificationId);
      }
    } catch (error) {
      console.error("Error granting permission:", error);
    }
  }

  async denyPermission(notificationId, permission) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/admin/permissions/deny`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            notification_id: notificationId,
            permission: permission,
          }),
        },
      );

      if (response.ok) {
        this.dismissNotification(notificationId);
      }
    } catch (error) {
      console.error("Error denying permission:", error);
    }
  }

  async allowToSpeak(notificationId) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/admin/hand-raise/allow`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ notification_id: notificationId }),
        },
      );

      if (response.ok) {
        this.dismissNotification(notificationId);
      }
    } catch (error) {
      console.error("Error allowing to speak:", error);
    }
  }

  dismissNotification(notificationId) {
    this.displayedNotifications.delete(notificationId);

    // Remove from UI store as well
    const { useUIStore } = require("../stores");
    const uiStore = useUIStore.getState();

    if (uiStore.removeNotification) {
      uiStore.removeNotification(notificationId);
    }
  }

  // ===========================================
  // Notification Management
  // ===========================================

  subscribeToNotificationType(type, callback) {
    if (!this.notificationCallbacks.has(type)) {
      this.notificationCallbacks.set(type, new Set());
    }
    this.notificationCallbacks.get(type).add(callback);

    return () => {
      this.unsubscribeFromNotificationType(type, callback);
    };
  }

  unsubscribeFromNotificationType(type, callback) {
    if (this.notificationCallbacks.has(type)) {
      this.notificationCallbacks.get(type).delete(callback);

      if (this.notificationCallbacks.get(type).size === 0) {
        this.notificationCallbacks.delete(type);
      }
    }
  }

  triggerNotificationCallbacks(type, payload, notification) {
    if (this.notificationCallbacks.has(type)) {
      const callbacks = this.notificationCallbacks.get(type);
      callbacks.forEach((callback) => {
        try {
          callback(payload, notification);
        } catch (error) {
          console.error(
            `Error in notification callback for type ${type}:`,
            error,
          );
        }
      });
    }
  }

  isImportantNotification(type) {
    const importantTypes = [
      "meeting_invitation",
      "meeting_reminder",
      "permission_request",
      "system_alert",
    ];
    return importantTypes.includes(type);
  }

  persistNotification(notification) {
    try {
      const stored = JSON.parse(
        localStorage.getItem("persistedNotifications") || "[]",
      );
      stored.push({
        ...notification,
        persistedAt: Date.now(),
      });

      // Keep only last 50 notifications
      if (stored.length > 50) {
        stored.splice(0, stored.length - 50);
      }

      localStorage.setItem("persistedNotifications", JSON.stringify(stored));
    } catch (error) {
      console.error("Error persisting notification:", error);
    }
  }

  loadPersistedNotifications() {
    try {
      const stored = JSON.parse(
        localStorage.getItem("persistedNotifications") || "[]",
      );
      const recent = stored.filter(
        (n) => Date.now() - n.persistedAt < 24 * 60 * 60 * 1000,
      ); // 24 hours

      recent.forEach((notification) => {
        if (!this.displayedNotifications.has(notification.id)) {
          this.processNotification(notification);
        }
      });

      // Clean up old notifications
      localStorage.setItem("persistedNotifications", JSON.stringify(recent));
    } catch (error) {
      console.error("Error loading persisted notifications:", error);
    }
  }

  cleanupDisplayedNotifications() {
    const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes

    for (const [id, notification] of this.displayedNotifications.entries()) {
      if (notification.receivedAt < cutoff) {
        this.displayedNotifications.delete(id);
      }
    }

    // Limit total displayed notifications
    if (this.displayedNotifications.size > this.maxDisplayedNotifications) {
      const entries = Array.from(this.displayedNotifications.entries());
      entries.sort((a, b) => a[1].receivedAt - b[1].receivedAt);

      for (
        let i = 0;
        i < entries.length - this.maxDisplayedNotifications;
        i++
      ) {
        this.displayedNotifications.delete(entries[i][0]);
      }
    }
  }

  cleanupOldNotifications() {
    this.cleanupDisplayedNotifications();

    // Clean up notification queue
    const queueCutoff = Date.now() - 60 * 60 * 1000; // 1 hour
    this.notificationQueue = this.notificationQueue.filter(
      (n) => n.queuedAt > queueCutoff,
    );
  }

  // ===========================================
  // Utility Methods
  // ===========================================

  getAuthHeaders() {
    const token = this.getAccessTokenFromStore();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  getAccessTokenFromStore() {
    try {
      const { useAuthStore } = require("../stores/authStore");
      return useAuthStore.getState().accessToken;
    } catch {
      return null;
    }
  }

  // Get notification statistics
  getNotificationStats() {
    return {
      displayed: this.displayedNotifications.size,
      queued: this.notificationQueue.length,
      subscriptions: this.notificationCallbacks.size,
      wsConnected: this.wsConnection?.readyState === WebSocket.OPEN,
      pushEnabled: !!this.pushSubscription,
    };
  }

  // Clear all notifications
  clearAllNotifications() {
    this.displayedNotifications.clear();
    this.notificationQueue = [];

    const { useUIStore } = require("../stores");
    const uiStore = useUIStore.getState();

    if (uiStore.clearAllNotifications) {
      uiStore.clearAllNotifications();
    }
  }

  // Cleanup method
  destroy() {
    this.disconnectWebSocket();
    this.notificationCallbacks.clear();
    this.displayedNotifications.clear();
    this.notificationQueue = [];

    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
  }
}

// Singleton instance
const notificationService = new NotificationService();

export default notificationService;
