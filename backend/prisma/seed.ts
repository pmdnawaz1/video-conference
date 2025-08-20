import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Create default client
  const defaultClient = await prisma.client.upsert({
    where: { domain: "localhost" },
    update: {},
    create: {
      name: "Video Conference Platform",
      domain: "localhost",
      maxUsers: 1000,
      maxMeetingDuration: 480, // 8 hours
      storageQuota: 10000, // 10GB
      settings: {
        allowGuestUsers: true,
        defaultMeetingDuration: 60,
        enableRecording: true,
        enableScreenShare: true,
        enableChat: true,
        maxParticipantsPerMeeting: 50,
      },
      features: {
        analytics: true,
        recording: true,
        screenShare: true,
        chat: true,
        breakoutRooms: false,
        whiteboard: false,
      },
    },
  });

  console.log(`✅ Created default client: ${defaultClient.name}`);

  // Create super admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@videoconf.local" },
    update: {},
    create: {
      email: "admin@videoconf.local",
      firstName: "Super",
      lastName: "Admin",
      displayName: "Super Admin",
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
      passwordHash: hashedPassword,
      clientId: defaultClient.id,
      preferences: {
        theme: "system",
        language: "en",
        notifications: {
          email: true,
          push: true,
          meeting_reminders: true,
          chat_messages: false,
        },
        meeting: {
          auto_join_audio: true,
          auto_join_video: false,
          default_mute_state: false,
        },
      },
    },
  });

  console.log(`✅ Created super admin user: ${superAdmin.email}`);

  // Create demo regular users
  const demoUsers = [
    {
      email: "john.doe@videoconf.local",
      firstName: "John",
      lastName: "Doe",
      displayName: "John Doe",
      role: UserRole.USER,
    },
    {
      email: "jane.smith@videoconf.local",
      firstName: "Jane",
      lastName: "Smith",
      displayName: "Jane Smith",
      role: UserRole.USER,
    },
    {
      email: "moderator@videoconf.local",
      firstName: "Demo",
      lastName: "Moderator",
      displayName: "Demo Moderator",
      role: UserRole.ADMIN,
    },
  ];

  for (const userData of demoUsers) {
    const demoPassword = await bcrypt.hash("demo123", 12);
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        isActive: true,
        isEmailVerified: true,
        passwordHash: demoPassword,
        clientId: defaultClient.id,
        preferences: {
          theme: "light",
          language: "en",
          notifications: {
            email: true,
            push: false,
            meeting_reminders: true,
            chat_messages: true,
          },
          meeting: {
            auto_join_audio: true,
            auto_join_video: true,
            default_mute_state: false,
          },
        },
      },
    });

    console.log(`✅ Created demo user: ${user.email}`);
  }

  // Create demo group
  const demoGroup = await prisma.group.upsert({
    where: { id: "demo-group" },
    update: {},
    create: {
      id: "demo-group",
      name: "Demo Team",
      description: "Default demo group for testing",
      isActive: true,
      clientId: defaultClient.id,
      settings: {
        allowSelfJoin: false,
        defaultRole: "member",
        requireApproval: false,
      },
    },
  });

  console.log(`✅ Created demo group: ${demoGroup.name}`);

  // Add users to demo group
  const users = await prisma.user.findMany({
    where: {
      clientId: defaultClient.id,
      role: { not: UserRole.SUPER_ADMIN },
    },
  });

  for (const user of users) {
    await prisma.groupMember.upsert({
      where: {
        userId_groupId: {
          userId: user.id,
          groupId: demoGroup.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        groupId: demoGroup.id,
        role: user.role === UserRole.ADMIN ? "admin" : "member",
      },
    });

    console.log(`✅ Added ${user.email} to demo group`);
  }

  // Create a demo scheduled meeting
  const demoMeeting = await prisma.meeting.create({
    data: {
      title: "Weekly Team Standup",
      description: "Regular team sync meeting to discuss progress and blockers",
      meetingType: "RECURRING",
      status: "SCHEDULED",
      scheduledStartTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      scheduledEndTime: new Date(
        Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
      ), // Tomorrow + 30min
      maxParticipants: 10,
      isRecordingEnabled: true,
      allowScreenShare: true,
      allowChat: true,
      createdBy: superAdmin.id,
      clientId: defaultClient.id,
      recurrencePattern: {
        frequency: "weekly",
        interval: 1,
        daysOfWeek: ["monday"],
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      },
    },
  });

  console.log(`✅ Created demo meeting: ${demoMeeting.title}`);

  // Add participants to the meeting
  for (const user of users.slice(0, 3)) {
    // Add first 3 users
    await prisma.meetingParticipant.create({
      data: {
        userId: user.id,
        meetingId: demoMeeting.id,
        isModerator: user.role === UserRole.ADMIN,
        canShare: true,
        canChat: true,
      },
    });

    console.log(`✅ Added ${user.email} as participant to demo meeting`);
  }

  console.log("🎉 Database seeding completed successfully!");

  // Print summary
  console.log("\n📊 Seeding Summary:");
  console.log(`• Client: ${defaultClient.name} (${defaultClient.domain})`);
  console.log(`• Super Admin: ${superAdmin.email} (password: admin123)`);
  console.log(`• Demo Users: ${demoUsers.length} (password: demo123)`);
  console.log(`• Demo Group: ${demoGroup.name}`);
  console.log(`• Demo Meeting: ${demoMeeting.title}`);
  console.log("\n🚀 You can now start the application!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seeding failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
