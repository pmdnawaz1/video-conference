import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft, 
  User, 
  Settings, 
  Video, 
  Mic, 
  Camera, 
  Volume2,
  Bell,
  Shield,
  Globe,
  Sparkles,
  Coffee,
  Rocket,
  Users,
  Calendar,
  BookOpen,
  ChevronRight
} from 'lucide-react';

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome!',
    description: 'Let\'s get you set up for the best video conferencing experience',
    icon: Sparkles,
    component: 'WelcomeStep'
  },
  {
    id: 'profile',
    title: 'Complete Your Profile',
    description: 'Tell us about yourself to personalize your experience',
    icon: User,
    component: 'ProfileStep'
  },
  {
    id: 'devices',
    title: 'Test Your Devices',
    description: 'Let\'s make sure your camera and microphone work perfectly',
    icon: Video,
    component: 'DeviceTestStep'
  },
  {
    id: 'preferences',
    title: 'Set Your Preferences',
    description: 'Customize notifications and meeting defaults',
    icon: Settings,
    component: 'PreferencesStep'
  },
  {
    id: 'tutorial',
    title: 'Quick Tutorial',
    description: 'Learn the essential features in 2 minutes',
    icon: BookOpen,
    component: 'TutorialStep'
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Welcome to your new video conferencing platform',
    icon: Rocket,
    component: 'CompletionStep'
  }
];

