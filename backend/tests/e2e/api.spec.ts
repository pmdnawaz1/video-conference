import { test, expect } from '@playwright/test';

test.describe('API Endpoints E2E Tests', () => {
  
  test('health endpoint should return OK', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('OK');
    expect(data.services.database.status).toBe('healthy');
  });

  test('auth/register endpoint should handle registration', async ({ request }) => {
    const timestamp = Date.now();
    const userData = {
      firstName: 'Test',
      lastName: 'User',
      email: `apitest${timestamp}@test.e2e`,
      password: 'testpassword123',
      displayName: 'API Test User'
    };

    const response = await request.post('/api/auth/register', {
      data: userData
    });

    expect(response.status()).toBe(201);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.email).toBe(userData.email);
  });

  test('auth/login endpoint should handle authentication', async ({ request }) => {
    // First register a user
    const timestamp = Date.now();
    const userData = {
      firstName: 'Login',
      lastName: 'Test',
      email: `logintest${timestamp}@test.e2e`,
      password: 'testpassword123'
    };

    await request.post('/api/auth/register', { data: userData });

    // Then try to login
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: userData.email,
        password: userData.password
      }
    });

    expect(loginResponse.status()).toBe(200);
    
    const loginData = await loginResponse.json();
    expect(loginData.success).toBe(true);
    expect(loginData.accessToken).toBeDefined();
    expect(loginData.user.email).toBe(userData.email);
  });

  test('auth/login should reject invalid credentials', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'nonexistent@test.e2e',
        password: 'wrongpassword'
      }
    });

    expect(response.status()).toBe(401);
    
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  test('createRoom endpoint should create a room', async ({ request }) => {
    const response = await request.post('/api/createRoom', {
      data: {
        name: 'API Test Room',
        maxParticipants: 5
      }
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.roomId).toBeDefined();
    expect(data.roomName).toBe('API Test Room');
  });

  test('webrtc-config endpoint should return ICE servers', async ({ request }) => {
    const response = await request.get('/api/webrtc-config');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.iceServers).toBeDefined();
    expect(Array.isArray(data.iceServers)).toBe(true);
    expect(data.meta).toBeDefined();
  });

  test('rooms endpoint should list rooms', async ({ request }) => {
    const response = await request.get('/api/rooms');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.rooms)).toBe(true);
  });

  test('CORS headers should be present', async ({ request }) => {
    const response = await request.options('/api/auth/login');
    
    const corsOrigin = response.headers()['access-control-allow-origin'];
    const corsMethods = response.headers()['access-control-allow-methods'];
    const corsHeaders = response.headers()['access-control-allow-headers'];
    
    expect(corsOrigin).toBeDefined();
    expect(corsMethods).toContain('POST');
    expect(corsHeaders).toContain('Content-Type');
  });

  test('protected endpoint should require authentication', async ({ request }) => {
    const response = await request.get('/api/auth/me');
    expect(response.status()).toBe(401);
  });

  test('protected endpoint should work with valid token', async ({ request }) => {
    // First register and login to get token
    const timestamp = Date.now();
    const userData = {
      firstName: 'Auth',
      lastName: 'Test',
      email: `authtest${timestamp}@test.e2e`,
      password: 'testpassword123'
    };

    await request.post('/api/auth/register', { data: userData });
    
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: userData.email,
        password: userData.password
      }
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.accessToken;

    // Now use the token to access protected endpoint
    const protectedResponse = await request.get('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(protectedResponse.status()).toBe(200);
    
    const protectedData = await protectedResponse.json();
    expect(protectedData.success).toBe(true);
    expect(protectedData.user.email).toBe(userData.email);
  });
});