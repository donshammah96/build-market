# Public Leads API

Public-facing endpoints for clients to submit inquiry leads to professionals and check submission status. **No authentication required.**

> For authenticated professional lead management, see `/api/professional-portal/leads`.

## Architecture

```
Client (Contact Form / Profile Page)
  └── POST /api/leads           → Create lead inquiry
  └── GET  /api/leads/[id]      → Check submission status
        └── Prisma (Lead model)
              └── Notification (fire-and-forget to professional)
```

## Schema Model (Partial — public-relevant fields)

```
Lead {
  id              UUID
  professionalId  FK → ProfessionalProfile
  clientName      String
  clientEmail     String?
  clientPhone     String?
  title           String
  description     Text?
  projectType     ProjectType (RESIDENTIAL, COMMERCIAL, RENOVATION, ...)
  location        String?
  county          County?
  budget          Decimal?
  status          LeadStatus (NEW, CONTACTED, PROPOSAL, WON, LOST)
  source          LeadSource (PLATFORM_SEARCH, PROFILE_VIEW, DIRECT_MESSAGE, ...)
  notes           Text?
  createdAt       DateTime
  updatedAt       DateTime
}
```

## Cross-Cutting Concerns

- **No Authentication**: These are public endpoints for unauthenticated clients
- **Rate Limiting**: Scoped keys (`leads-public-write:`, `leads-public-read:`)
- **Resilience**: `getResilientExecutor().execute()` with circuit breaker
- **Validation**: Zod schemas from `leads-validation.ts` using Prisma enum types
- **Body Size Limits**: `checkBodySize` on POST
- **ID Validation**: `isValidId` on `[id]` route

## Endpoints

| Method | Path             | Description                        |
| ------ | ---------------- | ---------------------------------- |
| POST   | `/api/leads`     | Submit a lead inquiry              |
| GET    | `/api/leads/:id` | Check inquiry status (public view) |

## Request/Response Examples

### Submit Lead Inquiry

```json
POST /api/leads
{
  "professionalId": "uuid",
  "clientName": "Don Shammah",
  "clientEmail": "crispy@teigen.com",
  "clientPhone": "+254712345678",
  "title": "Kitchen Renovation Quote",
  "projectType": "RENOVATION",
  "message": "I need a full kitchen renovation for my 3-bedroom apartment in Kileleshwa.",
  "location": "Kileleshwa, Nairobi",
  "county": "NAIROBI",
  "budget": 500000,
  "source": "PROFILE_VIEW"
}
```

Response (201):

```json
{
  "success": true,
  "data": {
    "message": "Inquiry sent successfully",
    "lead": {
      "id": "lead-uuid",
      "projectType": "RENOVATION",
      "status": "NEW",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  }
}
```

### Check Lead Status

```
GET /api/leads/lead-uuid
```

Response (200):

```json
{
  "success": true,
  "data": {
    "id": "lead-uuid",
    "title": "Kitchen Renovation Quote",
    "projectType": "RENOVATION",
    "location": "Kileleshwa, Nairobi",
    "status": "CONTACTED",
    "statusLabel": "Under Review",
    "professionalName": "Kamau & Sons Construction",
    "submittedAt": "2025-01-01T00:00:00Z",
    "lastUpdated": "2025-01-02T10:00:00Z"
  }
}
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
| 404    | Professional/lead not found |
| 413    | Body too large              |
| 429    | Rate limited                |
| 500    | Internal server error       |

## Status Labels (Public Display)

| LeadStatus | Public Label  |
| ---------- | ------------- |
| NEW        | Submitted     |
| CONTACTED  | Under Review  |
| PROPOSAL   | Proposal Sent |
| WON        | Accepted      |
| LOST       | Closed        |

## Enums (Validated)

| Enum        | Values                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------- |
| ProjectType | RESIDENTIAL, COMMERCIAL, RENOVATION, INTERIOR_DESIGN, LANDSCAPING, INFRASTRUCTURE, OTHER |
| LeadSource  | PLATFORM_SEARCH, PROFILE_VIEW, DIRECT_MESSAGE, PHONE_REVEAL, REFERRAL, EXTERNAL_IMPORT   |
| County      | All 47 Kenya counties                                                                    |

## Validation Module

Schemas in `app/lib/validation/leads-validation.ts`:

- `CreatePublicLeadSchema` — POST body with enum-validated fields
- `publicLeadCreateSelect` — Prisma select for sanitized create response
- `publicLeadStatusSelect` — Prisma select for public status lookup
- `LEAD_STATUS_LABELS` — Human-readable status mapping
- `LEAD_CONFIG` — Constants (body size limits, pagination defaults)

## Side Effects

When a lead is created, a notification is sent to the professional:

- **Channel**: IN_APP (default)
- **Type**: `LEAD`
- **Behavior**: Fire-and-forget — notification failure does not affect lead creation
