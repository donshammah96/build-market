# Notifications API

User notification system for Build Market supporting multiple types, priorities, delivery channels, and read/unread state management.

## Architecture

```
Frontend (NotificationsPopover, NotificationsPage)
  └── fetch /api/notifications (React Query)

API Routes
  ├── /api/notifications         → GET list, PATCH mark-read, DELETE batch
  └── /api/notifications/[id]    → GET detail, PATCH update, DELETE single
        └── Prisma (Notification model)
```

## Schema Model

```
Notification {
  id              UUID
  userId          FK → User
  title           String
  message         Text
  type            NotificationType (INFO, ALERT, SUCCESS, WARNING, ERROR, PAYMENT, MESSAGE, PROJECT, LEAD, SECURITY, SYSTEM)
  priority        NotificationPriority (LOW, MEDIUM, HIGH)
  channels        NotificationChannel[] (IN_APP, EMAIL, SMS, PUSH)
  metadata        JSONB?
  link            String?
  isRead          Boolean (default false)
  readAt          DateTime?
  deliveryStatus  NotificationDeliveryStatus (QUEUED, SENT, DELIVERED, FAILED)
  error           String?
  createdAt       DateTime
  expiresAt       DateTime?
}
```

## Cross-Cutting Concerns

- **Authentication**: `withAuth` middleware — Clerk → DB user resolution
- **Rate Limiting**: Scoped keys (`notifications-read:`, `notifications-write:`)
- **Resilience**: `getResilientExecutor().execute()` with circuit breaker
- **Validation**: Zod schemas from `notifications-validation.ts`
- **Body Size Limits**: `checkBodySize` on all mutations
- **Ownership Verification**: Every single-notification operation checks `userId` ownership
- **Expiry Filtering**: Expired notifications (`expiresAt < now`) are excluded from list queries
- **Read Timestamp**: `readAt` is automatically set/cleared when toggling `isRead`

## Endpoints

### Collection Routes (`/api/notifications`)

| Method | Description                         | Body                                         |
| ------ | ----------------------------------- | -------------------------------------------- |
| GET    | List notifications (paginated)      | Query: `page`, `limit`, `unreadOnly`, `type`, `priority` |
| PATCH  | Mark notification(s) as read/unread | `{ id: "uuid" \| "all", isRead?: boolean }`  |
| DELETE | Batch delete notifications          | `{ id: "uuid" \| "all" \| "read" }`          |

### Single Resource Routes (`/api/notifications/[id]`)

| Method | Description          | Body                     |
| ------ | -------------------- | ------------------------ |
| GET    | Get notification     | —                        |
| PATCH  | Update (read status) | `{ isRead?: boolean }`   |
| DELETE | Delete notification  | —                        |

## Request/Response Examples

### List Notifications

```
GET /api/notifications?page=1&limit=20&unreadOnly=true&type=MESSAGE
```

Response (200):

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "uuid",
        "title": "New Message",
        "message": "Don Shammah sent you a new file",
        "type": "MESSAGE",
        "priority": "MEDIUM",
        "channels": ["IN_APP"],
        "link": "/messages/thread-uuid",
        "isRead": false,
        "readAt": null,
        "deliveryStatus": "DELIVERED",
        "metadata": null,
        "createdAt": "2025-01-01T00:00:00Z",
        "expiresAt": null
      }
    ],
    "unreadCount": 5,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "totalPages": 3
    }
  }
}
```

### Mark All as Read

```json
PATCH /api/notifications
{ "id": "all" }
```

Response:

```json
{
  "success": true,
  "data": { "message": "All notifications marked as read", "count": 5 }
}
```

### Mark Single as Read

```json
PATCH /api/notifications
{ "id": "notification-uuid", "isRead": true }
```

### Delete Read Notifications

```json
DELETE /api/notifications
{ "id": "read" }
```

### Get Single Notification

```
GET /api/notifications/notification-uuid
```

### Delete Single Notification

```
DELETE /api/notifications/notification-uuid
```

## Error Responses

```json
{
  "success": false,
  "error": "Human-readable message",
  "details": [...],
  "timestamp": "ISO-8601",
  "correlationId": "uuid"
}
```

| Status | Meaning                     |
| ------ | --------------------------- |
| 400    | Validation failed           |
| 401    | Not authenticated           |
| 403    | Not notification owner      |
| 404    | Notification not found      |
| 429    | Rate limited                |
| 500    | Internal server error       |

## Validation Module

Schemas in `app/lib/validation/notifications-validation.ts`:

- `NotificationQuerySchema` — GET query params with pagination and filters
- `MarkReadSchema` — PATCH body for root route (single or "all")
- `BatchDeleteSchema` — DELETE body for root route (single, "all", or "read")
- `UpdateNotificationSchema` — PATCH body for `[id]` route
- `notificationListSelect` / `notificationDetailSelect` — Prisma select objects

## Frontend Compatibility Note

The frontend `NotificationsPopover.tsx` currently uses `notification.read` as the field name. The refactored API now correctly returns `isRead` (matching the Prisma schema). The frontend interface should be updated from `read: boolean` to `isRead: boolean`.
