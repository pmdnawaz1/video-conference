import {
  PrismaClient,
  UserRole,
  MeetingStatus,
  MeetingType,
  InvitationStatus,
  InvitationType,
  RecordingStatus,
  ChatMessageType,
  NotificationType,
  EmailStatus,
  InteractionType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

// Helper function to generate random past date
const randomPastDate = (days: number = 30) => {
  const now = new Date();
  const past = new Date(
    now.getTime() - Math.random() * days * 24 * 60 * 60 * 1000,
  );
  return past;
};

// Helper function to generate random future date
const randomFutureDate = (days: number = 30) => {
  const now = new Date();
  const future = new Date(
    now.getTime() + Math.random() * days * 24 * 60 * 60 * 1000,
  );
  return future;
};

// Helper function to generate meeting duration
const randomDuration = () => Math.floor(Math.random() * 180) + 15; // 15-195 minutes

async function main() {
  console.log("🌱 Starting comprehensive database seeding...");

  // Clear existing data
  console.log("🧹 Cleaning existing data...");
  await prisma.meetingInteraction.deleteMany();
  await prisma.meetingReaction.deleteMany();
  await prisma.file.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.meetingAnalytics.deleteMany();
  await prisma.userAnalytics.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.recording.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.meetingParticipant.deleteMany();
  await prisma.room.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();

  // 1. Create Clients (Multi-tenant organizations)
  console.log("🏢 Creating clients...");
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        name: "Quibic Solutions",
        domain: "quibic.com",
        logo: "https://example.com/logos/quibic.png",
        settings: {
          timezone: "Asia/Kolkata",
          language: "en",
          theme: "corporate",
          branding: {
            primaryColor: "#3b82f6",
            secondaryColor: "#1f2937",
          },
        },
        features: {
          maxMeetingDuration: 480,
          recordingEnabled: true,
          chatEnabled: true,
          screenShareEnabled: true,
          waitingRoomEnabled: true,
          advancedAnalytics: true,
        },
        isActive: true,
        maxUsers: 500,
        maxMeetingDuration: 480,
        storageQuota: 100000, // 100GB in MB
      },
    }),
    prisma.client.create({
      data: {
        name: "TechStart Inc",
        domain: "techstart.io",
        logo: "https://example.com/logos/techstart.png",
        settings: {
          timezone: "America/New_York",
          language: "en",
          theme: "modern",
        },
        features: {
          maxMeetingDuration: 240,
          recordingEnabled: true,
          chatEnabled: true,
          screenShareEnabled: true,
        },
        isActive: true,
        maxUsers: 100,
        maxMeetingDuration: 240,
        storageQuota: 50000,
      },
    }),
    prisma.client.create({
      data: {
        name: "Demo Corporation",
        domain: "demo.example.com",
        settings: {
          timezone: "Europe/London",
          language: "en",
        },
        features: {
          maxMeetingDuration: 120,
          recordingEnabled: false,
          chatEnabled: true,
        },
        isActive: true,
        maxUsers: 50,
        maxMeetingDuration: 120,
        storageQuota: 10000,
      },
    }),
  ]);

  // 2. Create Users with various roles
  console.log("👥 Creating users...");
  const hashedPassword = await bcrypt.hash("password123", 10);

  const users = [];

  // Create users for each client
  for (const client of clients) {
    // Super Admin (only for first client)
    if (client.name === "Quibic Solutions") {
      users.push(
        await prisma.user.create({
          data: {
            email: "superadmin@quibic.com",
            firstName: "Super",
            lastName: "Admin",
            displayName: "Super Administrator",
            role: UserRole.SUPER_ADMIN,
            isActive: true,
            isEmailVerified: true,
            passwordHash: hashedPassword,
            lastLoginAt: new Date(),
            timezone: "Asia/Kolkata",
            locale: "en-IN",
            preferences: {
              theme: "dark",
              notifications: {
                email: true,
                push: true,
                meeting_reminders: true,
              },
              meeting: {
                default_audio_muted: false,
                default_video_muted: false,
                show_participant_names: true,
              },
            },
            clientId: client.id,
          },
        }),
      );
    }

    // Admin users
    users.push(
      await prisma.user.create({
        data: {
          email: `admin@${client.domain || "example.com"}`,
          firstName: "Admin",
          lastName: "User",
          displayName: `${client.name} Administrator`,
          role: UserRole.ADMIN,
          isActive: true,
          isEmailVerified: true,
          passwordHash: hashedPassword,
          lastLoginAt: randomPastDate(7),
          timezone:
            client.settings &&
            typeof client.settings === "object" &&
            "timezone" in client.settings
              ? (client.settings.timezone as string)
              : "UTC",
          locale: "en",
          preferences: {
            theme: "light",
            notifications: { email: true, push: true },
          },
          clientId: client.id,
        },
      }),
    );

    // Regular users
    for (let i = 0; i < 15; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      users.push(
        await prisma.user.create({
          data: {
            email: faker.internet.email({ firstName, lastName }).toLowerCase(),
            firstName,
            lastName,
            displayName: `${firstName} ${lastName}`,
            role: i < 2 ? UserRole.ADMIN : UserRole.USER,
            isActive: Math.random() > 0.1, // 90% active
            isEmailVerified: Math.random() > 0.2, // 80% verified
            passwordHash: hashedPassword,
            lastLoginAt: Math.random() > 0.3 ? randomPastDate(30) : null,
            timezone:
              client.settings &&
              typeof client.settings === "object" &&
              "timezone" in client.settings
                ? (client.settings.timezone as string)
                : "UTC",
            locale: "en",
            avatar: Math.random() > 0.5 ? faker.image.avatar() : null,
            preferences: {
              theme: Math.random() > 0.5 ? "light" : "dark",
              notifications: {
                email: Math.random() > 0.3,
                push: Math.random() > 0.4,
                meeting_reminders: Math.random() > 0.2,
              },
            },
            clientId: client.id,
          },
        }),
      );
    }

    // Guest users
    for (let i = 0; i < 5; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      users.push(
        await prisma.user.create({
          data: {
            email: faker.internet.email({ firstName, lastName }).toLowerCase(),
            firstName,
            lastName,
            displayName: `${firstName} ${lastName}`,
            role: UserRole.GUEST,
            isActive: true,
            isEmailVerified: Math.random() > 0.5,
            passwordHash: hashedPassword,
            lastLoginAt: Math.random() > 0.6 ? randomPastDate(7) : null,
            timezone: "UTC",
            locale: "en",
            clientId: client.id,
          },
        }),
      );
    }
  }

  console.log(`✅ Created ${users.length} users`);

  // 3. Create Groups
  console.log("👨‍👩‍👧‍👦 Creating groups...");
  const groups = [];

  for (const client of clients) {
    const clientUsers = users.filter((u) => u.clientId === client.id);
    const groupNames = [
      "Engineering",
      "Marketing",
      "Sales",
      "HR",
      "Executive",
      "Support",
    ];

    for (const groupName of groupNames) {
      const group = await prisma.group.create({
        data: {
          name: groupName,
          description: `${groupName} department for ${client.name}`,
          isActive: true,
          settings: {
            defaultMeetingSettings: {
              waitingRoom: groupName === "Executive",
              recordingEnabled: groupName !== "HR",
            },
          },
          clientId: client.id,
        },
      });
      groups.push(group);

      // Add members to groups
      const memberCount = Math.floor(Math.random() * 5) + 2;
      const selectedUsers = faker.helpers.arrayElements(
        clientUsers,
        memberCount,
      );

      for (const user of selectedUsers) {
        await prisma.groupMember.create({
          data: {
            userId: user.id,
            groupId: group.id,
            role: Math.random() > 0.8 ? "admin" : "member",
            joinedAt: randomPastDate(60),
          },
        });
      }
    }
  }

  console.log(`✅ Created ${groups.length} groups`);

  // 4. Create Meetings (past, present, future)
  console.log("🤝 Creating meetings...");
  const meetings = [];
  const rooms = [];

  for (const client of clients) {
    const clientUsers = users.filter(
      (u) => u.clientId === client.id && u.role !== UserRole.GUEST,
    );

    // Past meetings (completed)
    for (let i = 0; i < 25; i++) {
      const creator = faker.helpers.arrayElement(clientUsers);
      const startTime = randomPastDate(90);
      const duration = randomDuration();
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      const meeting = await prisma.meeting.create({
        data: {
          title: faker.company.buzzPhrase() + " Meeting",
          description: faker.lorem.sentences(2),
          meetingType: faker.helpers.arrayElement([
            MeetingType.INSTANT,
            MeetingType.SCHEDULED,
            MeetingType.RECURRING,
          ]),
          status: MeetingStatus.ENDED,
          scheduledStartTime: startTime,
          scheduledEndTime: endTime,
          startTime: startTime,
          endTime: endTime,
          actualStartTime: startTime,
          actualEndTime: endTime,
          duration: duration,
          maxParticipants: faker.number.int({ min: 5, max: 50 }),
          isRecordingEnabled: Math.random() > 0.4,
          isWaitingRoomEnabled: Math.random() > 0.7,
          requiresApproval: Math.random() > 0.8,
          allowScreenShare: Math.random() > 0.2,
          allowChat: Math.random() > 0.1,
          isPublic: Math.random() > 0.9,
          meetingUrl: `https://meet.${client.domain || "example.com"}/room/${faker.string.alphanumeric(10)}`,
          timezone:
            client.settings &&
            typeof client.settings === "object" &&
            "timezone" in client.settings
              ? (client.settings.timezone as string)
              : "UTC",
          recurrencePattern:
            Math.random() > 0.8
              ? ({
                  frequency: "WEEKLY",
                  interval: 1,
                  daysOfWeek: ["MONDAY", "WEDNESDAY", "FRIDAY"],
                } as any)
              : null,
          createdBy: creator.id,
          clientId: client.id,
          createdAt: randomPastDate(100),
        },
      });
      meetings.push(meeting);
    }

    // Active meetings (ongoing)
    for (let i = 0; i < 3; i++) {
      const creator = faker.helpers.arrayElement(clientUsers);
      const startTime = new Date(Date.now() - Math.random() * 60 * 60 * 1000); // Started within last hour

      // Create room for active meeting
      const room = await prisma.room.create({
        data: {
          name: `Meeting Room ${i + 1}`,
          isActive: true,
          maxParticipants: faker.number.int({ min: 10, max: 50 }),
          currentParticipants: faker.number.int({ min: 2, max: 10 }),
          isLocked: Math.random() > 0.8,
          isRecording: Math.random() > 0.6,
          screenShareUserId:
            Math.random() > 0.7
              ? faker.helpers.arrayElement(clientUsers).id
              : null,
          clientId: client.id,
        },
      });
      rooms.push(room);

      const meeting = await prisma.meeting.create({
        data: {
          title: `Active ${faker.company.buzzPhrase()} Meeting`,
          description: faker.lorem.sentences(2),
          meetingType: MeetingType.INSTANT,
          status: MeetingStatus.ACTIVE,
          roomId: room.id,
          scheduledStartTime: startTime,
          startTime: startTime,
          actualStartTime: startTime,
          maxParticipants: room.maxParticipants,
          isRecordingEnabled: room.isRecording,
          isWaitingRoomEnabled: Math.random() > 0.6,
          allowScreenShare: true,
          allowChat: true,
          meetingUrl: `https://meet.${client.domain || "example.com"}/room/${faker.string.alphanumeric(10)}`,
          timezone:
            client.settings &&
            typeof client.settings === "object" &&
            "timezone" in client.settings
              ? (client.settings.timezone as string)
              : "UTC",
          createdBy: creator.id,
          clientId: client.id,
        },
      });
      meetings.push(meeting);
    }

    // Scheduled future meetings
    for (let i = 0; i < 15; i++) {
      const creator = faker.helpers.arrayElement(clientUsers);
      const startTime = randomFutureDate(30);
      const duration = randomDuration();
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      const meeting = await prisma.meeting.create({
        data: {
          title: `Upcoming ${faker.company.buzzPhrase()} Meeting`,
          description: faker.lorem.sentences(2),
          meetingType: MeetingType.SCHEDULED,
          status: MeetingStatus.SCHEDULED,
          scheduledStartTime: startTime,
          scheduledEndTime: endTime,
          duration: duration,
          maxParticipants: faker.number.int({ min: 5, max: 30 }),
          isRecordingEnabled: Math.random() > 0.5,
          isWaitingRoomEnabled: Math.random() > 0.6,
          requiresApproval: Math.random() > 0.7,
          allowScreenShare: Math.random() > 0.3,
          allowChat: Math.random() > 0.2,
          isPublic: Math.random() > 0.9,
          meetingPassword:
            Math.random() > 0.7 ? faker.internet.password() : null,
          meetingUrl: `https://meet.${client.domain || "example.com"}/room/${faker.string.alphanumeric(10)}`,
          timezone:
            client.settings &&
            typeof client.settings === "object" &&
            "timezone" in client.settings
              ? (client.settings.timezone as string)
              : "UTC",
          createdBy: creator.id,
          clientId: client.id,
        },
      });
      meetings.push(meeting);
    }
  }

  console.log(
    `✅ Created ${meetings.length} meetings and ${rooms.length} active rooms`,
  );

  // 5. Create Meeting Participants
  console.log("👥 Creating meeting participants...");
  let participantCount = 0;

  for (const meeting of meetings) {
    const clientUsers = users.filter((u) => u.clientId === meeting.clientId);
    const participantsCount = faker.number.int({
      min: 2,
      max: Math.min(10, meeting.maxParticipants),
    });
    const selectedParticipants = faker.helpers.arrayElements(
      clientUsers,
      participantsCount,
    );

    for (const participant of selectedParticipants) {
      const joinedAt = meeting.actualStartTime
        ? new Date(
            meeting.actualStartTime.getTime() + Math.random() * 10 * 60 * 1000,
          )
        : null;
      const leftAt =
        meeting.status === MeetingStatus.ENDED && joinedAt
          ? new Date(
              joinedAt.getTime() +
                Math.random() * (meeting.duration || 60) * 60 * 1000,
            )
          : null;

      await prisma.meetingParticipant.create({
        data: {
          userId: participant.id,
          meetingId: meeting.id,
          roomId: meeting.roomId,
          isPresent: meeting.status === MeetingStatus.ACTIVE,
          joinedAt: joinedAt,
          leftAt: leftAt,
          duration:
            leftAt && joinedAt
              ? Math.floor(
                  (leftAt.getTime() - joinedAt.getTime()) / (1000 * 60),
                )
              : null,
          isAudioMuted: Math.random() > 0.6,
          isVideoMuted: Math.random() > 0.5,
          isScreenSharing: Math.random() > 0.9,
          canShare: true,
          canChat: true,
          isModerator:
            participant.id === meeting.createdBy || Math.random() > 0.8,
          connectionQuality: faker.helpers.arrayElement([
            "poor",
            "fair",
            "good",
            "excellent",
          ]),
          lastPingAt:
            meeting.status === MeetingStatus.ACTIVE ? new Date() : null,
        },
      });
      participantCount++;
    }
  }

  console.log(`✅ Created ${participantCount} meeting participants`);

  // 6. Create Chat Messages
  console.log("💬 Creating chat messages...");
  let messageCount = 0;

  const activeMeetings = meetings.filter(
    (m) =>
      m.status === MeetingStatus.ACTIVE || m.status === MeetingStatus.ENDED,
  );
  for (const meeting of activeMeetings) {
    const participants = await prisma.meetingParticipant.findMany({
      where: { meetingId: meeting.id },
      include: { user: true },
    });

    const messageCountForMeeting = faker.number.int({ min: 5, max: 30 });

    for (let i = 0; i < messageCountForMeeting; i++) {
      const sender = faker.helpers.arrayElement(participants) as any;
      const messageTime = meeting.actualStartTime
        ? new Date(
            meeting.actualStartTime.getTime() +
              Math.random() * (meeting.duration || 60) * 60 * 1000,
          )
        : randomPastDate(1);

      await prisma.chatMessage.create({
        data: {
          content:
            Math.random() > 0.1
              ? faker.lorem.sentence()
              : faker.internet.emoji(),
          messageType:
            Math.random() > 0.9
              ? ChatMessageType.EMOJI_REACTION
              : ChatMessageType.TEXT,
          reactions:
            Math.random() > 0.7
              ? ({
                  "👍": faker.number.int({ min: 1, max: 5 }),
                  "😊": faker.number.int({ min: 1, max: 3 }),
                  "👏": faker.number.int({ min: 1, max: 4 }),
                } as any)
              : null,
          isEdited: Math.random() > 0.9,
          editedAt:
            Math.random() > 0.5
              ? new Date(messageTime.getTime() + 60000)
              : null,
          userId: sender.userId,
          meetingId: meeting.id,
          roomId: meeting.roomId,
          createdAt: messageTime,
        },
      });
      messageCount++;
    }
  }

  console.log(`✅ Created ${messageCount} chat messages`);

  // 7. Create Recordings
  console.log("🎥 Creating recordings...");
  const recordings = [];

  const recordedMeetings = meetings.filter(
    (m) => m.isRecordingEnabled && m.status === MeetingStatus.ENDED,
  );
  for (const meeting of recordedMeetings.slice(0, 15)) {
    const recording = await prisma.recording.create({
      data: {
        title: `${meeting.title} - Recording`,
        fileName: `recording_${meeting.id}_${Date.now()}.mp4`,
        filePath: `/recordings/${meeting.clientId}/${meeting.id}/`,
        fileUrl: `https://cdn.${clients.find((c) => c.id === meeting.clientId)?.domain || "example.com"}/recordings/${faker.string.alphanumeric(20)}.mp4`,
        fileSize: faker.number.int({ min: 100000000, max: 2000000000 }), // 100MB - 2GB
        duration: meeting.duration ? meeting.duration * 60 : 3600, // in seconds
        format: "mp4",
        quality: faker.helpers.arrayElement(["720p", "1080p", "480p"]),
        status: faker.helpers.arrayElement([
          RecordingStatus.COMPLETED,
          RecordingStatus.PROCESSING,
          RecordingStatus.FAILED,
        ]),
        thumbnailUrl: `https://cdn.${clients.find((c) => c.id === meeting.clientId)?.domain || "example.com"}/thumbnails/${faker.string.alphanumeric(20)}.jpg`,
        startedAt: meeting.actualStartTime!,
        endedAt: meeting.actualEndTime!,
        processedAt: Math.random() > 0.2 ? meeting.actualEndTime! : null,
        isPublic: Math.random() > 0.8,
        password: Math.random() > 0.7 ? faker.internet.password() : null,
        downloadCount: faker.number.int({ min: 0, max: 50 }),
        viewCount: faker.number.int({ min: 0, max: 200 }),
        meetingId: meeting.id,
        ownerId: meeting.createdBy,
        clientId: meeting.clientId,
      },
    });
    recordings.push(recording);
  }

  console.log(`✅ Created ${recordings.length} recordings`);

  // 8. Create Invitations
  console.log("📨 Creating invitations...");
  let invitationCount = 0;

  for (const client of clients) {
    const clientUsers = users.filter(
      (u) =>
        u.clientId === client.id && ["ADMIN", "SUPER_ADMIN"].includes(u.role),
    );
    const clientGroups = groups.filter((g) => g.clientId === client.id);

    // User invitations
    for (let i = 0; i < 10; i++) {
      const sender = faker.helpers.arrayElement(clientUsers);
      const status = faker.helpers.arrayElement([
        InvitationStatus.PENDING,
        InvitationStatus.ACCEPTED,
        InvitationStatus.EXPIRED,
      ]);

      await prisma.invitation.create({
        data: {
          email: faker.internet.email().toLowerCase(),
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          invitationType: InvitationType.USER,
          status: status,
          token: faker.string.alphanumeric(32),
          expiresAt:
            status === InvitationStatus.EXPIRED
              ? randomPastDate(5)
              : randomFutureDate(7),
          acceptedAt:
            status === InvitationStatus.ACCEPTED ? randomPastDate(10) : null,
          customMessage: Math.random() > 0.5 ? faker.lorem.sentence() : null,
          senderId: sender.id,
          clientId: client.id,
          createdAt: randomPastDate(30),
        },
      });
      invitationCount++;
    }

    // Meeting invitations
    const futureMeetings = meetings.filter(
      (m) => m.clientId === client.id && m.status === MeetingStatus.SCHEDULED,
    );
    for (const meeting of futureMeetings.slice(0, 5)) {
      for (let i = 0; i < 3; i++) {
        await prisma.invitation.create({
          data: {
            email: faker.internet.email().toLowerCase(),
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            invitationType: InvitationType.USER,
            status: faker.helpers.arrayElement([
              InvitationStatus.PENDING,
              InvitationStatus.ACCEPTED,
            ]),
            token: faker.string.alphanumeric(32),
            expiresAt: meeting.scheduledStartTime!,
            meetingId: meeting.id,
            meetingRole: faker.helpers.arrayElement([
              "participant",
              "moderator",
            ]),
            customMessage: `You're invited to join: ${meeting.title}`,
            senderId: meeting.createdBy,
            clientId: client.id,
          },
        });
        invitationCount++;
      }
    }

    // Group invitations
    for (const group of clientGroups.slice(0, 3)) {
      const groupAdmin = await prisma.groupMember.findFirst({
        where: { groupId: group.id, role: "admin" },
        include: { user: true },
      });

      if (groupAdmin) {
        await prisma.invitation.create({
          data: {
            email: faker.internet.email().toLowerCase(),
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            invitationType: InvitationType.GROUP,
            status: InvitationStatus.PENDING,
            token: faker.string.alphanumeric(32),
            expiresAt: randomFutureDate(14),
            groupId: group.id,
            groupRole: "member",
            customMessage: `You're invited to join the ${group.name} group`,
            senderId: groupAdmin.userId,
            clientId: client.id,
          },
        });
        invitationCount++;
      }
    }
  }

  console.log(`✅ Created ${invitationCount} invitations`);

  // 9. Create Notifications
  console.log("🔔 Creating notifications...");
  let notificationCount = 0;

  for (const user of users.slice(0, 50)) {
    // Limit to prevent too many notifications
    const notificationTypes = Object.values(NotificationType);
    const userMeetings = meetings.filter((m) => m.clientId === user.clientId);

    for (let i = 0; i < faker.number.int({ min: 3, max: 15 }); i++) {
      const notificationType = faker.helpers.arrayElement(notificationTypes);
      const relatedMeeting = faker.helpers.arrayElement(userMeetings);
      const isRead = Math.random() > 0.4;
      const createdAt = randomPastDate(14);

      await prisma.notification.create({
        data: {
          title: getNotificationTitle(notificationType),
          message: getNotificationMessage(
            notificationType,
            relatedMeeting.title,
          ),
          notificationType: notificationType,
          isRead: isRead,
          readAt: isRead
            ? new Date(
                createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000,
              )
            : null,
          relatedEntityId: relatedMeeting.id,
          relatedEntityType: "meeting",
          actionUrl: `/meeting/${relatedMeeting.id}`,
          actionData: {
            meetingId: relatedMeeting.id,
            meetingTitle: relatedMeeting.title,
          },
          userId: user.id,
          createdAt: createdAt,
        },
      });
      notificationCount++;
    }
  }

  console.log(`✅ Created ${notificationCount} notifications`);

  // 10. Create Analytics Data
  console.log("📊 Creating analytics data...");

  // User Analytics
  let userAnalyticsCount = 0;
  const analyticsUsers = users
    .filter((u) => u.role !== UserRole.GUEST)
    .slice(0, 30);

  for (const user of analyticsUsers) {
    // Generate daily analytics for last 30 days
    for (let day = 0; day < 30; day++) {
      const date = new Date();
      date.setDate(date.getDate() - day);

      await prisma.userAnalytics.create({
        data: {
          date: date,
          period: "daily",
          meetingsCreated: faker.number.int({ min: 0, max: 3 }),
          meetingsJoined: faker.number.int({ min: 0, max: 8 }),
          totalMeetingDuration: faker.number.int({ min: 0, max: 480 }),
          messagesSet: faker.number.int({ min: 0, max: 50 }),
          screenSharesCount: faker.number.int({ min: 0, max: 5 }),
          averageJoinTime: faker.number.int({ min: 30, max: 300 }),
          connectionQualityAvg: faker.helpers.arrayElement([
            "poor",
            "fair",
            "good",
            "excellent",
          ]),
          userId: user.id,
          clientId: user.clientId,
        },
      });
      userAnalyticsCount++;
    }
  }

  // Meeting Analytics
  let meetingAnalyticsCount = 0;
  const endedMeetings = meetings.filter(
    (m) => m.status === MeetingStatus.ENDED,
  );

  for (const meeting of endedMeetings) {
    const participants = await prisma.meetingParticipant.count({
      where: { meetingId: meeting.id },
    });

    await prisma.meetingAnalytics.create({
      data: {
        actualDuration:
          meeting.duration || faker.number.int({ min: 15, max: 180 }),
        maxConcurrentUsers: faker.number.int({
          min: participants,
          max: Math.max(participants + 5, meeting.maxParticipants),
        }),
        totalParticipants: participants,
        totalMessages: faker.number.int({ min: 0, max: 100 }),
        screenSharesCount: faker.number.int({ min: 0, max: 8 }),
        recordingDuration: meeting.isRecordingEnabled ? meeting.duration : null,
        averageConnectionQuality: faker.helpers.arrayElement([
          "poor",
          "fair",
          "good",
          "excellent",
        ]),
        dropoutRate: faker.number.float({
          min: 0,
          max: 0.3,
          fractionDigits: 2,
        }),
        averageParticipationTime: faker.number.int({
          min: 10,
          max: meeting.duration || 60,
        }),
        peakParticipants: faker.number.int({
          min: participants,
          max: Math.max(participants + 2, meeting.maxParticipants),
        }),
        bandwidthUsed: faker.number.int({ min: 50, max: 2000 }),
        serverLoad: faker.number.float({
          min: 0.1,
          max: 0.9,
          fractionDigits: 2,
        }),
        meetingId: meeting.id,
      },
    });
    meetingAnalyticsCount++;
  }

  console.log(
    `✅ Created ${userAnalyticsCount} user analytics and ${meetingAnalyticsCount} meeting analytics`,
  );

  // 11. Create Email Logs
  console.log("📧 Creating email logs...");
  let emailCount = 0;

  for (const client of clients) {
    const clientUsers = users.filter((u) => u.clientId === client.id);
    const templates = [
      "invitation",
      "welcome",
      "password-reset",
      "meeting-reminder",
      "meeting-summary",
    ];

    for (let i = 0; i < 50; i++) {
      const template = faker.helpers.arrayElement(templates);
      const recipient = faker.helpers.arrayElement(clientUsers);
      const status = faker.helpers.arrayElement([
        EmailStatus.SENT,
        EmailStatus.PENDING,
        EmailStatus.FAILED,
        EmailStatus.BOUNCED,
      ]);
      const sentAt = status === EmailStatus.SENT ? randomPastDate(30) : null;

      await prisma.emailLog.create({
        data: {
          to: JSON.stringify([recipient.email]),
          cc:
            Math.random() > 0.8
              ? JSON.stringify([faker.internet.email()])
              : null,
          subject: getEmailSubject(template),
          template: template,
          status: status,
          sentAt: sentAt,
          failedAt: status === EmailStatus.FAILED ? randomPastDate(30) : null,
          errorMessage:
            status === EmailStatus.FAILED ? "SMTP connection failed" : null,
          messageId:
            status === EmailStatus.SENT ? faker.string.alphanumeric(20) : null,
          clientId: client.id,
          userId: Math.random() > 0.3 ? recipient.id : null,
          metadata: JSON.stringify({
            campaign: template,
            version: "v1.0",
            priority: Math.random() > 0.8 ? "high" : "normal",
          }),
          tags: JSON.stringify([template, client.name.toLowerCase()]),
          createdAt: randomPastDate(30),
        },
      });
      emailCount++;
    }
  }

  console.log(`✅ Created ${emailCount} email logs`);

  // 12. Create Files
  console.log("📁 Creating files...");
  let fileCount = 0;

  for (const client of clients) {
    const clientUsers = users.filter((u) => u.clientId === client.id);
    const clientMeetings = meetings.filter((m) => m.clientId === client.id);

    for (let i = 0; i < 30; i++) {
      const uploader = faker.helpers.arrayElement(clientUsers);
      const meeting =
        Math.random() > 0.5 ? faker.helpers.arrayElement(clientMeetings) : null;
      const category = faker.helpers.arrayElement([
        "chat",
        "meeting",
        "profile",
        "document",
        "presentation",
        "general",
      ]);
      const extension = faker.helpers.arrayElement([
        "pdf",
        "docx",
        "pptx",
        "xlsx",
        "png",
        "jpg",
        "mp4",
        "txt",
      ]);

      await prisma.file.create({
        data: {
          fileName: `${faker.system.fileName({ extensionCount: 0 })}.${extension}`,
          originalName: `${faker.lorem.words(2)}.${extension}`,
          mimeType: getMimeType(extension),
          fileSize: BigInt(faker.number.int({ min: 1024, max: 50000000 })), // 1KB - 50MB
          filePath: `/uploads/${client.id}/${faker.string.alphanumeric(20)}/`,
          fileUrl: `https://cdn.${client.domain || "example.com"}/files/${faker.string.alphanumeric(32)}.${extension}`,
          category: category,
          isPublic: Math.random() > 0.7,
          downloadCount: faker.number.int({ min: 0, max: 100 }),
          viewCount: faker.number.int({ min: 0, max: 500 }),
          uploadedBy: uploader.id,
          clientId: client.id,
          meetingId: meeting?.id,
          createdAt: randomPastDate(60),
        },
      });
      fileCount++;
    }
  }

  console.log(`✅ Created ${fileCount} files`);

  // 13. Create Meeting Reactions and Interactions
  console.log("🎭 Creating meeting reactions and interactions...");
  let reactionCount = 0;
  let interactionCount = 0;

  const activeMeetingsWithParticipants = meetings.filter(
    (m) =>
      m.status === MeetingStatus.ACTIVE || m.status === MeetingStatus.ENDED,
  );

  for (const meeting of activeMeetingsWithParticipants.slice(0, 20)) {
    const participants = await prisma.meetingParticipant.findMany({
      where: { meetingId: meeting.id },
    });

    // Create reactions
    for (const participant of participants) {
      if (Math.random() > 0.6) {
        const reactionTime = meeting.actualStartTime
          ? new Date(
              meeting.actualStartTime.getTime() +
                Math.random() * (meeting.duration || 60) * 60 * 1000,
            )
          : randomPastDate(1);

        await prisma.meetingReaction.create({
          data: {
            meetingId: meeting.id,
            userId: participant.userId,
            emoji: faker.helpers.arrayElement([
              "👍",
              "👏",
              "😊",
              "❤️",
              "🎉",
              "👋",
              "🤔",
              "😮",
            ]),
            timestamp: reactionTime,
          },
        });
        reactionCount++;
      }

      // Create interactions
      const interactionTypes = Object.values(InteractionType);
      for (let i = 0; i < faker.number.int({ min: 1, max: 5 }); i++) {
        const interactionTime = meeting.actualStartTime
          ? new Date(
              meeting.actualStartTime.getTime() +
                Math.random() * (meeting.duration || 60) * 60 * 1000,
            )
          : randomPastDate(1);

        const interactionType = faker.helpers.arrayElement(interactionTypes);

        await prisma.meetingInteraction.create({
          data: {
            meetingId: meeting.id,
            userId: participant.userId,
            type: interactionType,
            data: getInteractionData(interactionType),
            timestamp: interactionTime,
          },
        });
        interactionCount++;
      }
    }
  }

  console.log(
    `✅ Created ${reactionCount} reactions and ${interactionCount} interactions`,
  );

  console.log(`
🎉 Database seeding completed successfully!

📊 Summary:
├── ${clients.length} Clients
├── ${users.length} Users
├── ${groups.length} Groups
├── ${meetings.length} Meetings
├── ${rooms.length} Active Rooms
├── ${participantCount} Meeting Participants
├── ${messageCount} Chat Messages
├── ${recordings.length} Recordings
├── ${invitationCount} Invitations
├── ${notificationCount} Notifications
├── ${userAnalyticsCount} User Analytics Records
├── ${meetingAnalyticsCount} Meeting Analytics Records
├── ${emailCount} Email Logs
├── ${fileCount} Files
├── ${reactionCount} Meeting Reactions
└── ${interactionCount} Meeting Interactions

🔑 Test Accounts:
├── Super Admin: superadmin@quibic.com / password123
├── Admin: admin@quibic.com / password123
├── Admin: admin@techstart.io / password123
└── Admin: admin@demo.example.com / password123

All user passwords: password123
`);
}

