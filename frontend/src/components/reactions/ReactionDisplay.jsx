import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

const ReactionDisplay = ({
  reactions = [],
  onReactionExpire,
  showUserInfo = true,
  maxDisplayReactions = 50,
  animationDuration = 3000,
  position = "overlay", // 'overlay' | 'sidebar' | 'bottom'
  className = "",
}) => {
  const [activeReactions, setActiveReactions] = useState([]);
  const [reactionCounts, setReactionCounts] = useState({});
  const containerRef = useRef(null);
  const animationRefs = useRef(new Map());

  useEffect(() => {
    // Process new reactions
    reactions.forEach((reaction) => {
      if (!animationRefs.current.has(reaction.id)) {
        animationRefs.current.set(reaction.id, true);

        // Add to active reactions
        setActiveReactions((prev) => {
          const newReactions = [
            ...prev,
            {
              ...reaction,
              timestamp: Date.now(),
              animationKey: `${reaction.id}-${Date.now()}`,
            },
          ].slice(-maxDisplayReactions);
          return newReactions;
        });

        // Update reaction counts
        setReactionCounts((prev) => ({
          ...prev,
          [reaction.emoji]: (prev[reaction.emoji] || 0) + 1,
        }));

        // Set expiration timer
        setTimeout(() => {
          setActiveReactions((prev) =>
            prev.filter((r) => r.id !== reaction.id),
          );
          animationRefs.current.delete(reaction.id);
          onReactionExpire?.(reaction);
        }, animationDuration);
      }
    });
  }, [reactions, animationDuration, maxDisplayReactions, onReactionExpire]);

  const getRandomPosition = () => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };

    const rect = container.getBoundingClientRect();
    return {
      x: Math.random() * (rect.width - 60),
      y: Math.random() * (rect.height - 60),
    };
  };

  const getAnimationVariants = (reactionType) => {
    const baseVariants = {
      initial: {
        opacity: 0,
        scale: 0,
        y: 20,
      },
      animate: {
        opacity: 1,
        scale: [0, 1.2, 1],
        y: [20, -10, 0],
        transition: {
          duration: 0.6,
          ease: "easeOut",
          scale: {
            duration: 0.4,
            times: [0, 0.6, 1],
          },
        },
      },
      exit: {
        opacity: 0,
        scale: 0.8,
        y: -30,
        transition: {
          duration: 0.4,
          ease: "easeIn",
        },
      },
    };

    // Special animations for specific reactions
    switch (reactionType) {
      case "🎉":
        return {
          ...baseVariants,
          animate: {
            ...baseVariants.animate,
            rotate: [0, 360],
            scale: [0, 1.5, 1.2, 1],
            transition: {
              ...baseVariants.animate.transition,
              rotate: { duration: 1.5, ease: "easeInOut" },
            },
          },
        };
      case "❤️":
        return {
          ...baseVariants,
          animate: {
            ...baseVariants.animate,
            scale: [0, 1.3, 0.9, 1.1, 1],
            transition: {
              ...baseVariants.animate.transition,
              scale: { duration: 0.8, times: [0, 0.3, 0.6, 0.8, 1] },
            },
          },
        };
      case "👏":
        return {
          ...baseVariants,
          animate: {
            ...baseVariants.animate,
            x: [0, -5, 5, 0],
            transition: {
              ...baseVariants.animate.transition,
              x: { duration: 0.5, repeat: 2 },
            },
          },
        };
      default:
        return baseVariants;
    }
  };

  const renderOverlayReactions = () => (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex: 100 }}
    >
      <AnimatePresence>
        {activeReactions.map((reaction) => {
          const position = getRandomPosition();
          const variants = getAnimationVariants(reaction.emoji);

          return (
            <motion.div
              key={reaction.animationKey}
              className="absolute flex flex-col items-center"
              style={{
                left: position.x,
                top: position.y,
              }}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="text-4xl mb-1 drop-shadow-lg">
                {reaction.emoji}
              </div>
              {showUserInfo && (
                <motion.div
                  className="bg-black/70 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {reaction.user_name}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );

  const renderSidebarReactions = () => (
    <div
      className={`w-64 h-full bg-white/90 dark:bg-muted0/90 backdrop-blur-sm border-l overflow-hidden ${className}`}
    >
      <div className="p-4 border-b">
        <h3 className="font-semibold text-muted-foreground dark:text-white">
          Live Reactions
        </h3>
        <p className="text-sm text-muted-foreground">
          Real-time participant reactions
        </p>
      </div>

      <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {activeReactions
            .slice(-10)
            .reverse()
            .map((reaction) => (
              <motion.div
                key={reaction.animationKey}
                className="flex items-center gap-3 p-2 bg-muted dark:bg-muted0 rounded-lg"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-2xl">{reaction.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={reaction.user_avatar} />
                      <AvatarFallback className="text-xs">
                        {reaction.user_name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-muted-foreground dark:text-white">
                      {reaction.user_name}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(reaction.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>

      {Object.keys(reactionCounts).length > 0 && (
        <div className="p-4 border-t">
          <h4 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">
            Reaction Summary
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(reactionCounts)
              .sort(([_, a], [__, b]) => b - a)
              .map(([emoji, count]) => (
                <Badge
                  key={emoji}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  <span>{emoji}</span>
                  <span>{count}</span>
                </Badge>
              ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderBottomReactions = () => (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-muted0/90 backdrop-blur-sm border-t p-4 ${className}`}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-muted-foreground dark:text-white">
            Live Reactions
          </h3>
          <div className="flex gap-2">
            {Object.entries(reactionCounts)
              .sort(([_, a], [__, b]) => b - a)
              .slice(0, 5)
              .map(([emoji, count]) => (
                <Badge
                  key={emoji}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  <span>{emoji}</span>
                  <span>{count}</span>
                </Badge>
              ))}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          <AnimatePresence>
            {activeReactions.slice(-20).map((reaction) => (
              <motion.div
                key={reaction.animationKey}
                className="flex-shrink-0 flex items-center gap-2 bg-muted dark:bg-muted0 rounded-lg px-3 py-2"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-xl">{reaction.emoji}</div>
                {showUserInfo && (
                  <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                    {reaction.user_name}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  switch (position) {
    case "sidebar":
      return renderSidebarReactions();
    case "bottom":
      return renderBottomReactions();
    case "overlay":
    default:
      return renderOverlayReactions();
  }
};

export default ReactionDisplay;
