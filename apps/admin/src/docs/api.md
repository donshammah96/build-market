# Admin API Documentation

> **Generated:** 2025-12-12  
> **Version:** 1.0.0

This document provides comprehensive API documentation for all server actions in the BuildMarket Admin Dashboard.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Dashboard Actions](#dashboard-actions)
5. [User Management](#user-management)
6. [Professional Management](#professional-management)
7. [Project Management](#project-management)
8. [System Settings](#system-settings)

---

## Overview

All admin actions are located in `src/actions/admin.ts` and use the `"use server"` directive for Next.js Server Actions.

### Key Patterns

- **`safeAction` wrapper**: Standardizes error handling and admin authorization
- **`assertAdmin` middleware**: Validates admin privileges before action execution
- **Zod validation**: Input schemas for type-safe data handling
- **`ActionResponse<T>`**: Consistent response wrapper for all actions

---

## Authentication

All actions automatically check admin privileges using `assertAdmin()`:

```typescript
async function assertAdmin() {
  const { userId, sessionClaims } = await auth();
  
  // 1. Check Auth
  if (!userId) throw new Error("Unauthorized: User not authenticated");

  // 2. Sync Role (Fail-safe)
  await syncUserRole().catch(err => console.error("Role sync warning:", err));

  // 3. Fast Role Check (from Clerk session claims)
  const metadata = sessionClaims?.metadata as { role?: string } | undefined;
  if (metadata?.role === "admin") return;

  // 4. Deep DB Check (Fallback)
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true }
  });

  if (user?.role !== "admin") {
    throw new Error("Forbidden: Admin privileges required");
  }
}
```

---

## Response Format

All actions return a standardized `ActionResponse<T>`:

```typescript
type ActionResponse<T = null> = {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
```

---

## Dashboard Actions

### `getDashboardStats()`

Returns platform-wide statistics for the admin dashboard.

**Returns:**
```typescript
ActionResponse<{
  userCount: number;
  professionalCount: number;
  verifiedProfessionalCount: number;
  activeProjectCount: number;
}>
```

**Example Usage:**
```typescript
const response = await getDashboardStats();
if (response.success) {
  console.log(`Total users: ${response.data.userCount}`);
}
```

---

## User Management

### `getUsers(page?, limit?, search?)`

Fetches a paginated list of users with optional search.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number (1-indexed) |
| `limit` | `number` | `10` | Items per page (max 100) |
| `search` | `string` | `""` | Search email, firstName, lastName |

**Returns:**
```typescript
ActionResponse<{
  users: Array<User & { professionalProfile?: { companyName, verified } }>;
  meta: PaginationMeta;
}>
```

---

### `getUserDetails(userId: string)`

Fetches complete user profile with related data.

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | `string` | User's database ID |

**Includes:**
- `professionalProfile`
- `clientProfile`
- Last 5 `orders`
- Last 5 `reviews` (with professional company name)

---

### `deleteUser(userId: string)`

Permanently removes a user from both Clerk and database.

> ⚠️ **Destructive Action**: Cascading delete. Consider implementing soft delete.

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | `string` | User's database ID |

**Process:**
1. Fetches user's `clerkId`
2. Deletes from Clerk (handles 404 gracefully)
3. Cascading delete from Prisma
4. Revalidates `/admin/users`

---

## Professional Management

### `getProfessionals(page?, limit?, search?)`

Lists professional profiles with user data.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `limit` | `number` | `10` | Items per page |
| `search` | `string` | `""` | Search company name or user email |

---

### `getProfessionalDetails(userId: string)`

Fetches complete professional profile.

**Includes:**
- `user`
- `certificates`
- `portfolios`
- `reviews`
- Last 10 `orders` with `payments`

---

### `verifyProfessional(userId: string)`

Marks a professional as verified.

```typescript
const result = await verifyProfessional("user_123");
// result.data = { verified: true }
```

---

### `rejectProfessional(userId: string)`

Marks a professional as unverified/rejected.

---

### `updateProfessionalProfile(userId: string, formData: unknown)`

Updates professional profile fields.

**Validated Fields (Zod):**

| Field | Type | Constraints |
|-------|------|-------------|
| `companyName` | `string?` | min 2 chars |
| `licenseNumber` | `string?` | - |
| `yearsExperience` | `number?` | min 0 |
| `bio` | `string?` | max 1000 chars |
| `website` | `string?` | valid URL or empty |
| `servicesOffered` | `string[]?` | - |
| `city` | `string?` | - |
| `county` | `string?` | - |
| `country` | `string?` | - |

---

### `deleteCertificate(certificateId: string)`

Removes a professional's certificate.

---

## Project Management

### `getProjects(page?, limit?, search?)`

Lists projects with client and professional relations.

**Returns:**
```typescript
ActionResponse<{
  projects: Array<{
    id: string;
    title: string;
    status: string;
    budget: number | null;  // Converted from Decimal
    createdAt: Date;
    client: { firstName, lastName, email } | null;
    professional: { companyName, user: { avatar } } | null;
  }>;
  meta: PaginationMeta;
}>
```

---

### `getProjectDetails(projectId: string)`

Fetches a single project with all relations.

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | `string` | Project's database ID |

**Includes:**
- Full `client` data (id, firstName, lastName, email, avatar)
- Full `professional` with nested `user` data

---

## System Settings

### `getSystemSettings()`

Retrieves platform configuration (singleton pattern).

**Response Fields:**

| Field | Type | Default |
|-------|------|---------|
| `maintenanceMode` | `boolean` | `false` |
| `publicSignup` | `boolean` | `true` |
| `autoVerifyNCA` | `boolean` | `false` |
| `commissionRate` | `number` | `10` |
| `supportEmail` | `string` | `support@buildmarket.co.ke` |
| `adminEmailAlerts` | `boolean` | `true` |
| `securityMFA` | `boolean` | `true` |

> **Note:** Returns defaults if no settings row exists. `commissionRate` is converted from `Decimal`.

---

### `updateSystemSettings(data: SystemSettingsInput)`

Updates system configuration using upsert on the `global` singleton.

**Input Schema:**
```typescript
const SystemSettingsSchema = z.object({
  maintenanceMode: z.boolean(),
  publicSignup: z.boolean(),
  autoVerifyNCA: z.boolean(),
  commissionRate: z.number().min(0).max(100),
  supportEmail: z.string().email(),
  adminEmailAlerts: z.boolean(),
  securityMFA: z.boolean(),
});
```

---

### `clearSystemCache()`

Revalidates all paths to clear Next.js cache.

```typescript
const result = await clearSystemCache();
// result = { success: true }
```

---

## Error Handling

All errors are caught by the `safeAction` wrapper:

```typescript
async function safeAction<T>(
  actionName: string, 
  fn: () => Promise<T>
): Promise<ActionResponse<T>> {
  try {
    await assertAdmin();
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    console.error(`[AdminAction: ${actionName}] Error:`, error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return { success: false, error: message };
  }
}
```

---

## Pagination Schema

All paginated endpoints use:

```typescript
const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
});
```