// Helper functions
function getNotificationTitle(type: NotificationType): string {
  switch (type) {
    case NotificationType.MEETING_INVITATION:
      return "Meeting Invitation";
    case NotificationType.MEETING_REMINDER:
      return "Meeting Reminder";
    case NotificationType.MEETING_STARTED:
      return "Meeting Started";
    case NotificationType.MEETING_ENDED:
      return "Meeting Ended";
    case NotificationType.USER_JOINED:
      return "User Joined";
    case NotificationType.USER_LEFT:
      return "User Left";
    case NotificationType.CHAT_MESSAGE:
      return "New Message";
    case NotificationType.SYSTEM_ALERT:
      return "System Alert";
    default:
      return "Notification";
  }
}

function getNotificationMessage(
  type: NotificationType,
  meetingTitle: string,
): string {
  switch (type) {
    case NotificationType.MEETING_INVITATION:
      return `You've been invited to ${meetingTitle}`;
    case NotificationType.MEETING_REMINDER:
      return `${meetingTitle} starts in 15 minutes`;
    case NotificationType.MEETING_STARTED:
      return `${meetingTitle} has started`;
    case NotificationType.MEETING_ENDED:
      return `${meetingTitle} has ended`;
    case NotificationType.USER_JOINED:
      return `A user joined ${meetingTitle}`;
    case NotificationType.USER_LEFT:
      return `A user left ${meetingTitle}`;
    case NotificationType.CHAT_MESSAGE:
      return `New message in ${meetingTitle}`;
    case NotificationType.SYSTEM_ALERT:
      return "System maintenance scheduled";
    default:
      return "You have a new notification";
  }
}

function getEmailSubject(template: string): string {
  switch (template) {
    case "invitation":
      return "You're invited to join our platform";
    case "welcome":
      return "Welcome to the Video Conference Platform";
    case "password-reset":
      return "Reset your password";
    case "meeting-reminder":
      return "Meeting reminder - Starting soon";
    case "meeting-summary":
      return "Meeting summary and recording";
    default:
      return "Important notification";
  }
}

function getMimeType(extension: string): string {
  const mimeTypes: { [key: string]: string } = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    png: "image/png",
    jpg: "image/jpeg",
    mp4: "video/mp4",
    txt: "text/plain",
  };
  return mimeTypes[extension] || "application/octet-stream";
}

function getInteractionData(type: InteractionType): any {
  switch (type) {
    case InteractionType.HAND_RAISED:
      return {
        reason: "question",
        priority: faker.helpers.arrayElement(["low", "medium", "high"]),
      };
    case InteractionType.STATUS_CHANGED:
      return {
        oldStatus: faker.helpers.arrayElement(["available", "busy", "away"]),
        newStatus: faker.helpers.arrayElement(["available", "busy", "away"]),
      };
    case InteractionType.PERMISSION_REQUESTED:
      return {
        permissionType: faker.helpers.arrayElement([
          "video",
          "audio",
          "screenShare",
        ]),
        reason: "needed for presentation",
      };
    case InteractionType.PERMISSION_GRANTED:
      return {
        permissionType: faker.helpers.arrayElement([
          "video",
          "audio",
          "screenShare",
        ]),
      };
    case InteractionType.PERMISSION_DENIED:
      return {
        permissionType: faker.helpers.arrayElement([
          "video",
          "audio",
          "screenShare",
        ]),
        reason: "security policy",
      };
    default:
      return {};
  }
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
