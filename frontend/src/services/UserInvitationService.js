import { generateSecureToken, hashPassword } from '../utils/crypto';

class UserInvitationService {
  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  }

  // Get authenticated headers
  getAuthHeaders(accessToken = null) {
    // Get token from auth store if not provided
    const token = accessToken || this.getAccessTokenFromStore();
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  getAccessTokenFromStore() {
    // Import auth store dynamically to avoid circular dependencies
    const { useAuthStore } = require('../stores/authStore');
    return useAuthStore.getState().accessToken;
  }

  // Admin functions - Create and manage user invitations
  async createUserInvitation(invitationData) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/admin/users/invite`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          email: invitationData.email,
          first_name: invitationData.firstName,
          last_name: invitationData.lastName,
          role: invitationData.role || 'user',
          department: invitationData.department || null,
          organization_id: invitationData.organizationId,
          invited_by: invitationData.invitedBy,
          expires_at: invitationData.expiresAt || this.getDefaultExpiry(),
          send_email: invitationData.sendEmail !== false,
          custom_message: invitationData.customMessage || null,
          permissions: invitationData.permissions || [],
          groups: invitationData.groups || []
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          invitation: result.data,
          token: result.data.token
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to create user invitation',
          details: result.details || null
        };
      }

    } catch (error) {
      console.error('UserInvitationService: Error creating invitation:', error);
      return {
        success: false,
        error: 'Network error - unable to create invitation',
        details: error.message
      };
    }
  }

  // Bulk user invitation creation
  async createBulkUserInvitations(invitationsData) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/admin/users/invite/bulk`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          invitations: invitationsData.map(invitation => ({
            email: invitation.email,
            first_name: invitation.firstName,
            last_name: invitation.lastName,
            role: invitation.role || 'user',
            department: invitation.department || null,
            organization_id: invitation.organizationId,
            invited_by: invitation.invitedBy,
            expires_at: invitation.expiresAt || this.getDefaultExpiry(),
            send_email: invitation.sendEmail !== false,
            custom_message: invitation.customMessage || null,
            permissions: invitation.permissions || [],
            groups: invitation.groups || []
          })),
          batch_size: invitationsData.batchSize || 10,
          delay_between_emails: invitationsData.emailDelay || 1000
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          results: result.data.results,
          successful: result.data.successful_count,
          failed: result.data.failed_count,
          errors: result.data.errors || []
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to create bulk invitations',
          details: result.details || null
        };
      }

    } catch (error) {
      console.error('UserInvitationService: Error creating bulk invitations:', error);
      return {
        success: false,
        error: 'Network error - unable to create bulk invitations',
        details: error.message
      };
    }
  }

  // Get all user invitations for admin
  async getAllUserInvitations(filters = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: filters.page || 1,
        limit: filters.limit || 20,
        status: filters.status || 'all',
        organization_id: filters.organizationId || '',
        invited_by: filters.invitedBy || '',
        role: filters.role || '',
        sort_by: filters.sortBy || 'created_at',
        sort_order: filters.sortOrder || 'desc'
      });

      const response = await fetch(`${this.apiBaseUrl}/admin/users/invitations?${queryParams}`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          invitations: result.data.invitations,
          pagination: result.data.pagination,
          stats: result.data.stats
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to fetch user invitations',
          details: result.details || null
        };
      }

    } catch (error) {
      console.error('UserInvitationService: Error fetching invitations:', error);
      return {
        success: false,
        error: 'Network error - unable to fetch invitations',
        details: error.message
      };
    }
  }

  // Resend user invitation
  async resendUserInvitation(invitationId, customMessage = null) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/admin/users/invitations/${invitationId}/resend`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          custom_message: customMessage,
          extend_expiry: true // Extend expiry when resending
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          invitation: result.data
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to resend invitation',
          details: result.details || null
        };
      }

    } catch (error) {
      console.error('UserInvitationService: Error resending invitation:', error);
      return {
        success: false,
        error: 'Network error - unable to resend invitation',
        details: error.message
      };
    }
  }

  // Cancel user invitation
  async cancelUserInvitation(invitationId, reason = null) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/admin/users/invitations/${invitationId}/cancel`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          cancellation_reason: reason
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          invitation: result.data
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to cancel invitation',
          details: result.details || null
        };
      }

    } catch (error) {
      console.error('UserInvitationService: Error cancelling invitation:', error);
      return {
        success: false,
        error: 'Network error - unable to cancel invitation',
        details: error.message
      };
    }
  }

  // Public functions - User invitation validation and completion
  async validateUserInvitationToken(token) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/public/user-invitation/${token}/validate`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          invitation: result.data.invitation,
          organization: result.data.organization,
          admin: result.data.admin,
          isValid: true,
          isExpired: false
        };
      } else if (response.status === 400 && result.error === 'TOKEN_EXPIRED') {
        return {
          success: false,
          error: 'Invitation has expired',
          isValid: false,
          isExpired: true,
          details: result.details
        };
      } else if (response.status === 404) {
        return {
          success: false,
          error: 'Invalid or non-existent invitation',
          isValid: false,
          isExpired: false,
          details: result.details
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to validate invitation',
          isValid: false,
          isExpired: false,
          details: result.details || null
        };
      }

    } catch (error) {
      console.error('UserInvitationService: Error validating token:', error);
      return {
        success: false,
        error: 'Network error - unable to validate invitation',
        isValid: false,
        isExpired: false,
        details: error.message
      };
    }
  }

  // Complete user registration from invitation
  async completeUserRegistration(token, registrationData) {
    try {
      // Validate password strength
      const passwordValidation = this.validatePassword(registrationData.password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: 'Password does not meet requirements',
          details: passwordValidation.errors
        };
      }

      // Ensure passwords match
      if (registrationData.password !== registrationData.confirmPassword) {
        return {
          success: false,
          error: 'Passwords do not match'
        };
      }

      const response = await fetch(`${this.apiBaseUrl}/public/user-invitation/${token}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: registrationData.password,
          first_name: registrationData.firstName,
          last_name: registrationData.lastName,
          phone: registrationData.phone || null,
          timezone: registrationData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: registrationData.language || 'en',
          profile_picture: registrationData.profilePicture || null,
          bio: registrationData.bio || null,
          notifications_enabled: registrationData.notificationsEnabled !== false,
          terms_accepted: registrationData.termsAccepted === true,
          privacy_accepted: registrationData.privacyAccepted === true,
          marketing_consent: registrationData.marketingConsent === true,
          preferences: {
            theme: registrationData.theme || 'light',
            language: registrationData.language || 'en',
            timezone: registrationData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            email_notifications: registrationData.emailNotifications !== false,
            browser_notifications: registrationData.browserNotifications !== false,
            meeting_reminders: registrationData.meetingReminders !== false
          }
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          user: result.data.user,
          tokens: {
            accessToken: result.data.access_token,
            refreshToken: result.data.refresh_token
          },
          organization: result.data.organization
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to complete registration',
          details: result.details || null,
          fieldErrors: result.field_errors || null
        };
      }

    } catch (error) {
      console.error('UserInvitationService: Error completing registration:', error);
      return {
        success: false,
        error: 'Network error - unable to complete registration',
        details: error.message
      };
    }
  }

  // Password validation
  validatePassword(password) {
    const errors = [];
    let isValid = true;

    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters long');
      isValid = false;
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
      isValid = false;
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
      isValid = false;
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
      isValid = false;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
      isValid = false;
    }

    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
      isValid = false;
    }

    return { isValid, errors };
  }

  // Email validation
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Get invitation statistics
  async getInvitationStats(organizationId = null, timeRange = '30d') {
    try {
      const queryParams = new URLSearchParams({
        organization_id: organizationId || '',
        time_range: timeRange
      });

      const response = await fetch(`${this.apiBaseUrl}/admin/users/invitations/stats?${queryParams}`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          stats: result.data
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to fetch invitation statistics',
          details: result.details || null
        };
      }

    } catch (error) {
      console.error('UserInvitationService: Error fetching stats:', error);
      return {
        success: false,
        error: 'Network error - unable to fetch statistics',
        details: error.message
      };
    }
  }

  // Utility methods
  getDefaultExpiry() {
    // Default expiry: 7 days from now
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);
    return expiryDate.toISOString();
  }

  generateInvitationUrl(token) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/user-invitation/${token}`;
  }

  getInvitationStatus(invitation) {
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    
    if (invitation.status === 'completed') {
      return { status: 'completed', label: 'Completed', color: 'green' };
    } else if (invitation.status === 'cancelled') {
      return { status: 'cancelled', label: 'Cancelled', color: 'red' };
    } else if (now > expiresAt) {
      return { status: 'expired', label: 'Expired', color: 'orange' };
    } else {
      return { status: 'pending', label: 'Pending', color: 'blue' };
    }
  }

  formatInvitationForDisplay(invitation) {
    const status = this.getInvitationStatus(invitation);
    
    return {
      ...invitation,
      displayStatus: status,
      invitationUrl: this.generateInvitationUrl(invitation.token),
      timeRemaining: this.getTimeRemaining(invitation.expires_at),
      formattedCreatedAt: new Date(invitation.created_at).toLocaleDateString(),
      formattedExpiresAt: new Date(invitation.expires_at).toLocaleDateString()
    };
  }

  getTimeRemaining(expiresAt) {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const timeDiff = expiry - now;

    if (timeDiff <= 0) {
      return 'Expired';
    }

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }

  // Template management for invitation emails
  async getEmailTemplates() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/admin/email-templates/user-invitation`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          templates: result.data
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to fetch email templates'
        };
      }

    } catch (error) {
      return {
        success: false,
        error: 'Network error - unable to fetch templates',
        details: error.message
      };
    }
  }

  async updateEmailTemplate(templateId, templateData) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/admin/email-templates/${templateId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(templateData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          template: result.data
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to update email template'
        };
      }

    } catch (error) {
      return {
        success: false,
        error: 'Network error - unable to update template',
        details: error.message
      };
    }
  }
}

// Singleton instance
const userInvitationService = new UserInvitationService();

export default userInvitationService;