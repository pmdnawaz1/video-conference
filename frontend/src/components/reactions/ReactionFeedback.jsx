import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Check, X, Clock, TrendingUp, Users, Star } from 'lucide-react';

const ReactionFeedback = ({
  sentReactions = [],
  receivedReactions = [],
  reactionStats = {},
  onClearFeedback,
  position = 'top-right', // 'top-right' | 'bottom-left' | 'center' | 'sidebar'
  showStats = true,
  autoHide = true,
  autoHideDelay = 5000,
  className = ''
}) => {
  const [visibleFeedback, setVisibleFeedback] = useState([]);
  const [showStatsSummary, setShowStatsSummary] = useState(false);

  useEffect(() => {
    // Process sent reactions for feedback
    sentReactions.forEach(reaction => {
      if (!visibleFeedback.find(f => f.id === reaction.id)) {
        const feedback = {
          id: reaction.id,
          type: 'sent',
          emoji: reaction.emoji,
          message: `Reaction sent!`,
          timestamp: Date.now(),
          status: reaction.status || 'delivered'
        };

        setVisibleFeedback(prev => [...prev, feedback]);

        if (autoHide) {
          setTimeout(() => {
            setVisibleFeedback(prev => prev.filter(f => f.id !== reaction.id));
          }, autoHideDelay);
        }
      }
    });
  }, [sentReactions, autoHide, autoHideDelay, visibleFeedback]);

  useEffect(() => {
    // Process received reactions for feedback
    receivedReactions.forEach(reaction => {
      const feedbackId = `received-${reaction.id}`;
      if (!visibleFeedback.find(f => f.id === feedbackId)) {
        const feedback = {
          id: feedbackId,
          type: 'received',
          emoji: reaction.emoji,
          message: `${reaction.user_name} reacted`,
          timestamp: Date.now(),
          user: reaction.user_name
        };

        setVisibleFeedback(prev => [...prev, feedback]);

        if (autoHide) {
          setTimeout(() => {
            setVisibleFeedback(prev => prev.filter(f => f.id !== feedbackId));
          }, autoHideDelay / 2); // Show received reactions for less time
        }
      }
    });
  }, [receivedReactions, autoHide, autoHideDelay, visibleFeedback]);

  const handleDismiss = (feedbackId) => {
    setVisibleFeedback(prev => prev.filter(f => f.id !== feedbackId));
  };

  const handleClearAll = () => {
    setVisibleFeedback([]);
    onClearFeedback?.();
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'fixed top-4 right-4 z-50';
      case 'bottom-left':
        return 'fixed bottom-4 left-4 z-50';
      case 'center':
        return 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50';
      case 'sidebar':
        return 'w-full';
      default:
        return 'fixed top-4 right-4 z-50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <Check className="w-3 h-3 text-green-500" />;
      case 'failed':
        return <X className="w-3 h-3 text-red-500" />;
      case 'pending':
        return <Clock className="w-3 h-3 text-yellow-500" />;
      default:
        return <Check className="w-3 h-3 text-green-500" />;
    }
  };

  const renderFeedbackItem = (feedback) => (
    <motion.div
      key={feedback.id}
      layout
      initial={{ opacity: 0, scale: 0.8, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      transition={{ duration: 0.3 }}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-3 min-w-[200px] ${
        feedback.type === 'sent' ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-green-500'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-lg">{feedback.emoji}</div>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {feedback.message}
            </div>
            {feedback.user && feedback.type === 'received' && (
              <div className="text-xs text-gray-500">
                from {feedback.user}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {feedback.type === 'sent' && getStatusIcon(feedback.status)}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDismiss(feedback.id)}
            className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );

  const renderStatsSummary = () => {
    if (!showStats || !reactionStats || Object.keys(reactionStats).length === 0) {
      return null;
    }

    const totalSent = reactionStats.total_sent || 0;
    const totalReceived = reactionStats.total_received || 0;
    const popularReaction = reactionStats.most_popular || null;
    const engagementScore = reactionStats.engagement_score || 0;

    return (
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Reaction Stats
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStatsSummary(!showStatsSummary)}
              className="h-6 text-xs"
            >
              {showStatsSummary ? 'Hide' : 'Show'}
            </Button>
          </div>
          
          <AnimatePresence>
            {showStatsSummary && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{totalSent}</div>
                    <div className="text-xs text-gray-500">Sent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{totalReceived}</div>
                    <div className="text-xs text-gray-500">Received</div>
                  </div>
                </div>

                {popularReaction && (
                  <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="flex items-center gap-2">
                      <div className="text-lg">{popularReaction.emoji}</div>
                      <div>
                        <div className="text-xs font-medium">Most Popular</div>
                        <div className="text-xs text-gray-500">{popularReaction.count} times</div>
                      </div>
                    </div>
                    <Star className="w-4 h-4 text-yellow-500" />
                  </div>
                )}

                <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                    <div>
                      <div className="text-xs font-medium">Engagement</div>
                      <div className="text-xs text-gray-500">Meeting interaction</div>
                    </div>
                  </div>
                  <Badge variant={engagementScore > 70 ? 'default' : 'secondary'}>
                    {engagementScore}%
                  </Badge>
                </div>

                {reactionStats.recent_activity && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Recent Activity
                    </div>
                    {reactionStats.recent_activity.slice(0, 3).map((activity, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-gray-500">
                        <div>{activity.emoji}</div>
                        <div>{activity.action}</div>
                        <div>{new Date(activity.timestamp).toLocaleTimeString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    );
  };

  if (visibleFeedback.length === 0 && (!showStats || !reactionStats)) {
    return null;
  }

  if (position === 'sidebar') {
    return (
      <div className={`space-y-3 ${className}`}>
        <AnimatePresence>
          {visibleFeedback.map(renderFeedbackItem)}
        </AnimatePresence>
        {visibleFeedback.length > 1 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearAll}
            className="w-full"
          >
            Clear All
          </Button>
        )}
        {renderStatsSummary()}
      </div>
    );
  }

  return (
    <div className={`${getPositionClasses()} max-w-sm ${className}`}>
      <div className="space-y-3">
        <AnimatePresence>
          {visibleFeedback.map(renderFeedbackItem)}
        </AnimatePresence>
      </div>
      
      {visibleFeedback.length > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3"
        >
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearAll}
            className="w-full"
          >
            Clear All Notifications
          </Button>
        </motion.div>
      )}
      
      {renderStatsSummary()}
    </div>
  );
};

export default ReactionFeedback;