import { chromium, FullConfig } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup...');
  
  // Initialize database connection
  const prisma = new PrismaClient();
  
  try {
    // Ensure database is accessible
    await prisma.$connect();
    console.log('✅ Database connection established');
    
    // Clean up any existing test data
    await cleanupTestData(prisma);
    
    // Seed test data
    await seedTestData(prisma);
    
    console.log('✅ Test database prepared');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanupTestData(prisma: PrismaClient) {
  console.log('🧹 Cleaning up existing test data...');
  
  // Delete test data in dependency order
  await prisma.meetingParticipant.deleteMany({
    where: {
      user: {
        email: { contains: '@test.e2e' }
      }
    }
  });
  
  await prisma.meeting.deleteMany({
    where: {
      organizer: {
        email: { contains: '@test.e2e' }
      }
    }
  });
  
  await prisma.room.deleteMany({
    where: {
      name: { contains: 'E2E Test' }
    }
  });
  
  await prisma.user.deleteMany({
    where: {
      email: { contains: '@test.e2e' }
    }
  });
  
  await prisma.client.deleteMany({
    where: {
      name: { contains: 'E2E Test' }
    }
  });
}

async function seedTestData(prisma: PrismaClient) {
  console.log('🌱 Seeding test data...');
  
  // Create test client
  const testClient = await prisma.client.create({
    data: {
      name: 'E2E Test Client',
      domain: 'localhost',
      features: {
        chat: true,
        recording: true,
        screenShare: true,
        analytics: true,
        whiteboard: false,
        breakoutRooms: false
      }
    }
  });
  
  // Create test users
  const testUsers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'testuser1@test.e2e',
        firstName: 'Test',
        lastName: 'User1',
        displayName: 'Test User 1',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
        clientId: testClient.id,
        role: 'user'
      }
    }),
    prisma.user.create({
      data: {
        email: 'testuser2@test.e2e',
        firstName: 'Test',
        lastName: 'User2',
        displayName: 'Test User 2',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
        clientId: testClient.id,
        role: 'user'
      }
    }),
    prisma.user.create({
      data: {
        email: 'testadmin@test.e2e',
        firstName: 'Test',
        lastName: 'Admin',
        displayName: 'Test Admin',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
        clientId: testClient.id,
        role: 'admin'
      }
    })
  ]);
  
  // Create test room
  await prisma.room.create({
    data: {
      name: 'E2E Test Room',
      maxParticipants: 10,
      clientId: testClient.id,
      isActive: true
    }
  });
  
  console.log(`✅ Created test client: ${testClient.id}`);
  console.log(`✅ Created ${testUsers.length} test users`);
  console.log('✅ Test data seeding completed');
}

export default globalSetup;