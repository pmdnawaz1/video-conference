import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./prismaService";
import config from "../config";
import { UserRole } from "@prisma/client";
import { JWTPayload, RefreshTokenPayload } from "../types";
import { EmailVerificationService } from "./emailVerificationService";

export interface LoginCredentials {
  email: string;
  password: string;
  clientId?: string;
  clientDomain?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  clientId?: string;
  clientDomain?: string;
  role?: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    role: UserRole;
    clientId: string;
    client: {
      name: string;
      domain: string | null;
    };
  };
}

/**
 * Authentication Service
 * Handles user authentication, JWT tokens, and session management
 */
export class AuthService {
  private readonly saltRounds = 12;
  private readonly accessTokenExpiry = config.jwt.expiresIn;
  private readonly refreshTokenExpiry = config.jwt.refreshExpiresIn;

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthTokens> {
    try {
      // Find or create client
      let client;
      if (data.clientId) {
        client = await prisma.client.findUnique({
          where: { id: data.clientId },
        });
        if (!client) {
          throw new Error("Client not found");
        }
      } else if (data.clientDomain) {
        client = await prisma.client.findUnique({
          where: { domain: data.clientDomain },
        });
        if (!client) {
          throw new Error("Client domain not found");
        }
      } else {
        // Use default client
        client = await prisma.client.findFirst({
          where: { domain: "localhost" },
        });
        if (!client) {
          throw new Error("No default client found");
        }
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new Error("User already exists with this email");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, this.saltRounds);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          displayName: data.displayName || `${data.firstName} ${data.lastName}`,
          passwordHash,
          role: data.role || UserRole.USER,
          clientId: client.id,
          isActive: true,
          isEmailVerified: false,
        },
        include: {
          client: {
            select: {
              name: true,
              domain: true,
            },
          },
        },
      });

      // Send verification email
      try {
        await EmailVerificationService.sendVerificationEmail(
          user.id,
          user.email,
          user.firstName,
          user.clientId,
        );
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Continue with registration even if email fails
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      console.log(
        `👤 New user registered: ${user.email} for client ${client.name}`,
      );

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName || `${user.firstName} ${user.lastName}`,
          role: user.role,
          clientId: user.clientId,
          client: user.client,
        },
      };
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  }

  /**
   * Login user with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    try {
      // Find user by email
      let user = await prisma.user.findUnique({
        where: { email: credentials.email },
        include: {
          client: {
            select: {
              name: true,
              domain: true,
            },
          },
        },
      });

      if (!user) {
        throw new Error("Invalid credentials");
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error("Account is deactivated");
      }

      // Verify client association if specified
      if (credentials.clientId && user.clientId !== credentials.clientId) {
        throw new Error("User not associated with this client");
      }

      if (
        credentials.clientDomain &&
        user.client.domain !== credentials.clientDomain
      ) {
        throw new Error("User not associated with this client domain");
      }

      // Verify password
      if (!user.passwordHash) {
        throw new Error("Password not set for this user");
      }

      const isPasswordValid = await bcrypt.compare(
        credentials.password,
        user.passwordHash,
      );
      if (!isPasswordValid) {
        throw new Error("Invalid credentials");
      }

      // Update last login
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
        include: {
          client: {
            select: {
              name: true,
              domain: true,
            },
          },
        },
      });

      // Generate tokens
      const tokens = await this.generateTokens(user);

      console.log(
        `🔐 User logged in: ${user.email} from client ${user.client.name}`,
      );

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName || `${user.firstName} ${user.lastName}`,
          role: user.role,
          clientId: user.clientId,
          client: user.client,
        },
      };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const payload = jwt.verify(
        refreshToken,
        config.jwt.refreshSecret,
      ) as RefreshTokenPayload;

      // Find user with matching token version
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          client: {
            select: {
              name: true,
              domain: true,
            },
          },
        },
      });

      if (!user || !user.isActive) {
        throw new Error("Invalid refresh token");
      }

      // Check token version (for token invalidation)
      if (user.tokenVersion !== payload.tokenVersion) {
        throw new Error("Invalid refresh token version");
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      console.error("Refresh token error:", error);
      throw new Error("Invalid refresh token");
    }
  }

  /**
   * Logout user (invalidate all tokens)
   */
  async logout(userId: string): Promise<void> {
    try {
      // Increment token version to invalidate all existing tokens
      await prisma.user.update({
        where: { id: userId },
        data: {
          tokenVersion: { increment: 1 },
        },
      });

      console.log(`🔐 User logged out: ${userId}`);
    } catch (error) {
      console.error("Logout error:", error);
      throw new Error("Failed to logout");
    }
  }

  /**
   * Verify JWT access token
   */
  async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;

      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { isActive: true },
      });

      if (!user || !user.isActive) {
        throw new Error("User not found or inactive");
      }

      return payload;
    } catch (error) {
      throw new Error("Invalid access token");
    }
  }

  /**
   * Get user by ID with full details
   */
  async getUserById(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              domain: true,
              features: true,
            },
          },
        },
      });

      if (!user || !user.isActive) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName || `${user.firstName} ${user.lastName}`,
        avatar: user.avatar,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        timezone: user.timezone,
        locale: user.locale,
        preferences: user.preferences,
        clientId: user.clientId,
        client: user.client,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      };
    } catch (error) {
      console.error("Get user error:", error);
      return null;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

      if (!user || !user.passwordHash) {
        throw new Error("User not found");
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      );
      if (!isCurrentPasswordValid) {
        throw new Error("Current password is incorrect");
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);

      // Update password and increment token version to logout all sessions
      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: newPasswordHash,
          tokenVersion: { increment: 1 },
        },
      });

      console.log(`🔐 Password updated for user: ${userId}`);
    } catch (error) {
      console.error("Password update error:", error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      displayName?: string;
      avatar?: string;
      timezone?: string;
      locale?: string;
      preferences?: any;
    },
  ) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
        include: {
          client: {
            select: {
              name: true,
              domain: true,
            },
          },
        },
      });

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName || `${user.firstName} ${user.lastName}`,
        avatar: user.avatar,
        role: user.role,
        timezone: user.timezone,
        locale: user.locale,
        preferences: user.preferences,
        clientId: user.clientId,
        client: user.client,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      console.error("Profile update error:", error);
      throw new Error("Failed to update profile");
    }
  }

  /**
   * Check if user has required role
   */
  hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
    const roleHierarchy = {
      [UserRole.GUEST]: 0,
      [UserRole.USER]: 1,
      [UserRole.ADMIN]: 2,
      [UserRole.SUPER_ADMIN]: 3,
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  /**
   * Check if user belongs to client
   */
  async belongsToClient(userId: string, clientId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { clientId: true },
      });

      return user?.clientId === clientId;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate JWT tokens
   */
  async generateTokens(
    user: any,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
    };

    const refreshPayload: RefreshTokenPayload = {
      userId: user.id,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: this.accessTokenExpiry,
      issuer: "video-conference-platform",
      audience: user.clientId,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(refreshPayload, config.jwt.refreshSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: "video-conference-platform",
      audience: user.clientId,
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
  }
}

// Export singleton instance
export const authService = new AuthService();

export default authService;
