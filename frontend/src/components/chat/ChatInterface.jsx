import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Send, X, MessageSquare } from 'lucide-react';
import useChatStore from '@/stores/chatStore.js';

const ChatInterface = ({ roomId, currentUser, webrtcService, isMinimized = false, onToggle }) => {
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const {
    getRoomMessages,
    addMessage,
    openChat,
    closeChat,
    isChatOpen,
    selectedRoomId,
    getUnreadCount,
    markAsRead,
    getTypingUsers,
    setTyping,
  } = useChatStore();

  const messages = getRoomMessages(roomId);
  const unreadCount = getUnreadCount(roomId);
  const typingUsers = getTypingUsers(roomId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isChatOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  // Mark messages as read when chat is opened
  useEffect(() => {
    if (isChatOpen && selectedRoomId === roomId) {
      markAsRead(roomId);
    }
  }, [isChatOpen, selectedRoomId, roomId, markAsRead]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    const messageData = {
      id: `msg_${Date.now()}_${Math.random()}`,
      content: newMessage.trim(),
      sender: {
        id: currentUser.id || currentUser.name,
        name: currentUser.name,
        isGuest: currentUser.isGuest || false,
      },
      timestamp: new Date().toISOString(),
      type: 'text',
    };

    // Add to local store
    addMessage(roomId, messageData);

    // Send via WebRTC service
    if (webrtcService && webrtcService.sendChatMessage) {
      try {
        webrtcService.sendChatMessage(messageData);
      } catch (error) {
        console.error('Failed to send chat message:', error);
      }
    }

    setNewMessage('');
    setIsTyping(false);
    
    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    if (!isTyping && e.target.value.trim()) {
      setIsTyping(true);
      setTyping(currentUser?.id || currentUser?.name, roomId, true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTyping(currentUser?.id || currentUser?.name, roomId, false);
    }, 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatMessage = (content) => {
    // Simple URL detection and basic formatting
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.replace(urlRegex, '<a href="$1" target="_blank" class="text-blue-500 underline">$1</a>');
  };

  // Toggle chat handler
  const handleToggle = () => {
    if (isChatOpen && selectedRoomId === roomId) {
      closeChat();
    } else {
      openChat(roomId);
    }
    
    if (onToggle) {
      onToggle();
    }
  };

  // Minimized view (chat button with unread count)
  if (isMinimized) {
    return (
      <Button
        onClick={handleToggle}
        className="relative"
        variant={isChatOpen ? "default" : "outline"}
      >
        <MessageSquare className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
    );
  }

  // Full chat interface
  if (!isChatOpen || selectedRoomId !== roomId) {
    return null;
  }

  return (
    <Card className="w-80 h-96 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Chat</CardTitle>
          <Button
            onClick={handleToggle}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-3">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-3">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender.id === (currentUser?.id || currentUser?.name)
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg ${
                    message.sender.id === (currentUser?.id || currentUser?.name)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <div className="text-xs opacity-75 mb-1">
                    {message.sender.name}
                    {message.sender.isGuest && ' (Guest)'}
                  </div>
                  <div 
                    className="text-sm"
                    dangerouslySetInnerHTML={{ 
                      __html: formatMessage(message.content) 
                    }}
                  />
                  <div className="text-xs opacity-75 mt-1">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg">
                <div className="text-xs">
                  {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
            maxLength={500}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            size="sm"
            className="px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Character count */}
        {newMessage.length > 400 && (
          <div className="text-xs text-gray-500 mt-1 text-right">
            {newMessage.length}/500
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChatInterface;