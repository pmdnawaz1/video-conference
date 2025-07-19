import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useChatStore = create(
  persist(
    (set, get) => ({
      // Chat state
      messages: new Map(), // roomId -> messages array
      isTyping: new Map(), // userId -> isTyping boolean
      unreadCounts: new Map(), // roomId -> unread count
      
      // UI state
      isChatOpen: false,
      selectedRoomId: null,
      
      // Chat actions
      addMessage: (roomId, message) => {
        set((state) => {
          const roomMessages = state.messages.get(roomId) || [];
          const newMessages = new Map(state.messages);
          newMessages.set(roomId, [...roomMessages, {
            ...message,
            id: message.id || `msg_${Date.now()}_${Math.random()}`,
            timestamp: message.timestamp || new Date().toISOString(),
          }]);
          
          // Update unread count if chat is not open or different room
          const newUnreadCounts = new Map(state.unreadCounts);
          if (!state.isChatOpen || state.selectedRoomId !== roomId) {
            const currentCount = newUnreadCounts.get(roomId) || 0;
            newUnreadCounts.set(roomId, currentCount + 1);
          }
          
          return { 
            messages: newMessages,
            unreadCounts: newUnreadCounts
          };
        });
      },
      
      getRoomMessages: (roomId) => {
        const state = get();
        return state.messages.get(roomId) || [];
      },
      
      clearRoomMessages: (roomId) => {
        set((state) => {
          const newMessages = new Map(state.messages);
          newMessages.delete(roomId);
          return { messages: newMessages };
        });
      },
      
      // Typing indicators
      setTyping: (userId, roomId, isTyping) => {
        set((state) => {
          const newTyping = new Map(state.isTyping);
          const key = `${roomId}_${userId}`;
          
          if (isTyping) {
            newTyping.set(key, {
              userId,
              roomId,
              timestamp: Date.now()
            });
          } else {
            newTyping.delete(key);
          }
          
          return { isTyping: newTyping };
        });
      },
      
      getTypingUsers: (roomId) => {
        const state = get();
        const typingUsers = [];
        const now = Date.now();
        
        state.isTyping.forEach((typing, key) => {
          if (typing.roomId === roomId && (now - typing.timestamp) < 5000) {
            typingUsers.push(typing.userId);
          }
        });
        
        return typingUsers;
      },
      
      // UI actions
      toggleChat: () => {
        set((state) => ({ isChatOpen: !state.isChatOpen }));
      },
      
      openChat: (roomId) => {
        set((state) => {
          // Clear unread count for this room
          const newUnreadCounts = new Map(state.unreadCounts);
          newUnreadCounts.set(roomId, 0);
          
          return {
            isChatOpen: true,
            selectedRoomId: roomId,
            unreadCounts: newUnreadCounts
          };
        });
      },
      
      closeChat: () => {
        set({ 
          isChatOpen: false,
          selectedRoomId: null 
        });
      },
      
      // Unread counts
      getUnreadCount: (roomId) => {
        const state = get();
        return state.unreadCounts.get(roomId) || 0;
      },
      
      getTotalUnreadCount: () => {
        const state = get();
        let total = 0;
        state.unreadCounts.forEach((count) => {
          total += count;
        });
        return total;
      },
      
      markAsRead: (roomId) => {
        set((state) => {
          const newUnreadCounts = new Map(state.unreadCounts);
          newUnreadCounts.set(roomId, 0);
          return { unreadCounts: newUnreadCounts };
        });
      },
      
      // Message reactions
      addReaction: (roomId, messageId, emoji, userId) => {
        set((state) => {
          const roomMessages = state.messages.get(roomId) || [];
          const newMessages = new Map(state.messages);
          
          const updatedMessages = roomMessages.map(msg => {
            if (msg.id === messageId) {
              const reactions = msg.reactions || {};
              const emojiReactions = reactions[emoji] || [];
              
              // Toggle reaction
              const hasReacted = emojiReactions.includes(userId);
              const newEmojiReactions = hasReacted 
                ? emojiReactions.filter(id => id !== userId)
                : [...emojiReactions, userId];
              
              return {
                ...msg,
                reactions: {
                  ...reactions,
                  [emoji]: newEmojiReactions.length > 0 ? newEmojiReactions : undefined
                }
              };
            }
            return msg;
          });
          
          newMessages.set(roomId, updatedMessages);
          return { messages: newMessages };
        });
      },
      
      // Search
      searchMessages: (roomId, query) => {
        const state = get();
        const roomMessages = state.messages.get(roomId) || [];
        
        if (!query.trim()) return roomMessages;
        
        return roomMessages.filter(msg => 
          msg.content?.toLowerCase().includes(query.toLowerCase()) ||
          msg.sender?.name?.toLowerCase().includes(query.toLowerCase())
        );
      },
      
      // Cleanup
      clearAllMessages: () => {
        set({
          messages: new Map(),
          unreadCounts: new Map()
        });
      },
      
      // Clean up old typing indicators (call periodically)
      cleanupTypingIndicators: () => {
        set((state) => {
          const now = Date.now();
          const newTyping = new Map();
          
          state.isTyping.forEach((typing, key) => {
            if ((now - typing.timestamp) < 5000) {
              newTyping.set(key, typing);
            }
          });
          
          return { isTyping: newTyping };
        });
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        // Only persist messages, not UI state or typing indicators
        messages: Array.from(state.messages.entries()),
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.messages)) {
          // Convert persisted array back to Map
          state.messages = new Map(state.messages);
        }
        if (!state.messages) {
          state.messages = new Map();
        }
        if (!state.unreadCounts) {
          state.unreadCounts = new Map();
        }
        if (!state.isTyping) {
          state.isTyping = new Map();
        }
      },
    }
  )
);

export default useChatStore;