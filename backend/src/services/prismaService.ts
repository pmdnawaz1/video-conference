import { PrismaClient } from '@prisma/client';
import config from '../config';

class PrismaService {
  public client: PrismaClient;

  constructor() {
    this.client = new PrismaClient({
      log: config.server.nodeEnv === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
      errorFormat: 'pretty',
    });

    // Connection event handlers
    this.client.$connect()
      .then(() => {
        console.log('✅ Database connected successfully');
      })
      .catch((error) => {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
      });
  }

  async onApplicationShutdown() {
    console.log('📝 Disconnecting from database...');
    await this.client.$disconnect();
    console.log('✅ Database disconnected');
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  // Common query helpers
  async findUserByEmail(email: string) {
    return this.client.user.findUnique({
      where: { email },
      include: {
        client: true,
      },
    });
  }

  async findUserById(id: string) {
    return this.client.user.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });
  }

  async createUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    clientId: string;
    passwordHash?: string;
    role?: any;
  }) {
    return this.client.user.create({
      data,
      include: {
        client: true,
      },
    });
  }

  async createRoom(data: {
    name: string;
    clientId: string;
    maxParticipants?: number;
  }) {
    return this.client.room.create({
      data,
    });
  }

  async findRoomById(id: string) {
    return this.client.room.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
        meeting: true,
      },
    });
  }

  async createMeeting(data: {
    title: string;
    createdBy: string;
    clientId: string;
    roomId?: string;
    scheduledStartTime?: Date;
    scheduledEndTime?: Date;
    maxParticipants?: number;
  }) {
    return this.client.meeting.create({
      data,
      include: {
        creator: true,
        room: true,
      },
    });
  }

  async findMeetingById(id: string) {
    return this.client.meeting.findUnique({
      where: { id },
      include: {
        creator: true,
        room: true,
        participants: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async createMeetingParticipant(data: {
    userId: string;
    meetingId: string;
    roomId?: string;
    isModerator?: boolean;
  }) {
    return this.client.meetingParticipant.create({
      data,
      include: {
        user: true,
        meeting: true,
      },
    });
  }

  async updateMeetingParticipant(
    userId: string,
    meetingId: string,
    data: {
      isPresent?: boolean;
      joinedAt?: Date;
      leftAt?: Date;
      isAudioMuted?: boolean;
      isVideoMuted?: boolean;
      isScreenSharing?: boolean;
      connectionQuality?: string;
    }
  ) {
    return this.client.meetingParticipant.update({
      where: {
        userId_meetingId: {
          userId,
          meetingId,
        },
      },
      data,
    });
  }

  async createChatMessage(data: {
    content: string;
    userId: string;
    meetingId: string;
    roomId?: string;
    messageType?: any;
  }) {
    return this.client.chatMessage.create({
      data,
      include: {
        user: true,
      },
    });
  }

  async findClient(identifier: string | { id: string } | { domain: string }) {
    if (typeof identifier === 'string') {
      // Assume it's an ID if it's a string
      return this.client.client.findUnique({
        where: { id: identifier },
      });
    } else {
      return this.client.client.findUnique({
        where: identifier,
      });
    }
  }

  async createClient(data: {
    name: string;
    domain?: string;
    maxUsers?: number;
  }) {
    return this.client.client.create({
      data,
    });
  }
}

// Export singleton instance
export const prismaService = new PrismaService();

// Export the PrismaClient instance for direct access
export const prisma = prismaService.client;

// Graceful shutdown handler
process.on('beforeExit', async () => {
  await prismaService.onApplicationShutdown();
});

export default prismaService;