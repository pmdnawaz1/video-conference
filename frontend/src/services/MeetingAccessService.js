import userAnalyticsService from './UserAnalyticsService';

class MeetingAccessService {
  constructor() {
    this.baseURL = '/api/meetings';
  }

  /**
   * Validates user access to a meeting
   * @param {string} meetingId - Meeting ID
   * @param {string} userId - User ID (optional if using session)
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async validateAccess(meetingId, userId = null) {
    try {
      const response = await fetch(`${this.baseURL}/${meetingId}/access-validation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({
          user_id: userId,
          timestamp: Date.now()
        })
      });

      const result = await response.json();

      if (response.ok) {
        userAnalyticsService.trackEvent('meeting_access_validated', {
          meeting_id: meetingId,
          access_granted: result.access_granted,
          validation_reason: result.reason,
          timestamp: Date.now()
        });

        return {
          success: true,
          data: {
            accessGranted: result.access_granted,
            reason: result.reason,
            meetingInfo: result.meeting_info,
            userPermissions: result.user_permissions,
            waitingRoomRequired: result.waiting_room_required,
            timeRestrictions: result.time_restrictions
          }
        };
      } else {
        return {
          success: false,
          error: result.message || 'Failed to validate meeting access'
        };
      }
    } catch (error) {
      console.error('Meeting access validation error:', error);
      return {
        success: false,
        error: 'Network error during access validation'
      };
    }
  }

  /**
   * Checks if meeting is within allowed time boundaries
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async checkTimeRestrictions(meetingId) {
    try {
      const response = await fetch(`${this.baseURL}/${meetingId}/time-check`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      const result = await response.json();

      if (response.ok) {
        return {
          success: true,
          data: {
            canJoin: result.can_join,
            status: result.status,
            timeUntilStart: result.time_until_start,
            timeUntilEnd: result.time_until_end,
            bufferTime: result.buffer_time,
            scheduledStart: result.scheduled_start,
            scheduledEnd: result.scheduled_end,
            actualStart: result.actual_start,
            actualEnd: result.actual_end
          }
        };
      } else {
        return {
          success: false,
          error: result.message || 'Failed to check time restrictions'
        };
      }
    } catch (error) {
      console.error('Time restriction check error:', error);
      return {
        success: false,
        error: 'Network error during time check'
      };
    }
  }

  /**
   * Joins user to meeting waiting room
   * @param {string} meetingId - Meeting ID
   * @param {object} userInfo - User information
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async joinWaitingRoom(meetingId, userInfo = {}) {
    try {
      const response = await fetch(`${this.baseURL}/${meetingId}/waiting-room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({
          user_info: userInfo,
          join_time: Date.now()
        })
      });

      const result = await response.json();

      if (response.ok) {
        userAnalyticsService.trackEvent('waiting_room_joined', {
          meeting_id: meetingId,
          timestamp: Date.now()
        });

        return {
          success: true,
          data: {
            waitingRoomId: result.waiting_room_id,
            queuePosition: result.queue_position,
            estimatedWait: result.estimated_wait,
            message: result.message
          }
        };
      } else {
        return {
          success: false,
          error: result.message || 'Failed to join waiting room'
        };
      }
    } catch (error) {
      console.error('Waiting room join error:', error);
      return {
        success: false,
        error: 'Network error joining waiting room'
      };
    }
  }

  /**
   * Gets waiting room status for user
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async getWaitingRoomStatus(meetingId) {
    try {
      const response = await fetch(`${this.baseURL}/${meetingId}/waiting-room/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      const result = await response.json();

      if (response.ok) {
        return {
          success: true,
          data: {
            inWaitingRoom: result.in_waiting_room,
            queuePosition: result.queue_position,
            estimatedWait: result.estimated_wait,
            admitted: result.admitted,
            denied: result.denied,
            denialReason: result.denial_reason
          }
        };
      } else {
        return {
          success: false,
          error: result.message || 'Failed to get waiting room status'
        };
      }
    } catch (error) {
      console.error('Waiting room status error:', error);
      return {
        success: false,
        error: 'Network error getting waiting room status'
      };
    }
  }

  /**
   * Attempts to join meeting directly
   * @param {string} meetingId - Meeting ID
   * @param {object} joinOptions - Join configuration
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async joinMeeting(meetingId, joinOptions = {}) {
    try {
      const response = await fetch(`${this.baseURL}/${meetingId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({
          audio_enabled: joinOptions.audioEnabled || false,
          video_enabled: joinOptions.videoEnabled || false,
          screen_share_enabled: joinOptions.screenShareEnabled || false,
          join_options: joinOptions,
          timestamp: Date.now()
        })
      });

      const result = await response.json();

      if (response.ok) {
        userAnalyticsService.trackEvent('meeting_join_attempted', {
          meeting_id: meetingId,
          success: true,
          join_method: 'direct',
          timestamp: Date.now()
        });

        return {
          success: true,
          data: {
            meetingToken: result.meeting_token,
            userPermissions: result.user_permissions,
            meetingSettings: result.meeting_settings,
            participantInfo: result.participant_info
          }
        };
      } else {
        userAnalyticsService.trackEvent('meeting_join_attempted', {
          meeting_id: meetingId,
          success: false,
          error: result.message,
          timestamp: Date.now()
        });

        return {
          success: false,
          error: result.message || 'Failed to join meeting'
        };
      }
    } catch (error) {
      console.error('Meeting join error:', error);
      userAnalyticsService.trackEvent('meeting_join_attempted', {
        meeting_id: meetingId,
        success: false,
        error: 'Network error',
        timestamp: Date.now()
      });

      return {
        success: false,
        error: 'Network error joining meeting'
      };
    }
  }

  /**
   * Gets user's meeting history for validation
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async getUserMeetingHistory(meetingId) {
    try {
      const response = await fetch(`${this.baseURL}/${meetingId}/user-history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      const result = await response.json();

      if (response.ok) {
        return {
          success: true,
          data: {
            previousParticipation: result.previous_participation,
            participationCount: result.participation_count,
            lastJoinTime: result.last_join_time,
            averageParticipation: result.average_participation,
            meetingRole: result.meeting_role
          }
        };
      } else {
        return {
          success: false,
          error: result.message || 'Failed to get meeting history'
        };
      }
    } catch (error) {
      console.error('Meeting history error:', error);
      return {
        success: false,
        error: 'Network error getting meeting history'
      };
    }
  }

  /**
   * Validates organization membership
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async validateOrganizationMembership(meetingId) {
    try {
      const response = await fetch(`${this.baseURL}/${meetingId}/organization-validation`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      const result = await response.json();

      if (response.ok) {
        return {
          success: true,
          data: {
            isMember: result.is_member,
            organizationId: result.organization_id,
            organizationName: result.organization_name,
            membershipType: result.membership_type,
            canJoin: result.can_join
          }
        };
      } else {
        return {
          success: false,
          error: result.message || 'Failed to validate organization membership'
        };
      }
    } catch (error) {
      console.error('Organization validation error:', error);
      return {
        success: false,
        error: 'Network error validating organization membership'
      };
    }
  }

  /**
   * Gets comprehensive meeting access information
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async getMeetingAccessInfo(meetingId) {
    try {
      const [accessValidation, timeCheck, orgValidation, userHistory] = await Promise.allSettled([
        this.validateAccess(meetingId),
        this.checkTimeRestrictions(meetingId),
        this.validateOrganizationMembership(meetingId),
        this.getUserMeetingHistory(meetingId)
      ]);

      const result = {
        access: accessValidation.status === 'fulfilled' ? accessValidation.value : { success: false, error: 'Access validation failed' },
        time: timeCheck.status === 'fulfilled' ? timeCheck.value : { success: false, error: 'Time check failed' },
        organization: orgValidation.status === 'fulfilled' ? orgValidation.value : { success: false, error: 'Organization validation failed' },
        history: userHistory.status === 'fulfilled' ? userHistory.value : { success: false, error: 'History check failed' }
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Meeting access info error:', error);
      return {
        success: false,
        error: 'Failed to get meeting access information'
      };
    }
  }

  /**
   * Gets authentication token from storage
   * @returns {string|null}
   */
  getToken() {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  }

  /**
   * Utility method to format time remaining
   * @param {number} seconds - Seconds remaining
   * @returns {string}
   */
  formatTimeRemaining(seconds) {
    if (seconds <= 0) return 'Now';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Gets meeting status description
   * @param {string} status - Meeting status
   * @returns {string}
   */
  getStatusDescription(status) {
    const descriptions = {
      'not_started': 'Meeting has not started yet',
      'waiting_to_start': 'Meeting is scheduled but not yet active',
      'active': 'Meeting is currently in progress',
      'ended': 'Meeting has ended',
      'cancelled': 'Meeting was cancelled',
      'locked': 'Meeting is locked by organizer',
      'full': 'Meeting has reached maximum capacity'
    };

    return descriptions[status] || 'Unknown meeting status';
  }
}

const meetingAccessService = new MeetingAccessService();
export default meetingAccessService;