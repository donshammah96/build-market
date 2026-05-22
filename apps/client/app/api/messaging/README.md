# Messaging API

Full-featured messaging subsystem for Build Market, providing real-time-ready thread-based messaging with participant management, read receipts, reactions, and file attachments.

## Messaging API — Architecture & Conventions

This folder implements the messaging REST API used by the browser-safe client facade.

Key conventions applied:

- Client facades use REST `fetch()` (no Server Action imports).
- Query params are parsed via `Object.fromEntries(searchParams.entries())` and validated with Zod.
- POST routes that may accept different payload shapes must explicitly distinguish batch vs single payload before validation (where applicable).
- PATCH/DELETE routes extract expected version via `extractExpectedVersion(req, body)` — prefer `If-Match` header, fallback to `version` in JSON body.
- DELETE handlers safely parse the body (some clients/HTTP layers drop DELETE bodies).
- All service execution results are handled with explicit union-narrowing:
  - First: `if (!result.success) { ... }`
  - Else: `const data = result.data; if (data && "_error" in data && data._error) { ... } else { apiSuccess(data) }`
- Idempotency keys: include `Idempotency-Key` on client write requests to allow dedup and server-side caching via `IdempotencyService`.

## Architecture Shift: Thin Adapters + Domain Core

Messaging routes now follow a strict adapter pattern:

- Route files in `app/api/messaging/*` handle transport concerns only (auth, rate limits, body parse/validation, idempotency, status mapping).
- Business logic and authorization live in `app/lib/domains/messaging/service.ts`.
- Data access lives in `app/lib/domains/messaging/repository.ts`.
- Shared messaging contracts/schemas/selects are re-exported from `app/lib/domains/messaging/contracts.ts`.

This removes direct route-level Prisma orchestration and centralizes domain behavior in one canonical server-side module.

### Schema Models

| Model               | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `MessageThread`     | Conversation container (DIRECT/GROUP/etc.)   |
| `ThreadParticipant` | Join table: users ↔ threads with roles       |
| `Message`           | Individual message with type and reply chain |
| `ReadReceipt`       | Per-user per-message read tracking           |
| `MessageReaction`   | Emoji reactions (unique per user+emoji)      |
| `MessageAttachment` | Links messages to `Asset` records            |

### Entity Relationship

```text
MessageThread ──< ThreadParticipant
MessageThread ──< Message
Message ──< MessageReaction
Message ──< ReadReceipt
Message ──< MessageAttachment >── Asset
Message ──< Message (replies via replyToId)
```

## Cross-Cutting Concerns

All routes implement:

- **Authentication**: `withAuth` middleware (Clerk → DB user resolution)
- **Rate Limiting**: `checkRateLimit` with scoped keys per operation type
- **Resilience**: `getResilientExecutor().execute()` with circuit breaker
- **Validation**: Zod schemas from `app/lib/domains/messaging/contracts.ts` (re-exported from validation module)
- **Idempotency**: `IdempotencyService` on create/send operations
- **Soft Delete**: `deletedAt` filter on all queries
- **Participant Verification**: Domain service methods enforce participant and policy checks
- **Body Size Limits**: `checkBodySize` on all mutation endpoints

## Endpoints

### Health Check

| Method | Path             | Description            |
| ------ | ---------------- | ---------------------- |
| GET    | `/api/messaging` | Service health + stats |

### Threads (Conversations)

| Method | Path                                    | Description                     |
| ------ | --------------------------------------- | ------------------------------- |
| GET    | `/api/messaging/conversations`          | List user's threads (paginated) |
| POST   | `/api/messaging/conversations`          | Create a new thread             |
| GET    | `/api/messaging/conversations/:id`      | Get thread detail               |
| PATCH  | `/api/messaging/conversations/:id`      | Update subject / archive status |
| DELETE | `/api/messaging/conversations/:id`      | Soft-delete (OWNER/ADMIN)       |
| POST   | `/api/messaging/conversations/:id/read` | Mark all messages as read       |

### Participants

| Method | Path                                            | Description                |
| ------ | ----------------------------------------------- | -------------------------- |
| GET    | `/api/messaging/conversations/:id/participants` | List thread participants   |
| POST   | `/api/messaging/conversations/:id/participants` | Add participant (ADMIN+)   |
| PATCH  | `/api/messaging/conversations/:id/participants` | Update own settings        |
| DELETE | `/api/messaging/conversations/:id/participants` | Remove/leave (?userId=...) |

### Messages

| Method | Path                                                   | Description                        |
| ------ | ------------------------------------------------------ | ---------------------------------- |
| POST   | `/api/messaging/messages`                              | Send a message                     |
| GET    | `/api/messaging/messages/:id`                          | Get message detail + read receipts |
| PATCH  | `/api/messaging/messages/:id`                          | Edit message (sender only)         |
| DELETE | `/api/messaging/messages/:id`                          | Soft-delete (sender/admin)         |
| POST   | `/api/messaging/messages/:id/read`                     | Mark single message as read        |
| GET    | `/api/messaging/messages/conversation/:conversationId` | List messages (cursor pagination)  |

### Reactions

