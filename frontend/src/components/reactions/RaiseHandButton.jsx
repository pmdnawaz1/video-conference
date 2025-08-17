import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Hand, Clock, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RaiseHandButton = ({
  isHandRaised = false,
  onToggleHand,
  raisedHandsCount = 0,
  raisedHandsQueue = [],
  userPosition = null,
  disabled = false,
  variant = 'default', // 'default' | 'compact' | 'icon'
  showQueue = true,
  autoLowerTimeout = null, // Auto-lower hand after X milliseconds
  className = ''
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [timeRaised, setTimeRaised] = useState(null);
  const [autoLowerTimer, setAutoLowerTimer] = useState(null);

  useEffect(() => {
    if (isHandRaised) {
      setTimeRaised(Date.now());
      setIsAnimating(true);
      
      // Auto-lower hand if timeout is set
      if (autoLowerTimeout) {
        const timer = setTimeout(() => {
          onToggleHand?.(false);
        }, autoLowerTimeout);
        setAutoLowerTimer(timer);
      }
      
      // Animation timeout
      const animationTimer = setTimeout(() => {
        setIsAnimating(false);
      }, 600);
      
      return () => {
        clearTimeout(animationTimer);
        if (autoLowerTimer) clearTimeout(autoLowerTimer);
      };
    } else {
      setTimeRaised(null);
      setIsAnimating(false);
      if (autoLowerTimer) {
        clearTimeout(autoLowerTimer);
        setAutoLowerTimer(null);
      }
    }
  }, [isHandRaised, autoLowerTimeout, onToggleHand]);

  const handleToggle = () => {
    if (disabled) return;
    onToggleHand?.(!isHandRaised);
  };

  const formatTimeRaised = () => {
    if (!timeRaised) return '';
    const seconds = Math.floor((Date.now() - timeRaised) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const getButtonVariant = () => {
    if (isHandRaised) return 'default';
    return 'outline';
  };

  const getButtonText = () => {
    if (variant === 'icon') return '';
    if (isHandRaised) return 'Lower Hand';
    return 'Raise Hand';
  };

  const renderQueueTooltip = () => {
    if (!showQueue || raisedHandsQueue.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="font-semibold text-sm">Raised Hands Queue</div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {raisedHandsQueue.slice(0, 10).map((user, index) => (
            <div key={user.id || index} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-6 h-4 text-xs p-0 flex items-center justify-center">
                  {index + 1}
                </Badge>
                <span className={index === 0 ? 'font-medium' : ''}>{user.name}</span>
              </div>
              <div className="text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeRaised(user.raisedAt)}
              </div>
            </div>
          ))}
          {raisedHandsQueue.length > 10 && (
            <div className="text-xs text-gray-500 text-center pt-1">
              +{raisedHandsQueue.length - 10} more
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCompactVariant = () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={getButtonVariant()}
            size="sm"
            onClick={handleToggle}
            disabled={disabled}
            className={`relative ${isHandRaised ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''} ${className}`}
          >
            <motion.div
              animate={isAnimating ? { 
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.1, 1]
              } : {}}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="flex items-center gap-1"
            >
              <Hand className="w-4 h-4" />
              {raisedHandsCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] text-xs p-0 flex items-center justify-center">
                  {raisedHandsCount}
                </Badge>
              )}
            </motion.div>
            
            {isHandRaised && userPosition && (
              <Badge 
                variant="outline" 
                className="absolute -top-2 -right-2 bg-white dark:bg-gray-800 text-xs h-5 min-w-[20px] p-0 flex items-center justify-center"
              >
                #{userPosition}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-medium">
              {isHandRaised ? 'Your hand is raised' : 'Raise your hand to speak'}
            </div>
            {isHandRaised && timeRaised && (
              <div className="text-xs text-gray-500">
                Raised for: {formatTimeRaised()}
              </div>
            )}
            {userPosition && (
              <div className="text-xs text-gray-500">
                Position in queue: #{userPosition}
              </div>
            )}
            {renderQueueTooltip()}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const renderIconVariant = () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={getButtonVariant()}
            size="sm"
            onClick={handleToggle}
            disabled={disabled}
            className={`w-10 h-10 p-0 relative ${isHandRaised ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''} ${className}`}
          >
            <motion.div
              animate={isAnimating ? { 
                rotate: [0, -15, 15, -15, 15, 0],
                scale: [1, 1.2, 1]
              } : {}}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              <Hand className="w-5 h-5" />
            </motion.div>
            
            {isHandRaised && userPosition && (
              <Badge 
                variant="outline" 
                className="absolute -top-1 -right-1 bg-white dark:bg-gray-800 text-xs h-4 min-w-[16px] p-0 flex items-center justify-center"
              >
                {userPosition}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-medium">
              {isHandRaised ? 'Lower Hand' : 'Raise Hand'}
            </div>
            {isHandRaised && timeRaised && (
              <div className="text-xs text-gray-500">
                Raised for: {formatTimeRaised()}
              </div>
            )}
            {userPosition && (
              <div className="text-xs text-gray-500">
                Position: #{userPosition}
              </div>
            )}
            {raisedHandsCount > 0 && (
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {raisedHandsCount} hands raised
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const renderDefaultVariant = () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={getButtonVariant()}
            onClick={handleToggle}
            disabled={disabled}
            className={`gap-2 ${isHandRaised ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''} ${className}`}
          >
            <motion.div
              animate={isAnimating ? { 
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.1, 1]
              } : {}}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="flex items-center gap-2"
            >
              <Hand className="w-4 h-4" />
              <span>{getButtonText()}</span>
            </motion.div>
            
            <AnimatePresence>
              {raisedHandsCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Badge variant="secondary" className="ml-1">
                    {raisedHandsCount}
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            {isHandRaised ? (
              <div>
                <div className="font-medium">Your hand is raised</div>
                {timeRaised && (
                  <div className="text-xs text-gray-500">
                    Raised for: {formatTimeRaised()}
                  </div>
                )}
                {userPosition && (
                  <div className="text-xs text-gray-500">
                    Position in queue: #{userPosition}
                  </div>
                )}
                {autoLowerTimeout && (
                  <div className="text-xs text-orange-500">
                    Will auto-lower in {Math.ceil((autoLowerTimeout - (Date.now() - timeRaised)) / 1000)}s
                  </div>
                )}
              </div>
            ) : (
              <div className="font-medium">Click to raise your hand and request to speak</div>
            )}
            {renderQueueTooltip()}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (variant === 'compact') return renderCompactVariant();
  if (variant === 'icon') return renderIconVariant();
  return renderDefaultVariant();
};

export default RaiseHandButton;