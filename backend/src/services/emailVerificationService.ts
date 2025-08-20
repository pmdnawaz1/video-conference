import crypto from "crypto";
import { prisma } from "./prismaService";
import { emailService } from "./emailService";

export class EmailVerificationService {
  // Generate secure verification token
  static generateVerificationToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // Send verification email to user
  static async sendVerificationEmail(
    userId: string,
    email: string,
    firstName: string,
    clientId?: string,
  ) {
    try {
      // Generate verification token
      const token = this.generateVerificationToken();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

      // Store token in user record
      await prisma.user.update({
        where: { id: userId },
        data: {
          verificationToken: token,
          verificationExpires: expiresAt,
        },
      });

      // Create verification URL
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const verificationUrl = `${baseUrl}/verify-email?token=${token}`;

      // Send email
      const emailSent = await emailService.sendEmail(
        {
          to: email,
          subject: "Verify Your Email Address",
          template: {
            name: "verification-email",
            data: {
              firstName,
              verificationUrl,
              expiresAt: expiresAt.toLocaleString(),
              companyName: process.env.COMPANY_NAME || "Video Conference",
              supportEmail:
                process.env.SUPPORT_EMAIL || "support@videoconference.com",
            },
          },
        },
        clientId || "default",
        userId,
      );

      if (!emailSent) {
        throw new Error("Failed to send verification email");
      }

      console.log(
        `📧 Verification email sent to ${email} (expires ${expiresAt.toISOString()})`,
      );
      return true;
    } catch (error) {
      console.error("Error sending verification email:", error);
      throw new Error("Failed to send verification email");
    }
  }

  // Verify email token
  static async verifyEmailToken(token: string) {
    try {
      // Find user by token
      const user = await prisma.user.findFirst({
        where: {
          verificationToken: token,
          verificationExpires: {
            gt: new Date(), // Token not expired
          },
        },
      });

      if (!user) {
        throw new Error("Invalid or expired verification token");
      }

      // Check if already verified
      if (user.isEmailVerified) {
        return {
          success: true,
          message: "Email already verified",
          alreadyVerified: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        };
      }

      // Update user as verified and clear token
      const verifiedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          verificationToken: null,
          verificationExpires: null,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Email verified for user ${user.email}`);

      return {
        success: true,
        message: "Email verified successfully",
        alreadyVerified: false,
        user: {
          id: verifiedUser.id,
          email: verifiedUser.email,
          firstName: verifiedUser.firstName,
          lastName: verifiedUser.lastName,
          isEmailVerified: verifiedUser.isEmailVerified,
        },
      };
    } catch (error) {
      console.error("Error verifying email token:", error);
      throw error;
    }
  }

  // Resend verification email
  static async resendVerificationEmail(email: string) {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Check if already verified
      if (user.isEmailVerified) {
        return {
          success: true,
          message: "Email already verified",
          alreadyVerified: true,
        };
      }

      // Check rate limiting (max 1 email per 5 minutes)
      if (
        user.verificationExpires &&
        user.verificationExpires > new Date(Date.now() - 5 * 60 * 1000)
      ) {
        throw new Error(
          "Please wait 5 minutes before requesting another verification email",
        );
      }

      // Send new verification email
      await this.sendVerificationEmail(user.id, user.email, user.firstName);

      return {
        success: true,
        message: "Verification email sent",
        alreadyVerified: false,
      };
    } catch (error) {
      console.error("Error resending verification email:", error);
      throw error;
    }
  }

  // Clean up expired verification tokens (run periodically)
  static async cleanupExpiredTokens() {
    try {
      const result = await prisma.user.updateMany({
        where: {
          verificationExpires: {
            lt: new Date(),
          },
        },
        data: {
          verificationToken: null,
          verificationExpires: null,
        },
      });

      console.log(`🧹 Cleaned up ${result.count} expired verification tokens`);
      return result.count;
    } catch (error) {
      console.error("Error cleaning up expired tokens:", error);
      throw error;
    }
  }

  // Check if user email is verified
  static async isEmailVerified(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isEmailVerified: true },
      });

      return user?.isEmailVerified || false;
    } catch (error) {
      console.error("Error checking email verification:", error);
      return false;
    }
  }

  // Get verification status for user
  static async getVerificationStatus(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          isEmailVerified: true,
          verificationToken: true,
          verificationExpires: true,
          email: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      return {
        isVerified: user.isEmailVerified,
        hasPendingToken: !!user.verificationToken,
        tokenExpires: user.verificationExpires,
        email: user.email,
      };
    } catch (error) {
      console.error("Error getting verification status:", error);
      throw error;
    }
  }
}