| Method | Path                                    | Description                  |
| ------ | --------------------------------------- | ---------------------------- |
| POST   | `/api/messaging/messages/:id/reactions` | Add emoji reaction           |
| DELETE | `/api/messaging/messages/:id/reactions` | Remove reaction (?emoji=...) |

## Request/Response Examples

### Create Thread

```json
POST /api/messaging/conversations
{
  "participantIds": ["uuid-1", "uuid-2"],
  "type": "GROUP",
  "subject": "Project Discussion"
}
```

Response (201):

```json
{
  "success": true,
  "data": {
    "id": "thread-uuid",
    "type": "GROUP",
    "subject": "Project Discussion",
    "participants": [
      { "userId": "creator-uuid", "role": "OWNER" },
      { "userId": "uuid-1", "role": "MEMBER" },
      { "userId": "uuid-2", "role": "MEMBER" }
    ]
  }
}
```

### Send Message

```json
POST /api/messaging/messages
{
  "threadId": "thread-uuid",
  "content": "Hello everyone!",
  "type": "TEXT",
  "replyToId": "optional-message-uuid",
  "attachmentIds": ["asset-uuid-1"]
}
```

Response (201):

```json
{
  "success": true,
  "data": {
    "id": "message-uuid",
    "threadId": "thread-uuid",
    "senderId": "user-uuid",
    "content": "Hello everyone!",
    "type": "TEXT",
    "attachments": [
      {
        "id": "attachment-uuid",
        "asset": {
          "id": "asset-uuid-1",
          "originalName": "photo.jpg",
          "mimeType": "image/jpeg",
          "cdnUrl": "https://..."
        }
      }
    ],
    "reactions": [],
    "replyTo": null,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

### List Messages (Cursor Pagination)

```text
GET /api/messaging/messages/conversation/{threadId}?cursor=msg-uuid&limit=50&direction=before
```

Response:

```json
{
  "success": true,
  "data": {
    "messages": [...],
    "hasMore": true,
    "nextCursor": "oldest-message-uuid"
  }
}
```

### Add Reaction

```json
POST /api/messaging/messages/{id}/reactions
{
  "emoji": "👍"
}
```

### Mark Thread as Read

```text
POST /api/messaging/conversations/{id}/read
```

Response:

```json
{
  "success": true,
  "data": {
    "threadId": "thread-uuid",
    "markedCount": 5
  }
}
```

## Error Responses

All errors follow the standard format:

```json
{
  "success": false,
  "error": "Human-readable message",
  "details": [...],
  "timestamp": "ISO-8601",
  "correlationId": "uuid"
}
```

| Status | Meaning                       |
| ------ | ----------------------------- |
| 400    | Validation failed             |
| 401    | Not authenticated             |
| 403    | Not a participant / no access |
| 404    | Thread or message not found   |
| 409    | Idempotency conflict          |
| 429    | Rate limited                  |
| 500    | Internal server error         |

## Enums

| Enum            | Values                          |
| --------------- | ------------------------------- |
| MessageType     | TEXT, IMAGE, FILE, PDF, SYSTEM  |
| ThreadType      | DIRECT, GROUP, PROJECT, SUPPORT |
| ParticipantRole | OWNER, ADMIN, MEMBER            |

## Authorization Matrix

| Action                  | OWNER | ADMIN | MEMBER        |
| ----------------------- | ----- | ----- | ------------- |
| Read thread/messages    | ✓     | ✓     | ✓             |
| Send message            | ✓     | ✓     | ✓             |
| Edit own message        | ✓     | ✓     | ✓             |
| Delete own message      | ✓     | ✓     | ✓             |
| Delete others' messages | ✓     | ✓     | ✗             |
| Update thread subject   | ✓     | ✓     | ✗             |
| Delete thread           | ✓     | ✓     | ✗             |
| Add participant         | ✓     | ✓     | ✗             |
| Remove participant      | ✓     | ✓     | ✗ (self only) |
| React to messages       | ✓     | ✓     | ✓             |

## Validation Module

Schemas and Prisma select objects are centralized in `app/lib/validation/messaging-validation.ts` and re-exported via `app/lib/domains/messaging/contracts.ts`:

- `ThreadQuerySchema` — GET params for thread listing
- `CreateThreadSchema` — POST body for new threads
- `UpdateThreadSchema` — PATCH body for thread updates
- `SendMessageSchema` — POST body for sending messages
- `MessageQuerySchema` — GET params for cursor pagination
- `UpdateMessageSchema` — PATCH body for message edits
- `AddParticipantSchema` — POST body for adding participants
- `UpdateParticipantSchema` — PATCH body for participant settings
- `ReactionSchema` — POST body for reactions
- `threadListSelect` / `threadDetailSelect` / `messageListSelect` / `messageDetailSelect` — Prisma select objects for data minimization

## Configuration

Constants in `MESSAGING_CONFIG`:

| Key                         | Value  |
| --------------------------- | ------ |
| MAX_BODY_SIZE               | 64 KB  |
| MAX_THREAD_PARTICIPANTS     | 50     |
| MAX_MESSAGE_LENGTH          | 10,000 |
| MAX_ATTACHMENTS_PER_MESSAGE | 10     |
| MAX_REACTION_EMOJI_LENGTH   | 10     |
| DEFAULT_MESSAGE_LIMIT       | 50     |
| DEFAULT_THREAD_LIMIT        | 20     |