const OnboardingWizard = ({
  isOpen = true,
  onComplete,
  onSkip,
  initialStep = 0,
  userProfile = {},
  onProfileUpdate,
  onPreferencesUpdate,
  className = ''
}) => {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [formData, setFormData] = useState({
    profile: {
      first_name: userProfile.first_name || '',
      last_name: userProfile.last_name || '',
      bio: userProfile.bio || '',
      profile_picture: userProfile.profile_picture || '',
      department: userProfile.department || '',
      role: userProfile.role || ''
    },
    preferences: {
      notifications: true,
      sound_enabled: true,
      camera_default: true,
      mic_default: false,
      theme: 'auto',
      language: 'en'
    },
    deviceTest: {
      camera: false,
      microphone: false,
      speakers: false
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  const currentStepData = ONBOARDING_STEPS[currentStep];
  const progressPercentage = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  useEffect(() => {
    // Track onboarding analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'onboarding_step_viewed', {
        step_name: currentStepData.id,
        step_number: currentStep + 1
      });
    }
  }, [currentStep, currentStepData]);

  const handleNext = async () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(prev => prev + 1);
    } else {
      await handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStepClick = (stepIndex) => {
    if (stepIndex <= currentStep || completedSteps.has(stepIndex)) {
      setCurrentStep(stepIndex);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Save profile and preferences
      await onProfileUpdate?.(formData.profile);
      await onPreferencesUpdate?.(formData.preferences);
      
      // Mark onboarding as complete
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('onboarding_completed_at', new Date().toISOString());
      
      onComplete?.();
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  const updateFormData = (section, data) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section], ...data }
    }));
  };

  // Step Components
  const WelcomeStep = () => (
    <div className="text-center space-y-6">
      <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
        <Sparkles className="w-12 h-12 text-white" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome to VideoConf!
        </h2>
        <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
          We're excited to help you connect with your team through seamless video conferencing. 
          Let's get you set up in just a few minutes.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Video className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-sm font-medium">HD Video</div>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Users className="w-6 h-6 text-green-600" />
          </div>
          <div className="text-sm font-medium">Team Collaboration</div>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Shield className="w-6 h-6 text-purple-600" />
          </div>
          <div className="text-sm font-medium">Secure & Private</div>
        </div>
      </div>
    </div>
  );

  const ProfileStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Complete Your Profile
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Help your colleagues recognize you in meetings
        </p>
      </div>
      
      <div className="flex justify-center">
        <Avatar className="w-24 h-24">
          <AvatarImage src={formData.profile.profile_picture} />
          <AvatarFallback className="text-2xl">
            {formData.profile.first_name?.[0]}{formData.profile.last_name?.[0]}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={formData.profile.first_name}
            onChange={(e) => updateFormData('profile', { first_name: e.target.value })}
            placeholder="John"
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={formData.profile.last_name}
            onChange={(e) => updateFormData('profile', { last_name: e.target.value })}
            placeholder="Doe"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            value={formData.profile.role}
            onChange={(e) => updateFormData('profile', { role: e.target.value })}
            placeholder="Software Engineer"
          />
        </div>
        <div>
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            value={formData.profile.department}
            onChange={(e) => updateFormData('profile', { department: e.target.value })}
            placeholder="Engineering"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="bio">Bio (Optional)</Label>
        <Textarea
          id="bio"
          value={formData.profile.bio}
          onChange={(e) => updateFormData('profile', { bio: e.target.value })}
          placeholder="Tell us a bit about yourself..."
          rows={3}
        />
      </div>
    </div>
  );

  const DeviceTestStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Test Your Devices
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Let's make sure everything works perfectly for your meetings
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="font-medium">Camera</div>
                  <div className="text-sm text-gray-500">Test your video feed</div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => updateFormData('deviceTest', { camera: !formData.deviceTest.camera })}
              >
                {formData.deviceTest.camera ? <CheckCircle className="w-4 h-4 text-green-600" /> : 'Test'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mic className="w-5 h-5 text-green-600" />
                <div>
                  <div className="font-medium">Microphone</div>
                  <div className="text-sm text-gray-500">Check audio input</div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => updateFormData('deviceTest', { microphone: !formData.deviceTest.microphone })}
              >
                {formData.deviceTest.microphone ? <CheckCircle className="w-4 h-4 text-green-600" /> : 'Test'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="font-medium">Speakers</div>
                  <div className="text-sm text-gray-500">Test audio output</div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => updateFormData('deviceTest', { speakers: !formData.deviceTest.speakers })}
              >
                {formData.deviceTest.speakers ? <CheckCircle className="w-4 h-4 text-green-600" /> : 'Test'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
        <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-2">
          <Camera className="w-8 h-8 text-gray-400" />
        </div>
        <div className="text-sm text-gray-500">Camera preview will appear here</div>
      </div>
    </div>
  );

  const PreferencesStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Set Your Preferences
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Customize your meeting experience
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Meeting reminders</div>
                <div className="text-sm text-gray-500">Get notified before meetings start</div>
              </div>
              <Switch
                checked={formData.preferences.notifications}
                onCheckedChange={(checked) => updateFormData('preferences', { notifications: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Sound notifications</div>
                <div className="text-sm text-gray-500">Play sounds for alerts</div>
              </div>
              <Switch
                checked={formData.preferences.sound_enabled}
                onCheckedChange={(checked) => updateFormData('preferences', { sound_enabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="w-4 h-4" />
              Meeting Defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Camera on by default</div>
                <div className="text-sm text-gray-500">Start meetings with camera enabled</div>
              </div>
              <Switch
                checked={formData.preferences.camera_default}
                onCheckedChange={(checked) => updateFormData('preferences', { camera_default: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Microphone on by default</div>
                <div className="text-sm text-gray-500">Start meetings with mic enabled</div>
              </div>
              <Switch
                checked={formData.preferences.mic_default}
                onCheckedChange={(checked) => updateFormData('preferences', { mic_default: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const TutorialStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Quick Tutorial
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Learn the essential features in 2 minutes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="w-6 h-6 text-blue-600" />
              <div className="font-medium">Scheduling Meetings</div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Learn how to schedule and manage your meetings
            </p>
            <Button variant="outline" size="sm" className="w-full">
              Watch Tutorial
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-6 h-6 text-green-600" />
              <div className="font-medium">Inviting Participants</div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Add team members and external guests
            </p>
            <Button variant="outline" size="sm" className="w-full">
              Watch Tutorial
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Video className="w-6 h-6 text-purple-600" />
              <div className="font-medium">Meeting Controls</div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Master camera, mic, and screen sharing
            </p>
            <Button variant="outline" size="sm" className="w-full">
              Watch Tutorial
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Settings className="w-6 h-6 text-orange-600" />
              <div className="font-medium">Advanced Features</div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Discover recording, reactions, and more
            </p>
            <Button variant="outline" size="sm" className="w-full">
              Watch Tutorial
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <Button variant="ghost" size="sm">
          Skip tutorials for now
        </Button>
      </div>
    </div>
  );

  const CompletionStep = () => (
    <div className="text-center space-y-6">
      <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center mx-auto">
        <Rocket className="w-12 h-12 text-white" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          You're All Set!
        </h2>
        <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
          Welcome to VideoConf! You're ready to start hosting amazing meetings with your team.
        </p>
      </div>
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg p-6">
        <h3 className="font-semibold mb-4">What's next?</h3>
        <div className="space-y-2 text-sm text-left">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Schedule your first meeting</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Invite your team members</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Explore advanced features</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepComponent = () => {
    switch (currentStepData.component) {
      case 'WelcomeStep': return <WelcomeStep />;
      case 'ProfileStep': return <ProfileStep />;
      case 'DeviceTestStep': return <DeviceTestStep />;
      case 'PreferencesStep': return <PreferencesStep />;
      case 'TutorialStep': return <TutorialStep />;
      case 'CompletionStep': return <CompletionStep />;
      default: return <WelcomeStep />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto ${className}`}>
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <currentStepData.icon className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-500">
                Step {currentStep + 1} of {ONBOARDING_STEPS.length}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-700"
            >
              Skip Setup
            </Button>
          </div>
          
          <Progress value={progressPercentage} className="mb-4" />
          
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2">
              {ONBOARDING_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => handleStepClick(index)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    index === currentStep
                      ? 'bg-blue-600 text-white'
                      : completedSteps.has(index)
                      ? 'bg-green-600 text-white'
                      : index < currentStep
                      ? 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                  disabled={index > currentStep && !completedSteps.has(index)}
                >
                  {completedSteps.has(index) ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepComponent()}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </Button>

            <Button
              onClick={handleNext}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {currentStep === ONBOARDING_STEPS.length - 1 ? (
                <>
                  {isLoading ? 'Finishing...' : 'Get Started'}
                  <Rocket className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingWizard;