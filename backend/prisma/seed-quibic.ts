import {
  PrismaClient,
  UserRole,
  MeetingType,
  MeetingStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Quibic Gen organization seeding...");

  // Create Quibic Gen client
  const quibicClient = await prisma.client.upsert({
    where: { domain: "quibic-gen.com" },
    update: {},
    create: {
      name: "Quibic Gen",
      domain: "quibic-gen.com",
      maxUsers: 500,
      maxMeetingDuration: 720, // 12 hours
      storageQuota: 50000, // 50GB
      settings: {
        allowGuestUsers: false,
        defaultMeetingDuration: 90,
        enableRecording: true,
        enableScreenShare: true,
        enableChat: true,
        maxParticipantsPerMeeting: 100,
        requireEmailVerification: true,
        enableWaitingRoom: true,
        enableBreakoutRooms: true,
      },
      features: {
        analytics: true,
        recording: true,
        screenShare: true,
        chat: true,
        breakoutRooms: true,
        whiteboard: true,
        transcription: true,
        aiSummary: true,
      },
    },
  });

  console.log(`✅ Created Quibic Gen client: ${quibicClient.name}`);

  // Admin users data with stronger passwords
  const adminUsers = [
    {
      email: "admin@quibic-gen.com",
      firstName: "Alex",
      lastName: "Rodriguez",
      displayName: "Alex Rodriguez",
      role: UserRole.ADMIN,
      password: "QuibicAdmin2024!@#",
    },
    {
      email: "manager@quibic-gen.com",
      firstName: "Sarah",
      lastName: "Johnson",
      displayName: "Sarah Johnson",
      role: UserRole.ADMIN,
      password: "QuibicMgr2024$%^",
    },
  ];

  // Regular users data
  const regularUsers = [
    {
      email: "john.smith@quibic-gen.com",
      firstName: "John",
      lastName: "Smith",
      displayName: "John Smith",
      role: UserRole.USER,
      password: "QuibicUser01!",
      department: "Engineering",
    },
    {
      email: "emily.davis@quibic-gen.com",
      firstName: "Emily",
      lastName: "Davis",
      displayName: "Emily Davis",
      role: UserRole.USER,
      password: "QuibicUser02@",
      department: "Design",
    },
    {
      email: "michael.brown@quibic-gen.com",
      firstName: "Michael",
      lastName: "Brown",
      displayName: "Michael Brown",
      role: UserRole.USER,
      password: "QuibicUser03#",
      department: "Marketing",
    },
    {
      email: "jessica.wilson@quibic-gen.com",
      firstName: "Jessica",
      lastName: "Wilson",
      displayName: "Jessica Wilson",
      role: UserRole.USER,
      password: "QuibicUser04$",
      department: "Sales",
    },
    {
      email: "david.miller@quibic-gen.com",
      firstName: "David",
      lastName: "Miller",
      displayName: "David Miller",
      role: UserRole.USER,
      password: "QuibicUser05%",
      department: "Engineering",
    },
    {
      email: "lisa.anderson@quibic-gen.com",
      firstName: "Lisa",
      lastName: "Anderson",
      displayName: "Lisa Anderson",
      role: UserRole.USER,
      password: "QuibicUser06^",
      department: "HR",
    },
    {
      email: "robert.taylor@quibic-gen.com",
      firstName: "Robert",
      lastName: "Taylor",
      displayName: "Robert Taylor",
      role: UserRole.USER,
      password: "QuibicUser07&",
      department: "Finance",
    },
    {
      email: "maria.garcia@quibic-gen.com",
      firstName: "Maria",
      lastName: "Garcia",
      displayName: "Maria Garcia",
      role: UserRole.USER,
      password: "QuibicUser08*",
      department: "Operations",
    },
    {
      email: "james.white@quibic-gen.com",
      firstName: "James",
      lastName: "White",
      displayName: "James White",
      role: UserRole.USER,
      password: "QuibicUser09(",
      department: "Support",
    },
    {
      email: "amanda.lee@quibic-gen.com",
      firstName: "Amanda",
      lastName: "Lee",
      displayName: "Amanda Lee",
      role: UserRole.USER,
      password: "QuibicUser10)",
      department: "Quality Assurance",
    },
  ];

  // Create admin users
  console.log("👑 Creating admin users...");
  for (const userData of adminUsers) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        displayName: userData.displayName,
        role: userData.role,
        isActive: true,
        isEmailVerified: true,
        passwordHash: hashedPassword,
        clientId: quibicClient.id,
        timezone: "America/New_York",
        locale: "en",
        preferences: {
          theme: "system",
          language: "en",
          notifications: {
            email: true,
            push: true,
            meeting_reminders: true,
            chat_messages: true,
            system_alerts: true,
          },
          meeting: {
            auto_join_audio: true,
            auto_join_video: false,
            default_mute_state: false,
            enable_noise_cancellation: true,
            preferred_quality: "high",
          },
          security: {
            two_factor_enabled: false,
            session_timeout: 480, // 8 hours
          },
        },
      },
    });

    console.log(`✅ Created admin user: ${user.email}`);
  }

  // Create regular users
  console.log("👥 Creating regular users...");
  for (const userData of regularUsers) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        displayName: userData.displayName,
        role: userData.role,
        isActive: true,
        isEmailVerified: true,
        passwordHash: hashedPassword,
        clientId: quibicClient.id,
        timezone: "America/New_York",
        locale: "en",
        preferences: {
          theme: "light",
          language: "en",
          department: userData.department,
          notifications: {
            email: true,
            push: false,
            meeting_reminders: true,
            chat_messages: true,
            system_alerts: false,
          },
          meeting: {
            auto_join_audio: true,
            auto_join_video: true,
            default_mute_state: false,
            enable_noise_cancellation: false,
            preferred_quality: "medium",
          },
          security: {
            two_factor_enabled: false,
            session_timeout: 240, // 4 hours
          },
        },
      },
    });

    console.log(`✅ Created user: ${user.email} (${userData.department})`);
  }

  // Create department groups
  const departments = [
    "Engineering",
    "Design",
    "Marketing",
    "Sales",
    "HR",
    "Finance",
    "Operations",
    "Support",
    "Quality Assurance",
  ];

  console.log("🏢 Creating department groups...");
  for (const department of departments) {
    const group = await prisma.group.create({
      data: {
        name: `${department} Team`,
        description: `${department} department team group`,
        isActive: true,
        clientId: quibicClient.id,
        settings: {
          allowSelfJoin: false,
          defaultRole: "member",
          requireApproval: true,
          enableAutoMeetings: true,
          defaultMeetingDuration: 60,
        },
      },
    });

    console.log(`✅ Created group: ${group.name}`);

    // Add users to their respective department groups
    const departmentUsers = await prisma.user.findMany({
      where: {
        clientId: quibicClient.id,
        preferences: {
          path: ["department"],
          equals: department,
        },
      },
    });

    for (const user of departmentUsers) {
      await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: group.id,
          role: user.role === UserRole.ADMIN ? "admin" : "member",
        },
      });

      console.log(`✅ Added ${user.email} to ${group.name}`);
    }
  }

  // Create leadership group
  console.log("🎯 Creating leadership group...");
  const leadershipGroup = await prisma.group.create({
    data: {
      name: "Leadership Team",
      description: "Executive and administrative leadership team",
      isActive: true,
      clientId: quibicClient.id,
      settings: {
        allowSelfJoin: false,
        defaultRole: "member",
        requireApproval: false,
        enableAutoMeetings: true,
        defaultMeetingDuration: 90,
        isPrivate: true,
      },
    },
  });

  // Add all admins to leadership group
  const admins = await prisma.user.findMany({
    where: {
      clientId: quibicClient.id,
      role: UserRole.ADMIN,
    },
  });

  for (const admin of admins) {
    await prisma.groupMember.create({
      data: {
        userId: admin.id,
        groupId: leadershipGroup.id,
        role: "admin",
      },
    });

    console.log(`✅ Added ${admin.email} to Leadership Team`);
  }

  // Create sample meetings
  console.log("📅 Creating sample meetings...");

  const meetings = [
    {
      title: "All Hands Meeting",
      description:
        "Monthly company-wide meeting to share updates and celebrate achievements",
      meetingType: MeetingType.RECURRING,
      scheduledStartTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
      duration: 60,
      maxParticipants: 100,
      isRecordingEnabled: true,
      groupId: null, // Company-wide
    },
    {
      title: "Engineering Sprint Planning",
      description: "Bi-weekly sprint planning session for the engineering team",
      meetingType: MeetingType.RECURRING,
      scheduledStartTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
      duration: 90,
      maxParticipants: 20,
      isRecordingEnabled: true,
      department: "Engineering",
    },
    {
      title: "Leadership Strategy Session",
      description: "Monthly strategic planning session for leadership team",
      meetingType: MeetingType.SCHEDULED,
      scheduledStartTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Two weeks
      duration: 120,
      maxParticipants: 10,
      isRecordingEnabled: true,
      isPrivate: true,
    },
  ];

  const adminUser = admins[0]; // Use first admin as meeting creator

  for (const meetingData of meetings) {
    const meetingCreateData: any = {
      title: meetingData.title,
      description: meetingData.description,
      meetingType: meetingData.meetingType,
      status: MeetingStatus.SCHEDULED,
      scheduledStartTime: meetingData.scheduledStartTime,
      scheduledEndTime: new Date(
        meetingData.scheduledStartTime.getTime() +
          meetingData.duration * 60 * 1000,
      ),
      duration: meetingData.duration,
      maxParticipants: meetingData.maxParticipants,
      isRecordingEnabled: meetingData.isRecordingEnabled,
      allowScreenShare: true,
      allowChat: true,
      isPublic: !meetingData.isPrivate,
      createdBy: adminUser.id,
      clientId: quibicClient.id,
    };

    // Add recurrence pattern only for recurring meetings
    if (meetingData.meetingType === MeetingType.RECURRING) {
      meetingCreateData.recurrencePattern = {
        frequency: meetingData.title.includes("Sprint")
          ? "bi-weekly"
          : "monthly",
        interval: 1,
        daysOfWeek: ["monday"],
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      };
    }

    const meeting = await prisma.meeting.create({
      data: meetingCreateData,
    });

    console.log(`✅ Created meeting: ${meeting.title}`);

    // Add participants based on meeting type
    if (meetingData.title.includes("All Hands")) {
      // Add all users to all-hands meeting
      const allUsers = await prisma.user.findMany({
        where: { clientId: quibicClient.id },
      });

      for (const user of allUsers) {
        await prisma.meetingParticipant.create({
          data: {
            userId: user.id,
            meetingId: meeting.id,
            isModerator: user.role === UserRole.ADMIN,
            canShare: user.role === UserRole.ADMIN,
            canChat: true,
          },
        });
      }
    } else if (meetingData.title.includes("Leadership")) {
      // Add only admins to leadership meeting
      for (const admin of admins) {
        await prisma.meetingParticipant.create({
          data: {
            userId: admin.id,
            meetingId: meeting.id,
            isModerator: true,
            canShare: true,
            canChat: true,
          },
        });
      }
    } else if (meetingData.department) {
      // Add department-specific users
      const departmentUsers = await prisma.user.findMany({
        where: {
          clientId: quibicClient.id,
          preferences: {
            path: ["department"],
            equals: meetingData.department,
          },
        },
      });

      for (const user of departmentUsers) {
        await prisma.meetingParticipant.create({
          data: {
            userId: user.id,
            meetingId: meeting.id,
            isModerator: user.role === UserRole.ADMIN,
            canShare: true,
            canChat: true,
          },
        });
      }
    }
  }

  console.log("🎉 Quibic Gen organization seeding completed successfully!");

  // Print summary
  console.log("\n📊 Seeding Summary:");
  console.log(`• Organization: ${quibicClient.name} (${quibicClient.domain})`);
  console.log(`• Admin Users: ${adminUsers.length}`);
  console.log(`• Regular Users: ${regularUsers.length}`);
  console.log(`• Total Users: ${adminUsers.length + regularUsers.length}`);
  console.log(`• Department Groups: ${departments.length}`);
  console.log(`• Meetings Created: ${meetings.length}`);
  console.log("\n🔑 Password file will be generated separately");
  console.log("\n🚀 Quibic Gen organization is ready!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Quibic Gen seeding failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
