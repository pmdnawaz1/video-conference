import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Send, X, MessageSquare, Paperclip, Smile, Reply, MoreVertical, Flag, Trash2, Edit3, Lock } from 'lucide-react';
import useChatStore from '@/stores/chatStore.js';

const ChatInterface = ({ roomId, currentUser, webrtcService, isMinimized = false, onToggle, typingUsers: propTypingUsers, meetingId }) => {
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showPrivateChat, setShowPrivateChat] = useState(false);
  const [selectedPrivateUser, setSelectedPrivateUser] = useState(null);
  const [messageContextMenu, setMessageContextMenu] = useState({ show: false, messageId: null, x: 0, y: 0 });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Common emoji reactions
  const commonEmojis = ['👍', '👎', '❤️', '😄', '😢', '😮', '😡', '👏'];

  const {
    getRoomMessages,
    addMessage,
    openChat,
    closeChat,
    isChatOpen,
    selectedRoomId,
    getUnreadCount,
    markAsRead,
  } = useChatStore();

  const messages = getRoomMessages(roomId);
  const unreadCount = getUnreadCount(roomId);
  const typingUsers = propTypingUsers || [];

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
      id: editingMessage ? editingMessage.id : `msg_${Date.now()}_${Math.random()}`,
      content: newMessage.trim(),
      sender: {
        id: currentUser.id || currentUser.name,
        name: currentUser.name,
        isGuest: currentUser.isGuest || false,
      },
      timestamp: editingMessage ? editingMessage.timestamp : new Date().toISOString(),
      editedAt: editingMessage ? new Date().toISOString() : null,
      type: showPrivateChat ? 'private' : 'text',
      replyTo: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content.substring(0, 50) + (replyingTo.content.length > 50 ? '...' : ''),
        sender: replyingTo.sender
      } : null,
      privateRecipient: showPrivateChat ? selectedPrivateUser : null,
      reactions: editingMessage ? editingMessage.reactions : []
    };

    // Add to local store
    if (editingMessage) {
      // Update existing message
      // This would need to be implemented in the chat store
    } else {
      addMessage(roomId, messageData);
    }

    // Send via WebRTC service
    if (webrtcService && webrtcService.sendChatMessage) {
      try {
        webrtcService.sendChatMessage(messageData);
      } catch (error) {
        console.error('Failed to send chat message:', error);
      }
    }

    // Reset state
    setNewMessage('');
    setIsTyping(false);
    setReplyingTo(null);
    setEditingMessage(null);
    setShowPrivateChat(false);
    
    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId);
    formData.append('userId', currentUser.id || currentUser.name);

    try {
      // Assuming an API endpoint for file uploads
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/chat/upload`, {
        method: 'POST',
        body: formData,
        // Add authorization header if needed
      });

      if (response.ok) {
        const result = await response.json();
        const fileMessage = {
          id: `file_${Date.now()}_${Math.random()}`,
          content: `File: ${file.name}`,
          sender: {
            id: currentUser.id || currentUser.name,
            name: currentUser.name,
            isGuest: currentUser.isGuest || false,
          },
          timestamp: new Date().toISOString(),
          type: 'file',
          fileUrl: result.fileUrl, // Assuming API returns the URL of the uploaded file
          fileName: file.name,
        };
        addMessage(roomId, fileMessage);
        if (webrtcService && webrtcService.sendChatMessage) {
          webrtcService.sendChatMessage(fileMessage);
        }
      } else {
        alert('File upload failed.');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file.');
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    if (!isTyping && e.target.value.trim()) {
      setIsTyping(true);
      if (webrtcService && webrtcService.sendTypingStatus) {
        webrtcService.sendTypingStatus(roomId, currentUser.id || currentUser.name, true);
      }
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (webrtcService && webrtcService.sendTypingStatus) {
        webrtcService.sendTypingStatus(roomId, currentUser.id || currentUser.name, false);
      }
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

  const formatMessage = (message) => {
    if (message.type === 'file') {
      return `<a href="${message.fileUrl}" target="_blank" class="text-blue-500 underline">${message.fileName}</a>`;
    }
    // Simple URL detection and basic formatting
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return message.content.replace(urlRegex, '<a href="$1" target="_blank" class="text-blue-500 underline">$1</a>');
  };

  const handleReaction = (messageId, emoji) => {
    const reactionData = {
      messageId,
      emoji,
      userId: currentUser.id || currentUser.name,
      userName: currentUser.name,
      timestamp: Date.now()
    };
    
    if (webrtcService && webrtcService.sendMessageReaction) {
      webrtcService.sendMessageReaction(reactionData);
    }
  };

  const handleReplyTo = (message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const handleEditMessage = (message) => {
    if (message.sender.id === (currentUser?.id || currentUser?.name)) {
      setEditingMessage(message);
      setNewMessage(message.content);
      inputRef.current?.focus();
    }
  };

  const handleDeleteMessage = (messageId) => {
    if (webrtcService && webrtcService.deleteMessage) {
      webrtcService.deleteMessage(messageId);
    }
    setMessageContextMenu({ show: false, messageId: null, x: 0, y: 0 });
  };

  const handleMessageContextMenu = (e, message) => {
    e.preventDefault();
    setMessageContextMenu({
      show: true,
      messageId: message.id,
      x: e.clientX,
      y: e.clientY,
      message: message
    });
  };

  const handleStartPrivateChat = (userId, userName) => {
    setSelectedPrivateUser({ userId, userName });
    setShowPrivateChat(true);
  };

  const isAdmin = currentUser?.role === 'admin';
  const canModerate = (message) => {
    return isAdmin || message.sender.id === (currentUser?.id || currentUser?.name);
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      setMessageContextMenu({ show: false, messageId: null, x: 0, y: 0 });
      setShowEmojiPicker(false);
    };
    
    if (messageContextMenu.show || showEmojiPicker) {
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [messageContextMenu.show, showEmojiPicker]);

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
            messages.map((message) => {
              const isOwnMessage = message.sender.id === (currentUser?.id || currentUser?.name);
              const isPrivateMessage = message.type === 'private';
              const isRelevantPrivateMessage = isPrivateMessage && 
                (message.privateRecipient?.userId === (currentUser?.id || currentUser?.name) ||
                 message.sender.id === (currentUser?.id || currentUser?.name));
              
              // Hide private messages that aren't relevant to current user
              if (isPrivateMessage && !isRelevantPrivateMessage) {
                return null;
              }
              
              return (
                <div
                  key={message.id}
                  className={`flex ${
                    isOwnMessage ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg relative group ${
                      isOwnMessage
                        ? 'bg-blue-500 text-white'
                        : isPrivateMessage
                        ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100 border-2 border-purple-300 dark:border-purple-700'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                    }`}
                    onContextMenu={(e) => handleMessageContextMenu(e, message)}
                  >
                    {/* Reply indicator */}
                    {message.replyTo && (
                      <div className="text-xs opacity-60 mb-2 pl-2 border-l-2 border-current">
                        <div className="font-medium">@{message.replyTo.sender.name}</div>
                        <div className="truncate">{message.replyTo.content}</div>
                      </div>
                    )}
                    
                    {/* Private message indicator */}
                    {isPrivateMessage && (
                      <div className="flex items-center gap-1 text-xs opacity-75 mb-1">
                        <Lock className="w-3 h-3" />
                        <span>Private to {isOwnMessage ? message.privateRecipient.userName : 'you'}</span>
                      </div>
                    )}
                    
                    <div className="text-xs opacity-75 mb-1">
                      {message.sender.name}
                      {message.sender.isGuest && ' (Guest)'}
                      {message.editedAt && ' (edited)'}
                    </div>
                    
                    <div 
                      className="text-sm"
                      dangerouslySetInnerHTML={{ 
                        __html: formatMessage(message) 
                      }}
                    />
                    
                    {/* Message reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(
                          message.reactions.reduce((acc, reaction) => {
                            acc[reaction.emoji] = acc[reaction.emoji] || [];
                            acc[reaction.emoji].push(reaction.userId);
                            return acc;
                          }, {})
                        ).map(([emoji, users]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(message.id, emoji)}
                            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                              users.includes(currentUser?.id || currentUser?.name)
                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                            }`}
                            title={users.map(id => message.reactions.find(r => r.userId === id)?.userName || id).join(', ')}
                          >
                            {emoji} {users.length}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs opacity-75">
                        {formatTime(message.timestamp)}
                      </div>
                      
                      {/* Message actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 p-0"
                          onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                          title="Add reaction"
                        >
                          <Smile className="w-3 h-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 p-0"
                          onClick={() => handleReplyTo(message)}
                          title="Reply"
                        >
                          <Reply className="w-3 h-3" />
                        </Button>
                        {canModerate(message) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 p-0"
                            onClick={(e) => handleMessageContextMenu(e, message)}
                            title="More options"
                          >
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Emoji picker */}
                    {showEmojiPicker === message.id && (
                      <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-2 shadow-lg z-10">
                        <div className="flex flex-wrap gap-1">
                          {commonEmojis.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => {
                                handleReaction(message.id, emoji);
                                setShowEmojiPicker(null);
                              }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          
          {/* Typing indicator */}
          {propTypingUsers.length > 0 && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg">
                <div className="text-xs">
                  {propTypingUsers.join(', ')} {propTypingUsers.length === 1 ? 'is' : 'are'} typing...
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Reply/Edit indicator */}
        {(replyingTo || editingMessage) && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-2 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  {editingMessage ? 'Editing message' : `Replying to ${replyingTo.sender.name}`}
                </div>
                {!editingMessage && (
                  <div className="text-sm text-blue-600 dark:text-blue-400 truncate">
                    {replyingTo.content}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0"
                onClick={() => {
                  setReplyingTo(null);
                  setEditingMessage(null);
                  setNewMessage('');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Private chat toggle */}
        <div className="flex items-center gap-2 mb-2">
          <Button
            size="sm"
            variant={showPrivateChat ? 'default' : 'outline'}
            className="h-6 text-xs"
            onClick={() => setShowPrivateChat(!showPrivateChat)}
          >
            <Lock className="w-3 h-3 mr-1" />
            Private
          </Button>
          {showPrivateChat && !selectedPrivateUser && (
            <div className="text-xs text-muted-foreground">
              Select a participant to send private message
            </div>
          )}
          {showPrivateChat && selectedPrivateUser && (
            <div className="text-xs text-purple-600 dark:text-purple-400">
              To: {selectedPrivateUser.userName}
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={`Type a message...${showPrivateChat ? ' (private)' : ''}`}
            className="flex-1"
            maxLength={500}
          />
          <input
            type="file"
            id="file-upload"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt"
          />
          <Button
            onClick={() => document.getElementById('file-upload').click()}
            size="sm"
            variant="outline"
            className="px-3"
            title="Attach File"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || (showPrivateChat && !selectedPrivateUser)}
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
      
      {/* Message Context Menu */}
      {messageContextMenu.show && (
        <div 
          className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg py-1 z-50"
          style={{ left: messageContextMenu.x, top: messageContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => {
              handleReplyTo(messageContextMenu.message);
              setMessageContextMenu({ show: false, messageId: null, x: 0, y: 0 });
            }}
          >
            <Reply className="w-4 h-4" />
            Reply
          </button>
          
          {canModerate(messageContextMenu.message) && (
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              onClick={() => {
                handleEditMessage(messageContextMenu.message);
                setMessageContextMenu({ show: false, messageId: null, x: 0, y: 0 });
              }}
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
          )}
          
          {canModerate(messageContextMenu.message) && (
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
              onClick={() => handleDeleteMessage(messageContextMenu.messageId)}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          
          {isAdmin && messageContextMenu.message && messageContextMenu.message.sender.id !== (currentUser?.id || currentUser?.name) && (
            <>
              <hr className="my-1" />
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-orange-600 dark:text-orange-400"
                onClick={() => {
                  // Flag/report message logic
                  console.log('Flag message:', messageContextMenu.messageId);
                  setMessageContextMenu({ show: false, messageId: null, x: 0, y: 0 });
                }}
              >
                <Flag className="w-4 h-4" />
                Moderate
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                onClick={() => {
                  handleStartPrivateChat(messageContextMenu.message.sender.id, messageContextMenu.message.sender.name);
                  setMessageContextMenu({ show: false, messageId: null, x: 0, y: 0 });
                }}
              >
                <Lock className="w-4 h-4" />
                Private Message
              </button>
            </>
          )}
        </div>
      )}
    </Card>
  );
};

export default ChatInterface;