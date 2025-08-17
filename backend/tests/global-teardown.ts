import { FullConfig } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...');
  
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    
    // Clean up test data
    await cleanupTestData(prisma);
    
    console.log('✅ Test cleanup completed');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanupTestData(prisma: PrismaClient) {
  console.log('🗑️ Final cleanup of test data...');
  
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
  
  console.log('✅ All test data cleaned up');
}

export default globalTeardown;