import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { Heart, ThumbsUp, Laugh, Surprised, Sad, Angry, PartyPopper, Clap } from 'lucide-react';

const EMOJI_REACTIONS = [
  { emoji: '👍', name: 'thumbs_up', icon: ThumbsUp, label: 'Thumbs Up' },
  { emoji: '❤️', name: 'heart', icon: Heart, label: 'Love' },
  { emoji: '😂', name: 'laugh', icon: Laugh, label: 'Laugh' },
  { emoji: '😮', name: 'wow', icon: Surprised, label: 'Wow' },
  { emoji: '😢', name: 'sad', icon: Sad, label: 'Sad' },
  { emoji: '😠', name: 'angry', icon: Angry, label: 'Angry' },
  { emoji: '🎉', name: 'party', icon: PartyPopper, label: 'Celebrate' },
  { emoji: '👏', name: 'clap', icon: Clap, label: 'Applause' },
  { emoji: '👋', name: 'wave', icon: null, label: 'Wave' },
  { emoji: '🔥', name: 'fire', icon: null, label: 'Fire' },
  { emoji: '💯', name: 'hundred', icon: null, label: 'Perfect' },
  { emoji: '🤔', name: 'thinking', icon: null, label: 'Thinking' }
];

const EmojiReactionPicker = ({ 
  onReactionSelect, 
  disabled = false, 
  variant = 'button', // 'button' | 'floating' | 'compact'
  showCounts = false,
  reactionCounts = {},
  className = '',
  size = 'default' // 'sm' | 'default' | 'lg'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentReactions, setRecentReactions] = useState([]);
  const [hoveredReaction, setHoveredReaction] = useState(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    // Load recent reactions from localStorage
    const saved = localStorage.getItem('recentReactions');
    if (saved) {
      try {
        setRecentReactions(JSON.parse(saved));
      } catch (error) {
        console.warn('Failed to load recent reactions:', error);
      }
    }
  }, []);

  const handleReactionSelect = (reaction) => {
    if (disabled) return;
    
    // Add to recent reactions
    const updated = [
      reaction,
      ...recentReactions.filter(r => r.name !== reaction.name)
    ].slice(0, 6);
    
    setRecentReactions(updated);
    localStorage.setItem('recentReactions', JSON.stringify(updated));
    
    // Call parent handler
    onReactionSelect?.(reaction);
    setIsOpen(false);
  };

  const renderReactionButton = (reaction, showLabel = false) => {
    const count = reactionCounts[reaction.name] || 0;
    const sizeClasses = {
      sm: 'w-8 h-8 text-sm',
      default: 'w-10 h-10 text-base',
      lg: 'w-12 h-12 text-lg'
    };

    return (
      <Button
        key={reaction.name}
        variant="ghost"
        size="sm"
        className={`${sizeClasses[size]} hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-110 relative group`}
        onClick={() => handleReactionSelect(reaction)}
        onMouseEnter={() => setHoveredReaction(reaction)}
        onMouseLeave={() => setHoveredReaction(null)}
        disabled={disabled}
      >
        <span className="text-lg">{reaction.emoji}</span>
        {showCounts && count > 0 && (
          <Badge 
            variant="secondary" 
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-xs p-0 flex items-center justify-center"
          >
            {count > 99 ? '99+' : count}
          </Badge>
        )}
        {showLabel && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {reaction.label}
          </div>
        )}
      </Button>
    );
  };

  const renderCompactView = () => (
    <div className={`flex items-center gap-1 ${className}`}>
      {recentReactions.slice(0, 4).map(reaction => renderReactionButton(reaction))}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-10 h-10 hover:bg-gray-100 dark:hover:bg-gray-800"
            disabled={disabled}
          >
            <span className="text-lg">😊</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-4" 
          align="start" 
          side="top"
          ref={pickerRef}
        >
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Choose a reaction
            </div>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_REACTIONS.map(reaction => renderReactionButton(reaction, true))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  const renderFloatingView = () => (
    <div className={`fixed bottom-20 right-6 z-50 ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-full shadow-lg border p-2 flex items-center gap-1">
        {recentReactions.slice(0, 3).map(reaction => renderReactionButton(reaction))}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-10 h-10 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
              disabled={disabled}
            >
              <span className="text-lg">+</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-80 p-4" 
            align="end" 
            side="top"
            ref={pickerRef}
          >
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Send a reaction
              </div>
              {recentReactions.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">Recent</div>
                  <div className="flex gap-1 mb-3">
                    {recentReactions.slice(0, 6).map(reaction => renderReactionButton(reaction))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500 mb-2">All reactions</div>
                <div className="grid grid-cols-6 gap-2">
                  {EMOJI_REACTIONS.map(reaction => renderReactionButton(reaction, true))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  const renderButtonView = () => (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size={size}
          className={`gap-2 ${className}`}
          disabled={disabled}
        >
          <span className="text-lg">😊</span>
          React
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-4" 
        align="start"
        ref={pickerRef}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Choose a reaction
            </div>
            {hoveredReaction && (
              <div className="text-xs text-gray-500">
                {hoveredReaction.label}
              </div>
            )}
          </div>
          
          {recentReactions.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2">Recently used</div>
              <div className="flex gap-1 mb-3">
                {recentReactions.slice(0, 6).map(reaction => renderReactionButton(reaction))}
              </div>
            </div>
          )}
          
          <div>
            <div className="text-xs text-gray-500 mb-2">All reactions</div>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_REACTIONS.map(reaction => renderReactionButton(reaction, true))}
            </div>
          </div>
          
          {showCounts && Object.keys(reactionCounts).length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-xs text-gray-500 mb-2">Current reactions</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(reactionCounts)
                  .filter(([_, count]) => count > 0)
                  .sort(([_, a], [__, b]) => b - a)
                  .map(([name, count]) => {
                    const reaction = EMOJI_REACTIONS.find(r => r.name === name);
                    if (!reaction) return null;
                    return (
                      <div 
                        key={name} 
                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs"
                      >
                        <span>{reaction.emoji}</span>
                        <span>{count}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  if (variant === 'compact') return renderCompactView();
  if (variant === 'floating') return renderFloatingView();
  return renderButtonView();
};

export default EmojiReactionPicker;