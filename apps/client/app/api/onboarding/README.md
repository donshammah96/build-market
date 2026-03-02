# Onboarding API

User onboarding endpoints for Build Market. Handles initial account setup for both **client** (homeowner) and **professional** roles, including skip flows for deferred profile completion.

## Architecture

All onboarding endpoints use **Clerk authentication directly** (not `withAuth` middleware) because the database user may not exist yet at the time of the request. The endpoints create the user record if needed via `upsert`.

After successful onboarding, Clerk `publicMetadata` is updated with `role` and `isOnboarded` so that middleware can make routing decisions without a database round-trip. The database remains the source of truth — Clerk metadata failures are logged but do not fail the request.

### Cross-Cutting Concerns

| Concern         | Implementation                                                         |
| --------------- | ---------------------------------------------------------------------- |
| Authentication  | Clerk `auth()` / `withAuth` (complete endpoint only)                   |
| Rate Limiting   | `checkRateLimit` with `RateLimits.AUTH` or `RateLimits.WRITE`          |
| Idempotency     | `IdempotencyService` (SHA-256 key dedup) on all mutation endpoints     |
| Resilience      | `getResilientExecutor().execute()` with circuit breaker                |
| Body Size       | `checkBodySize` guard (1-2 MB for JSON, 10 MB per file for uploads)    |
| Validation      | Zod schemas (`OnboardingSchema`, `OnboardingCompleteSchema`)           |
| Response Format | `apiSuccess()` / `apiError()` with correlation IDs                     |
| GDPR            | Individual `ConsentRecord` per consent type change (complete endpoint) |

## Endpoints

### POST `/api/onboarding`

Complete user onboarding by setting role and creating a profile. This is the primary onboarding endpoint used by the onboarding wizard.

- **Auth**: Clerk (no DB user required)
- **Rate Limit**: `AUTH` tier
- **Idempotency**: Yes (keyed on `clerkId` + role)
- **Validation**: `OnboardingSchema` (discriminated union from `@build/types`)

**Roles handled:**

- `"client"` — Creates `User` (role=CLIENT) + `ClientProfile` with location, budget, interests, and client type
- `"professional"` — Creates `User` (role=PROFESSIONAL) + `ProfessionalProfile` + `ProfessionalLicense` (if provided) + `ProfessionalDocument` records for certificates and ID documents

**Request body** (client example):

```json
{
  "role": "client",
  "county": "NAIROBI",
  "city": "Nairobi",
  "type": "HOMEOWNER",
  "budgetRangeMin": 500000,
  "budgetRangeMax": 5000000,
  "interests": ["renovation", "plumbing"]
}
```

**Request body** (professional example):

```json
{
  "role": "professional",
  "profession": "ARCHITECT",
  "companyName": "Shammah Builders",
  "county": "MOMBASA",
  "yearsExperience": 5,
  "bio": "Licensed architect...",
  "license": {
    "authority": "BORAQS",
    "licenseNumber": "A-12345"
  },
  "certificatesUrls": ["https://..."],
  "idDocumentsUrls": ["https://..."]
}
```

**Success response** (`200`):

```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "role": "CLIENT",
    "isProfileComplete": true
  }
}
```

---

### POST `/api/onboarding/skip`

Skip onboarding for homeowners. Creates a minimal `CLIENT` user and an empty `ClientProfile` with defaults. The user is redirected to the dashboard and can complete their profile later.

- **Auth**: Clerk (no DB user required)
- **Rate Limit**: `AUTH` tier
- **Idempotency**: Yes (keyed on `clerkId`)
- **Body**: None required

**Business rules:**

- Professionals with an existing `ProfessionalProfile` cannot use this endpoint (returns `400`)
- Users who already completed onboarding get a `409 Conflict`

**Success response** (`200`):

```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "role": "CLIENT",
    "isProfileComplete": false,
    "skipped": true,
    "redirectTo": "/dashboard",
    "message": "Onboarding skipped. You can complete your profile from the dashboard."
  }
}
```

---

### POST `/api/onboarding/skip-professional`

Skip onboarding for professionals. Creates a minimal `PROFESSIONAL` user and a `ProfessionalProfile` with `profession: OTHER` and a placeholder company name. The user is redirected to the professional portal dashboard.

- **Auth**: Clerk (no DB user required)
- **Rate Limit**: `AUTH` tier
- **Idempotency**: Yes (keyed on `clerkId`)
- **Body**: None required

**Business rules:**

- Users who already completed full onboarding get a `409 Conflict`

**Success response** (`200`):

```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "role": "PROFESSIONAL",
    "isProfileComplete": false,
    "skipped": true,
    "redirectTo": "/professional-portal/dashboard",
    "message": "Professional onboarding skipped. Complete your verification from the dashboard."
  }
}
```

---

### PATCH `/api/onboarding/professional/complete`

Complete a professional profile for users who previously skipped onboarding. This is the most comprehensive onboarding endpoint.

- **Auth**: `withAuth` middleware (requires existing `PROFESSIONAL` DB user)
- **Rate Limit**: `WRITE` tier
- **Idempotency**: Yes (keyed on `dbUserId` + profession)
- **Body Size**: 2 MB max
- **GDPR**: Creates individual `ConsentRecord` for each consent type change

**Actions performed (transactional):**

