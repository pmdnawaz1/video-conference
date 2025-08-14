import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MeetingAccessValidator from './MeetingAccessValidator';
import MeetingWaitingRoom from './MeetingWaitingRoom';
import MeetingTimeRestriction from './MeetingTimeRestriction';
import VideoConference from './VideoConference';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { 
  AlertTriangle, 
  ArrowLeft, 
  RefreshCw,
  Loader2,
  XCircle
} from 'lucide-react';
import meetingAccessService from '../../services/MeetingAccessService';
import userAnalyticsService from '../../services/UserAnalyticsService';
import useAuthStore from '../../stores/authStore';
import LoadingSpinner from '../ui/LoadingSpinner';

const MeetingJoinFlow = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  // Flow state management
  const [currentStep, setCurrentStep] = useState('initializing'); // initializing, validating, waiting_room, time_restriction, joining, in_meeting, error
  const [error, setError] = useState(null);
  const [accessData, setAccessData] = useState(null);
  const [meetingData, setMeetingData] = useState(null);
  const [waitingRoomData, setWaitingRoomData] = useState(null);
  const [timeRestrictionData, setTimeRestrictionData] = useState(null);
  const [joinOptions, setJoinOptions] = useState({
    audioEnabled: false,
    videoEnabled: false,
    screenShareEnabled: false
  });
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { 
        state: { 
          returnUrl: `/meeting/${meetingId}`,
          message: 'Please log in to join the meeting'
        }
      });
      return;
    }

    if (meetingId) {
      initializeJoinFlow();
    }
  }, [meetingId, isAuthenticated]);

  useEffect(() => {
    // Track flow progression
    userAnalyticsService.trackEvent('meeting_join_flow_step', {
      meeting_id: meetingId,
      step: currentStep,
      user_id: user?.id,
      timestamp: Date.now()
    });
  }, [currentStep]);

  const initializeJoinFlow = async () => {
    setCurrentStep('initializing');
    setError(null);
    setIsLoading(true);

    try {
      // Start with access validation
      setCurrentStep('validating');
    } catch (error) {
      console.error('Join flow initialization error:', error);
      setError('Failed to initialize meeting join process');
      setCurrentStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccessValidationComplete = (result) => {
    setAccessData(result);

    if (result.meetingInfo) {
      setMeetingData(result.meetingInfo);
    }

    if (result.waitingRoomRequired) {
      setCurrentStep('waiting_room_entry');
    } else {
      // Direct join allowed
      handleDirectJoin(result);
    }
  };

  const handleAccessDenied = (reason) => {
    userAnalyticsService.trackEvent('meeting_access_denied', {
      meeting_id: meetingId,
      denial_reason: reason,
      timestamp: Date.now()
    });

    setError(`Access denied: ${reason}`);
    setCurrentStep('error');
  };

  const handleTimeRestriction = (timeData) => {
    setTimeRestrictionData(timeData);
    setCurrentStep('time_restriction');
  };

  const handleWaitingRoomJoin = (waitingData) => {
    setWaitingRoomData(waitingData);
    setCurrentStep('waiting_room');
  };

  const handleWaitingRoomAdmitted = (admissionData) => {
    userAnalyticsService.trackEvent('waiting_room_admitted', {
      meeting_id: meetingId,
      admission_data: admissionData,
      timestamp: Date.now()
    });

    setCurrentStep('joining');
    handleDirectJoin(admissionData);
  };

  const handleWaitingRoomDenied = (denialReason) => {
    userAnalyticsService.trackEvent('waiting_room_denied', {
      meeting_id: meetingId,
      denial_reason: denialReason,
      timestamp: Date.now()
    });

    setError(`Admission denied: ${denialReason}`);
    setCurrentStep('error');
  };

  const handleDirectJoin = async (joinData) => {
    setCurrentStep('joining');
    setIsLoading(true);

    try {
      const result = await meetingAccessService.joinMeeting(meetingId, {
        ...joinOptions,
        accessToken: joinData.meetingToken || joinData.accessToken,
        userPermissions: joinData.userPermissions
      });

      if (result.success) {
        setMeetingData({
          ...meetingData,
          ...result.data.meetingSettings,
          userPermissions: result.data.userPermissions,
          participantInfo: result.data.participantInfo
        });
        setCurrentStep('in_meeting');

        userAnalyticsService.trackEvent('meeting_joined_successfully', {
          meeting_id: meetingId,
          join_method: 'direct',
          timestamp: Date.now()
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Direct join error:', error);
      setError('Failed to join meeting: ' + error.message);
      setCurrentStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryAccess = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setCurrentStep('validating');
  };

  const handleLeaveWaitingRoom = () => {
    setCurrentStep('validating');
    setWaitingRoomData(null);
  };

  const handleMeetingExit = () => {
    userAnalyticsService.trackEvent('meeting_exited', {
      meeting_id: meetingId,
      exit_reason: 'user_initiated',
      timestamp: Date.now()
    });

    navigate('/dashboard');
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'initializing':
        return (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <LoadingSpinner size="lg" />
                <div>
                  <h3 className="text-lg font-medium">Initializing Meeting Join</h3>
                  <p className="text-sm text-gray-500">
                    Setting up your meeting connection...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'validating':
        return (
          <MeetingAccessValidator
            meetingId={meetingId}
            joinOptions={joinOptions}
            onAccessGranted={handleAccessValidationComplete}
            onAccessDenied={handleAccessDenied}
            onWaitingRoom={handleWaitingRoomJoin}
            onTimeRestriction={handleTimeRestriction}
            showJoinOptions={true}
          />
        );

      case 'waiting_room_entry':
        return (
          <MeetingAccessValidator
            meetingId={meetingId}
            joinOptions={joinOptions}
            onAccessGranted={handleAccessValidationComplete}
            onAccessDenied={handleAccessDenied}
            onWaitingRoom={handleWaitingRoomJoin}
            showJoinOptions={true}
          />
        );

      case 'waiting_room':
        return (
          <MeetingWaitingRoom
            meetingId={meetingId}
            waitingRoomData={waitingRoomData}
            meetingInfo={meetingData}
            onAdmitted={handleWaitingRoomAdmitted}
            onDenied={handleWaitingRoomDenied}
            onLeave={handleLeaveWaitingRoom}
          />
        );

      case 'time_restriction':
        return (
          <MeetingTimeRestriction
            meetingId={meetingId}
            meetingInfo={meetingData}
            timeRestrictions={timeRestrictionData}
            onRetryAccess={handleRetryAccess}
            onBackToDashboard={handleBackToDashboard}
          />
        );

      case 'joining':
        return (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <LoadingSpinner size="lg" />
                <div>
                  <h3 className="text-lg font-medium">Joining Meeting</h3>
                  <p className="text-sm text-gray-500">
                    Connecting to the meeting room...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'in_meeting':
        return (
          <VideoConference
            meetingId={meetingId}
            meetingData={meetingData}
            joinOptions={joinOptions}
            onMeetingEnd={handleMeetingExit}
            onLeave={handleMeetingExit}
          />
        );

      case 'error':
        return (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Unable to Join Meeting
              </h1>
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Join Failed</AlertTitle>
              <AlertDescription>
                {error || 'An unexpected error occurred while trying to join the meeting.'}
              </AlertDescription>
            </Alert>

            <div className="text-center space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleRetryAccess} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </>
                  )}
                </Button>
                
                <Button variant="outline" onClick={handleBackToDashboard}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
              
              {retryCount > 2 && (
                <div className="text-sm text-gray-500">
                  <p>Still having trouble? Contact the meeting organizer for assistance.</p>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium">Unknown State</h3>
                <p className="text-sm text-gray-500">
                  The meeting join process is in an unexpected state.
                </p>
                <Button onClick={handleRetryAccess} className="mt-4">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Restart Process
                </Button>
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Progress indicator - only show during multi-step processes */}
      {!['in_meeting', 'error'].includes(currentStep) && (
        <div className="bg-white dark:bg-gray-800 border-b">
          <div className="max-w-4xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span>Meeting ID: {meetingId}</span>
                {meetingData?.title && <span>• {meetingData.title}</span>}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className={`w-2 h-2 rounded-full ${currentStep === 'validating' ? 'bg-blue-500' : currentStep === 'initializing' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                <span className="capitalize">{currentStep.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="container mx-auto px-4 py-6">
        {renderCurrentStep()}
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
          <div>Step: {currentStep}</div>
          <div>Retries: {retryCount}</div>
          {error && <div>Error: {error}</div>}
        </div>
      )}
    </div>
  );
};

export default MeetingJoinFlow;