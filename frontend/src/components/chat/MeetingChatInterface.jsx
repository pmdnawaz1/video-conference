import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Send,
  Paperclip,
  Smile,
  Reply,
  MoreVertical,
  Flag,
  Trash2,
  Edit3,
  Lock,
  MessageSquare,
} from "lucide-react";
import useAuthStore from "../../stores/authStore";
import useChatStore from "../../stores/chatStore";
import { useRoleCheck } from "../auth/RoleBasedAccess";
import RoleBasedAccess, { AdminOnly } from "../auth/RoleBasedAccess";

const MeetingChatInterface = ({
  meetingId,
  roomId,
  socket,
  participants = [],
  onMessageCount,
  currentUser,
  webrtcService,
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [moderationLogs, setModerationLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [mutedUsers, setMutedUsers] = useState(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [messageContextMenu, setMessageContextMenu] = useState({
    show: false,
    messageId: null,
    x: 0,
    y: 0,
  });

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  const { user, accessToken } = useAuthStore();
  const { hasRole, canModerate, isAdmin, isSuperAdmin } = useRoleCheck();

  // Integrate with chat store
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

  // Common emoji reactions
  const commonEmojis = ["👍", "👎", "❤️", "😄", "😢", "😮", "😡", "👏"];

  // Check if user can chat (from meeting participant permissions)
  const canChat =
    participants.find((p) => p.userId === user?.id)?.canChat !== false;
  const isModerator =
    participants.find((p) => p.userId === user?.id)?.isModerator ||
    canModerate();

  useEffect(() => {
    if (socket) {
      setupSocketListeners();
      return () => cleanupSocketListeners();
    }
  }, [socket, meetingId, roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const setupSocketListeners = () => {
    socket.on("connect", () => {
      setIsConnected(true);
      // Join the meeting room for chat
      socket.emit("join-room", { roomId, userId: user?.id });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("chat-message", (message) => {
      setMessages((prev) => [
        ...prev,
        {
          ...message,
          timestamp: new Date(message.timestamp),
          id: message.id || Date.now(),
        },
      ]);
      onMessageCount && onMessageCount((prev) => prev + 1);
    });

    socket.on("message-deleted", (messageId) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setModerationLogs((prev) => [
        ...prev,
        {
          id: Date.now(),
          action: "MESSAGE_DELETED",
          messageId,
          moderatorId: user?.id,
          timestamp: new Date(),
        },
      ]);
    });

    socket.on("user-muted", ({ userId, mutedBy, reason }) => {
      setMutedUsers((prev) => new Set(prev).add(userId));
      setModerationLogs((prev) => [
        ...prev,
        {
          id: Date.now(),
          action: "USER_MUTED",
          userId,
          mutedBy,
          reason,
          timestamp: new Date(),
        },
      ]);
    });

    socket.on("user-unmuted", ({ userId, unmutedBy }) => {
      setMutedUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      setModerationLogs((prev) => [
        ...prev,
        {
          id: Date.now(),
          action: "USER_UNMUTED",
          userId,
          unmutedBy,
          timestamp: new Date(),
        },
      ]);
    });

    socket.on("user-typing", ({ userId, userName, isTyping }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        if (isTyping && userId !== user?.id) {
          newSet.add(`${userName} (${userId})`);
        } else {
          newSet.delete(`${userName} (${userId})`);
        }
        return newSet;
      });
    });

    // Load existing messages
    loadChatHistory();
  };

  const cleanupSocketListeners = () => {
    socket.off("connect");
    socket.off("disconnect");
    socket.off("chat-message");
    socket.off("message-deleted");
    socket.off("user-muted");
    socket.off("user-unmuted");
    socket.off("user-typing");
  };

  const loadChatHistory = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/chat/messages/${meetingId}?limit=50`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setMessages(
            result.messages.map((msg) => ({
              ...msg,
              timestamp: new Date(msg.createdAt),
              id: msg.id,
            })),
          );
        }
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !canChat || mutedUsers.has(user?.id)) return;

    const message = {
      meetingId,
      roomId,
      userId: user?.id,
      userName: user?.displayName || `${user?.firstName} ${user?.lastName}`,
      userRole: user?.role,
      content: newMessage.trim(),
      messageType: "TEXT",
      timestamp: new Date().toISOString(),
    };

    socket.emit("chat-message", message);
    setNewMessage("");

    // Stop typing indicator
    socket.emit("user-typing", {
      roomId,
      userId: user?.id,
      userName: message.userName,
      isTyping: false,
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !canChat || mutedUsers.has(user?.id)) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("roomId", roomId || meetingId);
    formData.append("userId", user?.id);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/chat/upload`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.ok) {
        const result = await response.json();
        const fileMessage = {
          id: `file_${Date.now()}_${Math.random()}`,
          content: `📎 ${file.name}`,
          userName: user?.displayName || `${user?.firstName} ${user?.lastName}`,
          userId: user?.id,
          userRole: user?.role,
          timestamp: new Date().toISOString(),
          type: "file",
          fileUrl: result.fileUrl,
          fileName: file.name,
          fileSize: file.size,
        };

        socket.emit("chat-message", fileMessage);

        // Also add to chat store for local state
        if (addMessage && roomId) {
          addMessage(roomId, fileMessage);
        }
      } else {
        console.error("File upload failed:", await response.text());
        alert("File upload failed. Please try again.");
      }
    } catch (error) {
      console.error("File upload error:", error);
      alert("File upload failed. Please check your connection.");
    }

    // Reset file input
    event.target.value = "";
  };

  const handleTyping = () => {
    if (!canChat || mutedUsers.has(user?.id)) return;

    // Send typing indicator
    socket.emit("user-typing", {
      roomId,
      userId: user?.id,
      userName: user?.displayName || `${user?.firstName} ${user?.lastName}`,
      isTyping: true,
    });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("user-typing", {
        roomId,
        userId: user?.id,
        userName: user?.displayName || `${user?.firstName} ${user?.lastName}`,
        isTyping: false,
      });
    }, 2000);
  };

  const deleteMessage = (messageId) => {
    if (!isModerator) return;

    if (confirm("Delete this message?")) {
      socket.emit("delete-message", {
        messageId,
        roomId,
        moderatorId: user?.id,
      });
    }
  };

  const muteUser = (userId, reason = "") => {
    if (!isModerator || userId === user?.id) return;

    const userReason =
      reason ||
      prompt("Reason for muting (optional):") ||
      "Inappropriate behavior";
    socket.emit("mute-user", {
      userId,
      roomId,
      mutedBy: user?.id,
      reason: userReason,
    });
  };

  const unmuteUser = (userId) => {
    if (!isModerator) return;

    socket.emit("unmute-user", {
      userId,
      roomId,
      unmutedBy: user?.id,
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleColor = (role) => {
    const colors = {
      SUPER_ADMIN: "bg-primary/20 text-primary",
      ADMIN: "bg-destructive/20 text-destructive",
      USER: "bg-info/20 text-info",
      GUEST: "bg-muted text-foreground",
    };
    return colors[role] || colors["GUEST"];
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">
            Meeting Chat
            {!isConnected && (
              <Badge variant="destructive" className="ml-2">
                Disconnected
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{messages.length} messages</Badge>
            {isModerator && <Badge variant="outline">Moderator</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col"
        >
          <TabsList className="mx-4">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <AdminOnly>
              <TabsTrigger value="moderation">Moderation</TabsTrigger>
            </AdminOnly>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex flex-col mt-0 mx-4">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-2 border rounded-md bg-muted mb-4 max-h-96">
              <div className="space-y-2">
                {messages.map((message) => (
                  <div key={message.id} className="group">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {message.userName || "Unknown User"}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${getRoleColor(message.userRole)}`}
                          >
                            {message.userRole}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(message.timestamp)}
                          </span>
                          {mutedUsers.has(message.userId) && (
                            <Badge variant="destructive" className="text-xs">
                              Muted
                            </Badge>
                          )}
                        </div>
                        {message.type === "file" ? (
                          <div className="text-sm">
                            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border">
                              <Paperclip className="w-4 h-4 text-blue-600" />
                              <div className="flex-1">
                                <a
                                  href={message.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                                >
                                  {message.fileName}
                                </a>
                                {message.fileSize && (
                                  <p className="text-xs text-muted-foreground">
                                    {(message.fileSize / 1024).toFixed(1)} KB
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-foreground">
                            {message.content}
                          </p>
                        )}
                      </div>

                      {/* Moderation Actions */}
                      <RoleBasedAccess requiredRole="ADMIN">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                ⋮
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem
                                onClick={() => deleteMessage(message.id)}
                                className="text-red-600"
                              >
                                Delete Message
                              </DropdownMenuItem>
                              {message.userId !== user?.id && (
                                <>
                                  {!mutedUsers.has(message.userId) ? (
                                    <DropdownMenuItem
                                      onClick={() => muteUser(message.userId)}
                                      className="text-orange-600"
                                    >
                                      Mute User
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => unmuteUser(message.userId)}
                                      className="text-green-600"
                                    >
                                      Unmute User
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </RoleBasedAccess>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Typing Indicators */}
            {typingUsers.size > 0 && (
              <div className="text-xs text-muted-foreground mb-2">
                {Array.from(typingUsers).join(", ")}{" "}
                {typingUsers.size === 1 ? "is" : "are"} typing...
              </div>
            )}

            {/* Message Input */}
            <div className="space-y-2">
              {mutedUsers.has(user?.id) && (
                <div className="text-center text-red-600 text-sm">
                  You have been muted and cannot send messages.
                </div>
              )}

              {!canChat && !mutedUsers.has(user?.id) && (
                <div className="text-center text-yellow-600 text-sm">
                  Chat is disabled for your role in this meeting.
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      sendMessage();
                    }
                  }}
                  placeholder={
                    mutedUsers.has(user?.id)
                      ? "You are muted"
                      : !canChat
                        ? "Chat disabled"
                        : "Type a message..."
                  }
                  disabled={
                    !canChat || mutedUsers.has(user?.id) || !isConnected
                  }
                  className="flex-1"
                  maxLength={500}
                />
                <input
                  type="file"
                  id="chat-file-upload"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.mp4,.mp3,.zip"
                />
                <Button
                  onClick={() =>
                    document.getElementById("chat-file-upload").click()
                  }
                  size="sm"
                  variant="outline"
                  disabled={
                    !canChat || mutedUsers.has(user?.id) || !isConnected
                  }
                  title="Attach File"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Button
                  onClick={sendMessage}
                  disabled={
                    !newMessage.trim() ||
                    !canChat ||
                    mutedUsers.has(user?.id) ||
                    !isConnected
                  }
                  size="sm"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              {/* Character count */}
              {newMessage.length > 400 && (
                <div className="text-xs text-muted-foreground mt-1 text-right">
                  {newMessage.length}/500
                </div>
              )}
            </div>
          </TabsContent>

          {/* Moderation Panel */}
          <AdminOnly>
            <TabsContent value="moderation" className="flex-1 mt-0 mx-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Participant Controls</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {participants.map((participant) => (
                      <div
                        key={participant.userId}
                        className="flex justify-between items-center p-2 border rounded"
                      >
                        <div>
                          <span className="font-medium">
                            {participant.user?.firstName}{" "}
                            {participant.user?.lastName}
                          </span>
                          <Badge variant="outline" className="ml-2">
                            {participant.user?.role}
                          </Badge>
                          {mutedUsers.has(participant.userId) && (
                            <Badge variant="destructive" className="ml-2">
                              Muted
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!mutedUsers.has(participant.userId) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => muteUser(participant.userId)}
                              disabled={participant.userId === user?.id}
                            >
                              Mute
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unmuteUser(participant.userId)}
                            >
                              Unmute
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Moderation Log</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {moderationLogs.map((log) => (
                      <div
                        key={log.id}
                        className="text-xs p-2 bg-muted rounded"
                      >
                        <span className="font-medium">{log.action}</span> at{" "}
                        {formatTime(log.timestamp)}
                        {log.reason && (
                          <span className="text-muted-foreground">
                            {" "}
                            - {log.reason}
                          </span>
                        )}
                      </div>
                    ))}
                    {moderationLogs.length === 0 && (
                      <div className="text-xs text-muted-foreground">
                        No moderation actions yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </AdminOnly>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default MeetingChatInterface;