1. Upserts `ProfessionalProfile` (profession, company, experience, bio, website)
2. Creates `ProfessionalLicense` record if license number + authority provided
3. Creates EARB `ProfessionalLicense` record if EARB number provided
4. Creates `Store` for supplier professions (with auto-generated slug)
5. Creates `ProfessionalDocument` records for certificates (`EDUCATION_CERT`) and IDs (`ID_OR_PASSPORT`)
6. Updates `User` consent preferences and marks `isProfileComplete: true`
7. Creates `ConsentRecord` audit entries for each changed consent type

**Security:**

- Blocked for `SUSPENDED` or `BANNED` accounts (returns `403`)
- Role must be `PROFESSIONAL` (returns `403` otherwise)

**Request body:**

```json
{
  "profession": "ARCHITECT",
  "companyName": "Shammah Builders",
  "yearsExperience": 5,
  "website": "https://shammahbuilders.co.ke",
  "bio": "Licensed architect specializing in...",
  "licenseNumber": "A-12345",
  "licenseAuthority": "BORAQS",
  "earbNumber": "EARB-6789",
  "emailMarketingConsent": true,
  "smsMarketingConsent": false,
  "analyticsConsent": true,
  "storeData": {
    "name": "Crispy Hardware",
    "description": "Building materials supplier",
    "address": "Moi Avenue",
    "city": "Nairobi",
    "county": "NAIROBI"
  },
  "certificatesUrls": ["https://..."],
  "idDocumentsUrls": ["https://..."]
}
```

**Success response** (`200`):

```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "role": "PROFESSIONAL", "isProfileComplete": true },
    "profile": {
      "userId": "uuid",
      "profession": "ARCHITECT",
      "companyName": "Acme Builders"
    },
    "completion": {
      "percentage": 85,
      "isComplete": true,
      "missingRequired": [],
      "missingRequiredLabels": [],
      "missingOptional": ["avatar", "portfolioUrl"],
      "filledFields": ["profession", "companyName", "bio"]
    }
  }
}
```

---

### POST `/api/onboarding/uploads`

Secure file upload endpoint for the onboarding flow. Accepts images and PDFs for certificates and ID documents.

- **Auth**: Clerk (no DB user required)
- **Rate Limit**: `WRITE` tier
- **Body**: `multipart/form-data`
- **Max file size**: 10 MB per file
- **Max files**: 5 per request
- **Allowed types**: JPEG, PNG, WebP, PDF

**Security features:**

- MIME type validation against allowlist
- File extension validation (fallback)
- Magic byte (file signature) verification to prevent content-type spoofing
- WebP-specific RIFF/WEBP marker check

> **Note**: This endpoint currently writes to the local filesystem (`public/uploads/`). For production deployments with serverless or multi-instance architectures, this should be migrated to cloud storage (e.g., S3/R2) using the centralized `Asset` model.

**Request**: `multipart/form-data` with file fields (e.g., `certificates`, `idDocuments`)

**Success response** (`200`):

```json
{
  "success": true,
  "data": {
    "uploaded": {
      "certificates": [
        { "originalName": "cert.pdf", "url": "/uploads/1707123456-uuid.pdf" }
      ],
      "idDocuments": [
        {
          "originalName": "id-front.jpg",
          "url": "/uploads/1707123457-uuid.jpg"
        }
      ]
    }
  }
}
```

## Error Responses

All endpoints return errors in the standard format:

```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "details": []
  }
}
```

| Status | Meaning                                                                   |
| ------ | ------------------------------------------------------------------------- |
| `400`  | Validation failed or invalid request body                                 |
| `401`  | Not authenticated (missing Clerk session)                                 |
| `403`  | Wrong role or account is suspended/banned                                 |
| `404`  | User not found (complete endpoint only)                                   |
| `409`  | Onboarding already completed, or request is being processed (idempotency) |
| `413`  | Request body too large                                                    |
| `429`  | Rate limit exceeded                                                       |
| `500`  | Internal server error                                                     |

## Database Models

| Model                  | Usage                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| `User`                 | Core user record with role, status, consent flags                         |
| `ClientProfile`        | Location, budget, interests for homeowners                                |
| `ProfessionalProfile`  | Profession, company, experience, verification status                      |
| `ProfessionalLicense`  | License/EARB credential records (unique by professional+authority+number) |
| `ProfessionalDocument` | Certificates (`EDUCATION_CERT`) and ID documents (`ID_OR_PASSPORT`)       |
| `Store`                | Supplier store with auto-generated slug                                   |
| `ConsentRecord`        | GDPR audit trail for consent changes                                      |
| `IdempotencyKey`       | Mutation deduplication (scope: `onboarding`)                              |

## Flow Diagram

```
New User Signs Up (Clerk)
        │
        ├──→ Full Onboarding ──→ POST /api/onboarding
        │                              │
        │                    ┌─────────┴──────────┐
        │                    │                     │
        │               role=client          role=professional
        │                    │                     │
        │              ClientProfile      ProfessionalProfile
        │                                 + License + Documents
        │
        ├──→ Skip (Client) ──→ POST /api/onboarding/skip
        │                              │
        │                     Minimal ClientProfile
        │                     (isProfileComplete=false)
        │
        └──→ Skip (Pro) ──→ POST /api/onboarding/skip-professional
                                   │
                          Minimal ProfessionalProfile
                          (isProfileComplete=false)
                                   │
                                   ▼
                     Later: PATCH /api/onboarding/professional/complete
                                   │
                          Full profile + License + Store
                          + Documents + GDPR consent
                          (isProfileComplete=true)
```
