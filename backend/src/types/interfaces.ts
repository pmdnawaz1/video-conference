import { Request } from "express";
import { UserRole, MeetingStatus } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  clientId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface AuthenticatedRequestWithUser extends Request {
  user: AuthenticatedUser;
}

export interface SocketUser {
  id: string;
  socketId: string;
  name: string;
  email: string;
  roomId?: string;
  meetingId?: string;
  isScreenSharing?: boolean;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
  lastSeen: Date;
  permissions: {
    canChat: boolean;
    canShare: boolean;
    isModerator: boolean;
  };
  handRaised?: boolean;
  status?: "online" | "away" | "busy";
}

export interface Room {
  id: string;
  name: string;
  createdBy: string;
  users: Map<string, SocketUser>;
  maxUsers?: number;
  isRecording?: boolean;
  createdAt: Date;
}

export interface WebRTCMessage {
  type:
    | "offer"
    | "answer"
    | "ice-candidate"
    | "join-room"
    | "leave-room"
    | "user-joined"
    | "user-left"
    | "screen-share-start"
    | "screen-share-stop"
    | "mute-audio"
    | "unmute-audio"
    | "mute-video"
    | "unmute-video"
    | "chat-message"
    | "room-created"
    | "room-users";
  roomId: string;
  userId: string;
  data?: any;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  type: "text" | "file" | "system";
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  clientId: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
}

export interface EmailLog {
  id: string;
  to: string[];
  cc?: string[] | null;
  bcc?: string[] | null;
  subject: string;
  template?: string | null;
  status: "PENDING" | "SENT" | "FAILED" | "BOUNCED";
  sentAt?: Date | null;
  failedAt?: Date | null;
  errorMessage?: string | null;
  messageId?: string | null;
  clientId: string;
  userId?: string | null;
  metadata?: Record<string, any> | null;
}
