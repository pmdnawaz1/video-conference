import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Authentication E2E Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Check if login form elements are present
    await expect(page.locator('h1')).toContainText(/login|sign in/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should display registration page correctly', async ({ page }) => {
    await page.goto('/register');
    
    // Check if registration form elements are present
    await expect(page.locator('h1')).toContainText(/register|sign up/i);
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in login form
    await page.fill('input[type="email"]', 'testuser1@test.e2e');
    await page.fill('input[type="password"]', 'password');
    
    // Submit form and wait for response
    const loginPromise = page.waitForResponse('**/api/auth/login');
    await page.click('button[type="submit"]');
    
    const response = await loginPromise;
    expect(response.status()).toBe(200);
    
    // Check if redirected to dashboard or main app
    await expect(page).toHaveURL(/\/(dashboard|app|home)/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in login form with invalid credentials
    await page.fill('input[type="email"]', 'invalid@test.e2e');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Check for error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    
    // Should remain on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should successfully register new user', async ({ page }) => {
    await page.goto('/register');
    
    const timestamp = Date.now();
    const testEmail = `newuser${timestamp}@test.e2e`;
    
    // Fill in registration form
    await page.fill('input[name="firstName"]', 'New');
    await page.fill('input[name="lastName"]', 'User');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'password123');
    
    // Submit form and wait for response
    const registerPromise = page.waitForResponse('**/api/auth/register');
    await page.click('button[type="submit"]');
    
    const response = await registerPromise;
    expect(response.status()).toBe(201);
    
    // Check if redirected to login or dashboard
    await expect(page).toHaveURL(/\/(login|dashboard|app)/);
  });

  test('should show validation errors for invalid registration data', async ({ page }) => {
    await page.goto('/register');
    
    // Try to submit with invalid email
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'User');
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', '123'); // Too short
    
    await page.click('button[type="submit"]');
    
    // Check for validation errors
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.goto('/login');
    
    // Simulate network failure
    await page.route('**/api/auth/login', (route) => {
      route.abort('failed');
    });
    
    await page.fill('input[type="email"]', 'testuser1@test.e2e');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Should show network error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/network|connection/i);
  });

  test('should logout user correctly', async ({ page }) => {
    // First login
    await helpers.loginAsTestUser();
    
    // Click logout button
    await page.click('[data-testid="logout-button"]');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
    
    // Should clear authentication state
    const isAuthenticated = await page.evaluate(() => {
      const authData = localStorage.getItem('enterprise-auth');
      return authData ? JSON.parse(authData).state.isAuthenticated : false;
    });
    
    expect(isAuthenticated).toBe(false);
  });

  test('should persist authentication state on page reload', async ({ page }) => {
    // Login
    await helpers.loginAsTestUser();
    
    // Reload page
    await page.reload();
    
    // Should still be authenticated
    await expect(page).toHaveURL(/\/dashboard/);
    
    const isAuthenticated = await page.evaluate(() => {
      const authData = localStorage.getItem('enterprise-auth');
      return authData ? JSON.parse(authData).state.isAuthenticated : false;
    });
    
    expect(isAuthenticated).toBe(true);
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/dashboard');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle JWT token expiration', async ({ page }) => {
    // Login first
    await helpers.loginAsTestUser();
    
    // Simulate expired token by modifying localStorage
    await page.evaluate(() => {
      const authData = JSON.parse(localStorage.getItem('enterprise-auth') || '{}');
      authData.state.accessToken = 'expired.jwt.token';
      localStorage.setItem('enterprise-auth', JSON.stringify(authData));
    });
    
    // Try to make authenticated request
    await page.goto('/dashboard');
    
    // Should handle token expiration and redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});