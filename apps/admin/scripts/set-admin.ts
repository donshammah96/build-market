import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClerkClient } from "@clerk/backend";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function setAdminRole(userId: string) {
  const { adminEnvConfig } = await import("../src/lib/infrastructure/env");

  const clerkClient = createClerkClient({
    ...(adminEnvConfig.CLERK_SECRET_KEY
      ? { secretKey: adminEnvConfig.CLERK_SECRET_KEY }
      : {}),
  });

  try {
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        role: "super_admin",
      },
    });
    console.log(`User ${userId} promoted to Super Admin.`);
  } catch (error) {
    console.error("Failed to update user:", error);
  }
}

// Replace with the actual User ID from Clerk Dashboard
const TARGET_USER_ID = "user_123.........";

void setAdminRole(TARGET_USER_ID);
