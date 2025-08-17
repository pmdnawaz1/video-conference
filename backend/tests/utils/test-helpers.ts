import { Page, expect } from '@playwright/test';

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Mock getUserMedia for WebRTC testing
   */
  async mockWebRTCMedia() {
    await this.page.addInitScript(() => {
      // Mock getUserMedia to return fake streams
      Object.defineProperty(window.navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: async (constraints: MediaStreamConstraints) => {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d')!;
            
            // Create a simple animated pattern
            let frame = 0;
            const drawFrame = () => {
              ctx.fillStyle = `hsl(${frame % 360}, 50%, 50%)`;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = 'white';
              ctx.font = '20px Arial';
              ctx.fillText(`Test Video ${frame}`, 10, 30);
              frame++;
            };
            
            // Draw initial frame
            drawFrame();
            setInterval(drawFrame, 100);
            
            // Create MediaStream from canvas
            const stream = (canvas as any).captureStream(10);
            
            // Add audio track if requested
            if (constraints.audio) {
              const audioContext = new AudioContext();
              const oscillator = audioContext.createOscillator();
              const gain = audioContext.createGain();
              const dest = audioContext.createMediaStreamDestination();
              
              oscillator.connect(gain);
              gain.connect(dest);
              oscillator.frequency.value = 440; // A4 note
              gain.gain.value = 0.1;
              oscillator.start();
              
              stream.addTrack(dest.stream.getAudioTracks()[0]);
            }
            
            return stream;
          },
          
          getDisplayMedia: async (constraints: DisplayMediaStreamConstraints) => {
            // Mock screen sharing
            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;
            
            ctx.fillStyle = '#000080';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.font = '48px Arial';
            ctx.fillText('Screen Share Test', 50, 100);
            
            return (canvas as any).captureStream(10);
          },
          
          enumerateDevices: async () => [
            { deviceId: 'test-camera', kind: 'videoinput', label: 'Test Camera' },
            { deviceId: 'test-mic', kind: 'audioinput', label: 'Test Microphone' },
            { deviceId: 'test-speaker', kind: 'audiooutput', label: 'Test Speaker' }
          ]
        }
      });

      // Mock RTCPeerConnection
      const OriginalRTCPeerConnection = window.RTCPeerConnection;
      (window as any).RTCPeerConnection = class MockRTCPeerConnection extends OriginalRTCPeerConnection {
        constructor(config?: RTCConfiguration) {
          super(config);
          
          // Simulate faster connection establishment
          setTimeout(() => {
            this.dispatchEvent(new Event('connectionstatechange'));
          }, 100);
        }
      };
    });
  }

  /**
   * Wait for WebSocket connection to be established
   */
  async waitForWebSocketConnection() {
    await this.page.waitForFunction(() => {
      return window.io && window.io.readyState === 'open';
    }, { timeout: 10000 });
  }

  /**
   * Login helper for authenticated tests
   */
  async loginAsTestUser(userEmail: string = 'testuser1@test.e2e', password: string = 'password') {
    await this.page.goto('/login');
    
    await this.page.fill('[data-testid="email-input"]', userEmail);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.click('[data-testid="login-submit"]');
    
    // Wait for successful login
    await expect(this.page).toHaveURL(/\/dashboard/);
  }

  /**
   * Create a test room and return room ID
   */
  async createTestRoom(roomName: string = 'E2E Test Room'): Promise<string> {
    const response = await this.page.request.post('/api/createRoom', {
      data: { name: roomName, maxParticipants: 10 }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    return data.roomId;
  }

  /**
   * Join a room by ID
   */
  async joinRoom(roomId: string) {
    await this.page.goto(`/room/${roomId}`);
    await expect(this.page.locator('[data-testid="room-interface"]')).toBeVisible();
  }

  /**
   * Wait for video element to have video content
   */
  async waitForVideoContent(videoSelector: string) {
    await this.page.waitForFunction((selector) => {
      const video = document.querySelector(selector) as HTMLVideoElement;
      return video && video.videoWidth > 0 && video.videoHeight > 0;
    }, videoSelector, { timeout: 10000 });
  }

  /**
   * Simulate screen sharing
   */
  async startScreenShare() {
    await this.page.click('[data-testid="screen-share-button"]');
    await expect(this.page.locator('[data-testid="screen-share-active"]')).toBeVisible();
  }

  /**
   * Send a chat message
   */
  async sendChatMessage(message: string) {
    await this.page.fill('[data-testid="chat-input"]', message);
    await this.page.press('[data-testid="chat-input"]', 'Enter');
    await expect(this.page.locator('[data-testid="chat-messages"]')).toContainText(message);
  }

  /**
   * Toggle audio mute
   */
  async toggleAudio() {
    await this.page.click('[data-testid="audio-toggle"]');
  }

  /**
   * Toggle video mute
   */
  async toggleVideo() {
    await this.page.click('[data-testid="video-toggle"]');
  }

  /**
   * Get the current connection status
   */
  async getConnectionStatus(): Promise<string> {
    return await this.page.locator('[data-testid="connection-status"]').textContent() || '';
  }

  /**
   * Wait for a specific number of participants
   */
  async waitForParticipantCount(count: number) {
    await this.page.waitForFunction((expectedCount) => {
      const participants = document.querySelectorAll('[data-testid="participant"]');
      return participants.length === expectedCount;
    }, count, { timeout: 15000 });
  }

  /**
   * Simulate network disconnection
   */
  async simulateNetworkDisconnection() {
    await this.page.context().setOffline(true);
  }

  /**
   * Restore network connection
   */
  async restoreNetworkConnection() {
    await this.page.context().setOffline(false);
  }

  /**
   * Take a screenshot with timestamp
   */
  async screenshotWithTimestamp(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true 
    });
  }

  /**
   * Wait for element to be visible with custom timeout
   */
  async waitForVisible(selector: string, timeout: number = 5000) {
    await expect(this.page.locator(selector)).toBeVisible({ timeout });
  }

  /**
   * Check if element exists without throwing
   */
  async elementExists(selector: string): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }
}