// scripts/set-admin.ts
import { createClerkClient } from '@clerk/backend';

const clerkClient = createClerkClient({ 
  secretKey: process.env.CLERK_SECRET_KEY 
});

async function setAdminRole(userId: string) {
  try {
    await clerkClient.users.updateUser(userId, {
      publicMetadata: {
        role: 'admin',
      },
    });
    console.log(`User ${userId} promoted to Admin.`);
  } catch (error) {
    console.error('Failed to update user:', error);
  }
}

// Replace with the actual User ID from Clerk Dashboard
const TARGET_USER_ID = 'user_2p...'; 

setAdminRole(TARGET_USER_ID);