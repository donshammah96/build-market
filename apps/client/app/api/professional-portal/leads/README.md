# Professional Leads (CRM) API

Manages the professional's CRM lead pipeline — tracking client inquiries from initial contact through to won/lost outcomes.

## Endpoints

### GET `/api/professional-portal/leads`

List leads for the authenticated professional.

- **Auth**: Professional (owner)
- **Rate limit**: READ
- **Query**: `?page=1&limit=20&status=NEW,CONTACTED&priority=HIGH&source=REFERRAL`
- **Status filter**: Supports comma-separated values (e.g., `status=NEW,CONTACTED`)
- **Response**: Paginated list with lead metadata

### POST `/api/professional-portal/leads`

Create a new lead.

- **Auth**: Professional (owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported (scope: `lead`)
- **Body**: `{ clientName, clientEmail?, clientPhone?, clientId?, title, description?, projectType?, location?, county?, budget?, budgetMin?, budgetMax?, currency?, status?, priority?, source?, notes?, followUpDate? }`

### GET `/api/professional-portal/leads/[id]`

Get lead detail with linked client info.

- **Auth**: Professional (owner)
- **Rate limit**: READ

### PATCH `/api/professional-portal/leads/[id]`

Update a lead.

- **Auth**: Professional (owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported
- **Body**: All create fields optional; `clientId` and `followUpDate` accept `null` to clear
- **Auto-behavior**: Sets `wonAt` timestamp when status transitions to `WON`

### DELETE `/api/professional-portal/leads/[id]`

Delete a lead (hard delete — no `deletedAt` on model).

- **Auth**: Professional (owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported

## Lead Status Pipeline

```
NEW -> CONTACTED -> PROPOSAL -> WON
                             -> LOST (with lostReason)
```

## Enums

### LeadStatus

`NEW`, `CONTACTED`, `PROPOSAL`, `WON`, `LOST`

### LeadPriority

`LOW`, `MEDIUM`, `HIGH`, `URGENT`

### LeadSource

`PLATFORM_SEARCH`, `PROFILE_VIEW`, `DIRECT_MESSAGE`, `PHONE_REVEAL`, `REFERRAL`, `EXTERNAL_IMPORT`

### LostReason

`PRICE_TOO_HIGH`, `GHOSTED`, `COMPETITOR_WON`, `TIMELINE_MISMATCH`, `OUT_OF_SCOPE`, `OTHER`

## Database Indexes

The Lead model has optimized indexes for:

- `[professionalId]` — list by owner
- `[status]` — filter by pipeline stage
- `[county]` — geographic filtering
- `[professionalId, status, priority]` — CRM pipeline view
- `[status, createdAt]` — lead aging reports
