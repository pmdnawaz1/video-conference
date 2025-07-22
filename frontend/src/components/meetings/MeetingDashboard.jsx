import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useMeetingStore from '../../stores/meetingStore';
import useAuthStore from '../../stores/authStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import InvitationForm from './InvitationForm';
import { useTheme } from '../../contexts/ThemeContext';
import { MdDarkMode, MdLightMode } from 'react-icons/md';
import { FiPlus, FiShare, FiUsers, FiLogOut } from 'react-icons/fi';

const MeetingDashboard = () => {
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  
  // Helper function to get default datetime values
  const getDefaultStartTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30); // 30 minutes from now
    return now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:MM
  };
  
  const getDefaultEndTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 90); // 1.5 hours from now
    return now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:MM
  };

  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    scheduled_start: getDefaultStartTime(),
    scheduled_end: getDefaultEndTime(),
    max_participants: 10
  });

  const {
    meetings,
    isLoading,
    isCreating,
    error,
    fetchMeetings,
    createMeeting,
    startMeeting,
    endMeeting,
    getUpcomingMeetings,
    getActiveMeetings,
    getPastMeetings
  } = useMeetingStore();

  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleDarkMode } = useTheme();

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    
    if (!newMeeting.title || !newMeeting.scheduled_start || !newMeeting.scheduled_end) {
      return;
    }

    // Convert datetime-local format to ISO string
    const meetingData = {
      ...newMeeting,
      scheduled_start: new Date(newMeeting.scheduled_start).toISOString(),
      scheduled_end: new Date(newMeeting.scheduled_end).toISOString()
    };

    const result = await createMeeting(meetingData);
    
    if (result.success) {
      setShowCreateForm(false);
      setNewMeeting({
        title: '',
        description: '',
        scheduled_start: getDefaultStartTime(),
        scheduled_end: getDefaultEndTime(),
        max_participants: 10
      });
    }
  };

  const handleStartInstantMeeting = async () => {
    try {
      const now = new Date();
      const endTime = new Date();
      endTime.setHours(endTime.getHours() + 1); // 1 hour duration by default

      const instantMeeting = {
        title: `Instant Meeting - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
        description: 'Quick meeting started instantly',
        scheduled_start: now.toISOString(),
        scheduled_end: endTime.toISOString(),
        max_participants: 10
      };

      console.log('Creating instant meeting:', instantMeeting);
      const result = await createMeeting(instantMeeting);
      console.log('Create meeting result:', result);
      
      if (result.success) {
        // Immediately start the meeting after creating it
        const meeting = result.meeting; // The meeting data is in result.meeting, not result.data
        console.log('Starting meeting with ID:', meeting.id);
        const startResult = await startMeeting(meeting.id);
        console.log('Start meeting result:', startResult);
        
        if (startResult.success) {
          console.log('Instant meeting started:', startResult.data);
          // Redirect to video conference room
          navigate(`/meeting/${meeting.meeting_id}`);
        } else {
          console.error('Failed to start meeting:', startResult.error);
          alert('Meeting created but failed to start: ' + (startResult.error || 'Unknown error'));
        }
      } else {
        console.error('Failed to create meeting:', result.error);
        alert('Failed to create instant meeting: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error in handleStartInstantMeeting:', error);
      alert('Error creating instant meeting: ' + error.message);
    }
  };

  const handleStartMeeting = async (meetingId) => {
    const result = await startMeeting(meetingId);
    if (result.success) {
      // In a real app, redirect to video conference room
      console.log('Meeting started:', result.data);
    }
  };

  const handleEndMeeting = async (meetingId) => {
    const result = await endMeeting(meetingId);
    if (result.success) {
      console.log('Meeting ended:', result.data);
    }
  };

  const handleInviteUsers = (meeting) => {
    setSelectedMeeting(meeting);
    setShowInviteForm(true);
  };

  const handleSendInvitations = async (emails) => {
    if (!selectedMeeting || !emails.length) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${useAuthStore.getState().accessToken}`,
        },
        body: JSON.stringify({
          meeting_id: selectedMeeting.id,
          emails: emails,
          message: `You're invited to join: ${selectedMeeting.title}`
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        alert(`Invitations sent successfully to ${emails.join(', ')}`);
        setShowInviteForm(false);
        setSelectedMeeting(null);
      } else {
        alert('Failed to send invitations: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending invitations:', error);
      alert('Error sending invitations: ' + error.message);
    }
  };

  const generateMeetingLink = (meetingId) => {
    return `${window.location.origin}/meeting/${meetingId}`;
  };

  const handleCopyMeetingLink = async (meeting) => {
    const meetingLink = generateMeetingLink(meeting.meeting_id);
    
    try {
      await navigator.clipboard.writeText(meetingLink);
      alert('Meeting link copied to clipboard!');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = meetingLink;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        alert('Meeting link copied to clipboard!');
      } catch (fallbackError) {
        alert(`Failed to copy link. Please copy manually: ${meetingLink}`);
      }
      
      document.body.removeChild(textArea);
    }
  };

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString();
  };

  const upcomingMeetings = getUpcomingMeetings();
  const activeMeetings = getActiveMeetings();
  const pastMeetings = getPastMeetings();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Meeting Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {user?.first_name}!</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={toggleDarkMode}
                variant="outline"
                size="sm"
              >
                {isDarkMode ? <MdLightMode className="w-4 h-4" /> : <MdDarkMode className="w-4 h-4" />}
              </Button>
              <Button
                onClick={handleStartInstantMeeting}
                disabled={isCreating}
                className="bg-green-600 hover:bg-green-700"
              >
                {isCreating ? (
                  <>
                    <LoadingSpinner className="w-4 h-4 mr-2" />
                    Starting...
                  </>
                ) : (
                  <>
                    <FiPlus className="w-4 h-4 mr-2" />
                    Start Instant Meeting
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <FiPlus className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
              <Button
                onClick={logout}
                variant="outline"
              >
                <FiLogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {/* Create Meeting Form */}
        {showCreateForm && (
          <Card className="mb-8 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Schedule New Meeting</h2>
              <Button
                onClick={() => setShowCreateForm(false)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
            
            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Meeting Title *</label>
                <Input
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting(prev => ({...prev, title: e.target.value}))}
                  placeholder="Enter meeting title"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting(prev => ({...prev, description: e.target.value}))}
                  placeholder="Enter meeting description"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time *</label>
                  <Input
                    type="datetime-local"
                    value={newMeeting.scheduled_start}
                    onChange={(e) => setNewMeeting(prev => ({...prev, scheduled_start: e.target.value}))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">End Time *</label>
                  <Input
                    type="datetime-local"
                    value={newMeeting.scheduled_end}
                    onChange={(e) => setNewMeeting(prev => ({...prev, scheduled_end: e.target.value}))}
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Max Participants</label>
                <Input
                  type="number"
                  min="2"
                  max="100"
                  value={newMeeting.max_participants}
                  onChange={(e) => setNewMeeting(prev => ({...prev, max_participants: parseInt(e.target.value)}))}
                />
              </div>
              
              <Button
                type="submit"
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <LoadingSpinner className="w-4 h-4 mr-2" />
                    Creating...
                  </>
                ) : (
                  'Schedule Meeting'
                )}
              </Button>
            </form>
          </Card>
        )}

        {/* Invite Users Form */}
        {showInviteForm && selectedMeeting && (
          <Card className="mb-8 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Invite Users to: {selectedMeeting.title}</h2>
              <Button
                onClick={() => {
                  setShowInviteForm(false);
                  setSelectedMeeting(null);
                }}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
            
            <InvitationForm 
              meeting={selectedMeeting}
              onSendInvitations={handleSendInvitations}
              onCancel={() => {
                setShowInviteForm(false);
                setSelectedMeeting(null);
              }}
            />
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner className="w-8 h-8" />
            <span className="ml-2">Loading meetings...</span>
          </div>
        )}

        {/* Meetings Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Active Meetings */}
            <div>
              <h2 className="text-lg font-semibold mb-4 text-green-600">Active Meetings</h2>
              <div className="space-y-4">
                {activeMeetings.length === 0 ? (
                  <Card className="p-4">
                    <p className="text-gray-500 text-center">No active meetings</p>
                  </Card>
                ) : (
                  activeMeetings.map(meeting => (
                    <Card key={meeting.id} className="p-4 border-green-200">
                      <h3 className="font-medium mb-2">{meeting.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{meeting.description}</p>
                      <p className="text-xs text-gray-500 mb-3">
                        Started: {formatDateTime(meeting.scheduled_start)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1 min-w-0"
                          onClick={() => navigate(`/meeting/${meeting.meeting_id}`)}
                        >
                          Join
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleInviteUsers(meeting)}
                        >
                          Invite
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyMeetingLink(meeting)}
                          title="Copy meeting link"
                        >
                          Share
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEndMeeting(meeting.id)}
                        >
                          End
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Upcoming Meetings */}
            <div>
              <h2 className="text-lg font-semibold mb-4 text-blue-600">Upcoming Meetings</h2>
              <div className="space-y-4">
                {upcomingMeetings.length === 0 ? (
                  <Card className="p-4">
                    <p className="text-gray-500 text-center">No upcoming meetings</p>
                  </Card>
                ) : (
                  upcomingMeetings.map(meeting => (
                    <Card key={meeting.id} className="p-4 border-blue-200">
                      <h3 className="font-medium mb-2">{meeting.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{meeting.description}</p>
                      <p className="text-xs text-gray-500 mb-3">
                        Starts: {formatDateTime(meeting.scheduled_start)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="flex-1 min-w-0"
                          onClick={() => {
                            handleStartMeeting(meeting.id);
                            navigate(`/meeting/${meeting.meeting_id}`);
                          }}
                        >
                          Start Meeting
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleInviteUsers(meeting)}
                        >
                          Invite
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyMeetingLink(meeting)}
                          title="Copy meeting link"
                        >
                          Share
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Past Meetings */}
            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-600">Past Meetings</h2>
              <div className="space-y-4">
                {pastMeetings.slice(0, 5).length === 0 ? (
                  <Card className="p-4">
                    <p className="text-gray-500 text-center">No past meetings</p>
                  </Card>
                ) : (
                  pastMeetings.slice(0, 5).map(meeting => (
                    <Card key={meeting.id} className="p-4 border-gray-200">
                      <h3 className="font-medium mb-2">{meeting.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{meeting.description}</p>
                      <p className="text-xs text-gray-500 mb-3">
                        Ended: {formatDateTime(meeting.scheduled_end)}
                      </p>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyMeetingLink(meeting)}
                          title="Copy meeting link"
                        >
                          Share Link
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingDashboard;