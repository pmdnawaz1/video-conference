import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Avatar } from "../components/ui/avatar";
import { Textarea } from "../components/ui/textarea";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import {
  FiMessageSquare,
  FiSearch,
  FiSend,
  FiPaperclip,
  FiMoreVertical,
  FiPhone,
  FiVideo,
  FiUsers,
  FiEdit,
  FiTrash2,
  FiFlag,
  FiClock,
} from "react-icons/fi";
import { FaCheckCircle, FaCheckDouble } from "react-icons/fa";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import useAuthStore from "../stores/authStore";

const MessagesPage = () => {
  const { user } = useAuthStore();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [messageText, setMessageText] = useState("");
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Sample conversations data
  useEffect(() => {
    const sampleConversations = [
      {
        id: "1",
        name: "John Doe",
        type: "direct",
        avatar: null,
        lastMessage: "Hey, are we still on for the meeting tomorrow?",
        lastMessageTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        unreadCount: 2,
        isOnline: true,
        participantCount: 2,
      },
      {
        id: "2",
        name: "Engineering Team",
        type: "group",
        avatar: null,
        lastMessage: "Alice: The new feature branch is ready for review",
        lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        unreadCount: 5,
        isOnline: false,
        participantCount: 12,
      },
      {
        id: "3",
        name: "Sarah Johnson",
        type: "direct",
        avatar: null,
        lastMessage: "Thanks for the quick response!",
        lastMessageTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        unreadCount: 0,
        isOnline: false,
        participantCount: 2,
      },
      {
        id: "4",
        name: "Design Review",
        type: "group",
        avatar: null,
        lastMessage: "Mike: Updated the mockups based on your feedback",
        lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        unreadCount: 1,
        isOnline: false,
        participantCount: 6,
      },
    ];

    const sampleMessages = {
      1: [
        {
          id: "1",
          senderId: "1",
          senderName: "John Doe",
          content: "Hi! How are things going with the project?",
          timestamp: new Date(Date.now() - 60 * 60 * 1000),
          status: "read",
          type: "text",
        },
        {
          id: "2",
          senderId: user?.id,
          senderName:
            user?.displayName || `${user?.firstName} ${user?.lastName}`,
          content: "Going well! Just finished the authentication module.",
          timestamp: new Date(Date.now() - 45 * 60 * 1000),
          status: "delivered",
          type: "text",
        },
        {
          id: "3",
          senderId: "1",
          senderName: "John Doe",
          content: "Great! Hey, are we still on for the meeting tomorrow?",
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          status: "delivered",
          type: "text",
        },
      ],
      2: [
        {
          id: "4",
          senderId: "2",
          senderName: "Alice Smith",
          content:
            "Team, I've pushed the new feature branch. Please review when you get a chance.",
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
          status: "read",
          type: "text",
        },
        {
          id: "5",
          senderId: "3",
          senderName: "Bob Wilson",
          content: "Looking at it now. The implementation looks solid!",
          timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
          status: "read",
          type: "text",
        },
        {
          id: "6",
          senderId: "2",
          senderName: "Alice Smith",
          content: "The new feature branch is ready for review",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          status: "delivered",
          type: "text",
        },
      ],
    };

    setTimeout(() => {
      setConversations(sampleConversations);
      setMessages(sampleMessages);
      setSelectedConversation(sampleConversations[0]);
      setLoading(false);
    }, 1000);
  }, [user]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedConversation]);

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const currentMessages = selectedConversation
    ? messages[selectedConversation.id] || []
    : [];

  const getTimeDisplay = (date) => {
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return "now";
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const getMessageStatus = (status) => {
    switch (status) {
      case "sent":
        return <FaCheckCircle className="w-3 h-3 text-muted-foreground" />;
      case "delivered":
        return <FaCheckDouble className="w-3 h-3 text-muted-foreground" />;
      case "read":
        return <FaCheckDouble className="w-3 h-3 text-blue-500" />;
      default:
        return <FiClock className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedConversation) return;

    const newMessage = {
      id: Date.now().toString(),
      senderId: user?.id,
      senderName: user?.displayName || `${user?.firstName} ${user?.lastName}`,
      content: messageText.trim(),
      timestamp: new Date(),
      status: "sent",
      type: "text",
    };

    // Add message to current conversation
    setMessages((prev) => ({
      ...prev,
      [selectedConversation.id]: [
        ...(prev[selectedConversation.id] || []),
        newMessage,
      ],
    }));

    // Update conversation last message
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === selectedConversation.id
          ? {
              ...conv,
              lastMessage: messageText.trim(),
              lastMessageTime: new Date(),
            }
          : conv,
      ),
    );

    setMessageText("");
  };

  const ConversationList = () => (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <FiMessageSquare className="w-5 h-5 mr-2" />
            Messages
          </CardTitle>
          <Button size="sm" variant="outline">
            <FiEdit className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="space-y-1 p-4">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setSelectedConversation(conversation)}
                className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                  selectedConversation?.id === conversation.id
                    ? "bg-accent"
                    : ""
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      {conversation.type === "group" ? (
                        <FiUsers className="w-4 h-4 text-primary" />
                      ) : (
                        conversation.name.charAt(0)
                      )}
                    </div>
                    {conversation.type === "direct" &&
                      conversation.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                      )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium truncate">
                        {conversation.name}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {conversation.unreadCount > 0 && (
                          <Badge variant="default" className="text-xs">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {getTimeDisplay(conversation.lastMessageTime)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conversation.lastMessage}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const ChatWindow = () => {
    if (!selectedConversation) {
      return (
        <Card className="h-full">
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center">
              <FiMessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                No conversation selected
              </h3>
              <p className="text-muted-foreground">
                Select a conversation from the list to start messaging.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="h-full flex flex-col">
        {/* Chat Header */}
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  {selectedConversation.type === "group" ? (
                    <FiUsers className="w-4 h-4 text-primary" />
                  ) : (
                    selectedConversation.name.charAt(0)
                  )}
                </div>
                {selectedConversation.type === "direct" &&
                  selectedConversation.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
              </div>
              <div>
                <h3 className="font-medium">{selectedConversation.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedConversation.type === "group"
                    ? `${selectedConversation.participantCount} members`
                    : selectedConversation.isOnline
                      ? "Online"
                      : "Last seen recently"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <FiPhone className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <FiVideo className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <FiMoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <FiFlag className="w-4 h-4 mr-2" />
                    Report
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">
                    <FiTrash2 className="w-4 h-4 mr-2" />
                    Delete Conversation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-4">
            <div className="space-y-4">
              {currentMessages.map((message, index) => {
                const isOwn = message.senderId === user?.id;
                const showAvatar =
                  index === 0 ||
                  currentMessages[index - 1].senderId !== message.senderId;

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex space-x-2 max-w-xs lg:max-w-md ${isOwn ? "flex-row-reverse space-x-reverse" : ""}`}
                    >
                      {!isOwn && showAvatar && (
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm">
                          {message.senderName.charAt(0)}
                        </div>
                      )}
                      {!isOwn && !showAvatar && <div className="w-8" />}

                      <div
                        className={`rounded-lg px-3 py-2 ${
                          isOwn
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {!isOwn &&
                          showAvatar &&
                          selectedConversation.type === "group" && (
                            <p className="text-xs text-muted-foreground mb-1">
                              {message.senderName}
                            </p>
                          )}
                        <p className="text-sm">{message.content}</p>
                        <div
                          className={`flex items-center justify-end space-x-1 mt-1 ${
                            isOwn
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          <span className="text-xs">
                            {message.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isOwn && getMessageStatus(message.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Message Input */}
        <div className="p-4 border-t">
          <form onSubmit={sendMessage} className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" type="button">
              <FiPaperclip className="w-4 h-4" />
            </Button>
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button type="submit" disabled={!messageText.trim()}>
              <FiSend className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <DashboardLayout title="Messages" subtitle="Chat with your team members">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading messages...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Messages" subtitle="Chat with your team members">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Conversations List */}
        <div className="lg:col-span-1">
          <ConversationList />
        </div>

        {/* Chat Window */}
        <div className="lg:col-span-2">
          <ChatWindow />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MessagesPage;
