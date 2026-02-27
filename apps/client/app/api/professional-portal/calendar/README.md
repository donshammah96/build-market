# Professional Calendar API

Manages calendar events for authenticated professionals. Supports date-range filtering, type/status filters, guest emails, recurrence rules, linked clients and projects.

## Endpoints

### `GET /api/professional-portal/calendar`

List calendar events for the authenticated professional.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | ISO 8601 datetime | Filter events starting from this date |
| `end` | ISO 8601 datetime | Filter events ending at this date |
| `type` | `CalendarEventType` enum | Filter by event type |
| `status` | `CalendarEventStatus` enum | Filter by event status |

**Response:** `200 OK` — Array of calendar events with linked client/project summaries.

### `POST /api/professional-portal/calendar`

Create a new calendar event.

**Body:**

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | `string` (3–200 chars) | Yes | — |
| `description` | `string` (max 5000) | No | — |
| `type` | `CalendarEventType` | No | `MEETING` |
| `status` | `CalendarEventStatus` | No | `SCHEDULED` |
| `startDate` | ISO 8601 datetime | Yes | — |
| `endDate` | ISO 8601 datetime | Yes | — |
| `isAllDay` | `boolean` | No | `false` |
| `timeZone` | `string` | No | `Africa/Nairobi` |
| `recurrenceRule` | `string` | No | — |
| `location` | `string` (max 500) | No | — |
| `meetingUrl` | `string` (URL) | No | — |
| `reminders` | `number[]` (minutes) | No | `[30]` |
| `color` | `string` | No | — |
| `clientId` | `UUID` | No | — |
| `projectId` | `UUID` | No | — |
| `guestEmails` | `string[]` (emails) | No | `[]` |

**Response:** `201 Created` — The created calendar event.

### `GET /api/professional-portal/calendar/[id]`

Get details of a specific calendar event (includes description, guest emails, external ID).

**Response:** `200 OK` — Calendar event detail with linked client/project.

### `PATCH /api/professional-portal/calendar/[id]`

Update a calendar event. All fields optional. Validates date ordering across existing values.

**Response:** `200 OK` — The updated calendar event.

### `DELETE /api/professional-portal/calendar/[id]`

Delete a calendar event (hard delete — model has no `deletedAt`).

**Response:** `200 OK` — `{ message: "Event deleted successfully" }`

## Enums

### `CalendarEventType`

`MEETING` | `SITE_VISIT` | `DEADLINE` | `PAYMENT_DUE` | `MATERIAL_DELIVERY` | `INSPECTION_NCA` | `INSPECTION_INTERNAL`

### `CalendarEventStatus`

`SCHEDULED` | `CONFIRMED` | `COMPLETED` | `CANCELLED` | `RESCHEDULED` | `NO_SHOW`

## Cross-Cutting Concerns

- **Authentication**: All endpoints require Clerk authentication via `withAuth`.
- **Rate Limiting**: Scoped keys (`calendar-read`, `calendar-write`, `calendar-event-*`).
- **Resilience**: All database operations wrapped in `getResilientExecutor().execute()`.
- **Idempotency**: POST and PATCH mutations use `IdempotencyService` (SHA-256 keyed).
- **Validation**: Zod schemas with `z.nativeEnum()` for Prisma enums (`CalendarEventType`, `CalendarEventStatus`).
- **Data Minimization**: Prisma `select` objects (`calendarEventListSelect`, `calendarEventDetailSelect`).
- **Body Size**: POST/PATCH enforce 1 MB body size limit via `checkBodySize`.
- **ID Validation**: `[id]` routes validate UUID format via `isValidId`.
