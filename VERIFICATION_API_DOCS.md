# Admin Verification System - API Documentation

## Overview

The Admin Verification System provides a comprehensive, fault-tolerant solution for verifying professionals, stores, and properties with complete audit trails and automated notifications.

## Authentication

All endpoints require admin role authentication using Clerk JWT tokens.

**Headers Required:**
```
Authorization: Bearer <clerk-jwt-token>
Content-Type: application/json
```

## Rate Limits

- Verification endpoints: 20 requests per minute
- Document verification: 30 requests per minute
- Read endpoints: 100 requests per minute

---

## Endpoints

### 1. Verify Entity

**POST** `/api/admin/verify`

Unified endpoint for verifying professionals, stores, or properties.

**Request Body:**
```json
{
  "entityType": "professional" | "store" | "property",
  "entityId": "uuid",
  "action": "VERIFY" | "REJECT" | "REQUEST_CORRECTION",
  "notes": "string (optional)",
  "reason": "string (required for REJECT and REQUEST_CORRECTION)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "entityType": "professional",
    "entityId": "uuid",
    "previousStatus": "PENDING",
    "newStatus": "VERIFIED",
    "verifiedAt": "2026-01-06T10:30:00Z",
    "message": "Professional \"Company Name\" has been verified"
  },
  "message": "Professional \"Company Name\" has been verified",
  "timestamp": "2026-01-06T10:30:00Z",
  "correlationId": "uuid"
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request body
- `403` - Unauthorized (not admin)
- `404` - Entity not found
- `422` - Invalid status transition
- `429` - Rate limit exceeded
- `500` - Server error

**Valid State Transitions:**

| From | To | Action | Requires Reason |
|------|-----|--------|----------------|
| UNVERIFIED | VERIFIED | VERIFY | No |
| UNVERIFIED | REJECTED | REJECT | Yes |
| PENDING | VERIFIED | VERIFY | No |
| PENDING | REJECTED | REJECT | Yes |
| PENDING | NEEDS_CORRECTION | REQUEST_CORRECTION | Yes |
| NEEDS_CORRECTION | VERIFIED | VERIFY | No |
| NEEDS_CORRECTION | REJECTED | REJECT | Yes |
| REJECTED | PENDING | REQUEST_CORRECTION | No |
| VERIFIED | REJECTED | REJECT | Yes |

---

### 2. Verify Document

**POST** `/api/admin/verify-document`

Verify individual documents or batch verify multiple documents.

**Single Document Request:**
```json
{
  "documentType": "professional_document" | "property_attachment" | "certificate",
  "documentId": "uuid",
  "action": "APPROVE" | "REJECT",
  "notes": "string (optional)"
}
```

**Batch Request:**
```json
{
  "documents": [
    {
      "documentType": "professional_document",
      "documentId": "uuid",
      "action": "APPROVE",
      "notes": "string (optional)"
    },
    {
      "documentType": "certificate",
      "documentId": "uuid",
      "action": "REJECT",
      "notes": "Expired certificate"
    }
  ]
}
```

**Response (Single):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "isVerified": true,
    "verifiedAt": "2026-01-06T10:30:00Z",
    "notes": "Document approved"
  },
  "message": "Document approved successfully"
}
```

**Response (Batch):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "documentId": "uuid",
        "success": true,
        "result": { /* document data */ }
      }
    ],
    "errors": [
      {
        "documentId": "uuid",
        "success": false,
        "error": "Document not found"
      }
    ],
    "summary": {
      "total": 10,
      "successful": 8,
      "failed": 2
    }
  },
  "message": "Batch verification completed: 8 successful, 2 failed"
}
```

---

### 3. Get Pending Verifications

**GET** `/api/admin/pending-verifications`

Get paginated list of items awaiting verification.

**Query Parameters:**
- `entityType`: `professional` | `store` | `property` | `all` (default: `all`)
- `status`: `UNVERIFIED` | `PENDING` | `NEEDS_CORRECTION` (default: `PENDING`)
- `page`: number (default: 1)
- `limit`: number (default: 20, max: 100)
- `sortBy`: `submittedAt` | `createdAt` (default: `submittedAt`)
- `sortOrder`: `asc` | `desc` (default: `desc`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "entityType": "professional",
      "entityId": "uuid",
      "companyName": "ABC Construction",
      "profession": "contractor",
      "status": "PENDING",
      "submittedAt": "2026-01-05T10:00:00Z",
      "createdAt": "2026-01-01T10:00:00Z",
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe"
      },
      "documentCount": 3,
      "certificateCount": 2
    },
    {
      "entityType": "store",
      "entityId": "uuid",
      "name": "Hardware Store",
      "storeType": "retail",
      "status": "PENDING",
      "submittedAt": "2026-01-04T15:00:00Z",
      "owner": { /* user data */ },
      "productCount": 50,
      "city": "Nairobi",
      "county": "NAIROBI"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "filters": {
    "entityType": "all",
    "status": "PENDING",
    "sortBy": "submittedAt",
    "sortOrder": "desc"
  }
}
```

---

### 4. Get Verification Details

**GET** `/api/admin/verification-details/[id]?entityType=professional`

Get detailed information for reviewing an entity verification.

**Query Parameters:**
- `entityType`: `professional` | `store` | `property` (required)

**Response (Professional):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "companyName": "ABC Construction",
    "profession": "contractor",
    "status": "PENDING",
    "verified": false,
    "submittedAt": "2026-01-05T10:00:00Z",
    "verificationNotes": null,
    "rejectionReason": null,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+254712345678",
      "createdAt": "2026-01-01T10:00:00Z"
    },
    "documents": [
      {
        "id": "uuid",
        "fileUrl": "/uploads/doc.pdf",
        "type": "NATIONAL_ID",
        "isVerified": false,
        "verifiedAt": null,
        "notes": null,
        "createdAt": "2026-01-05T10:00:00Z"
      }
    ],
    "certificates": [
      {
        "id": "uuid",
        "name": "NCA License",
        "issuer": "National Construction Authority",
        "issueDate": "2025-01-01",
        "expiryDate": "2027-01-01",
        "fileUrl": "/uploads/cert.pdf",
        "verificationStatus": "pending",
        "verifiedAt": null,
        "notes": null
      }
    ],
    "images": [
      {
        "id": "uuid",
        "url": "/uploads/image.jpg",
        "caption": "Portfolio image"
      }
    ],
    "verifiedBy": null,
    "auditHistory": [
      {
        "id": "uuid",
        "action": "SUBMIT_FOR_VERIFICATION",
        "oldStatus": "UNVERIFIED",
        "newStatus": "PENDING",
        "reason": "Initial submission",
        "createdAt": "2026-01-05T10:00:00Z",
        "admin": {
          "id": "uuid",
          "firstName": "Admin",
          "lastName": "User",
          "email": "admin@example.com"
        }
      }
    ]
  }
}
```

---

### 5. Get Verification Statistics

**GET** `/api/admin/verification-stats?period=week`

Get verification metrics and analytics.

**Query Parameters:**
- `period`: `today` | `week` | `month` | `all` (default: `all`)

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalPending": 45,
      "totalVerified": 234,
      "totalRejected": 12,
      "totalNeedsCorrection": 8,
      "urgentPending": 5,
      "avgVerificationTimeHours": 18.5
    },
    "professionals": {
      "total": 150,
      "verified": 120,
      "pending": 20,
      "rejected": 7,
      "needsCorrection": 3,
      "verificationRate": 80
    },
    "stores": {
      "total": 80,
      "verified": 65,
      "pending": 10,
      "rejected": 3,
      "needsCorrection": 2,
      "verificationRate": 81
    },
    "properties": {
      "total": 100,
      "verified": 85,
      "pending": 10,
      "rejected": 3,
      "needsCorrection": 2,
      "verificationRate": 85
    },
    "documents": {
      "professionalDocuments": {
        "total": 450,
        "verified": 380
      },
      "certificates": {
        "total": 200,
        "verified": 165
      },
      "propertyAttachments": {
        "total": 300,
        "verified": 255
      }
    },
    "recentActivity": [
      {
        "id": "uuid",
        "action": "VERIFY_PROFESSIONAL",
        "entityType": "ProfessionalProfile",
        "entityId": "uuid",
        "admin": {
          "id": "uuid",
          "firstName": "Admin",
          "lastName": "User",
          "email": "admin@example.com"
        },
        "createdAt": "2026-01-06T10:00:00Z"
      }
    ],
    "period": "week"
  }
}
```

---

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error message",
  "details": {
    "field": "Additional error details"
  },
  "timestamp": "2026-01-06T10:30:00Z",
  "correlationId": "uuid"
}
```

**Common Error Codes:**
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `422` - Unprocessable Entity (validation failed)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Audit Trail

All verification actions are automatically logged in the `AdminAuditLog` table with:
- Admin user ID
- Action performed
- Entity type and ID
- Old and new status
- Reason/notes
- IP address and user agent
- Timestamp

Audit logs can be retrieved via the verification details endpoint.

---

## Notifications

When an entity is verified, rejected, or needs correction:
1. An in-database notification is created for the user
2. Optionally, an external notification is sent (if `ENABLE_NOTIFICATION_SERVICE=true`)
3. The notification includes a link to the relevant page

**Notification Types:**
- `VERIFIED` → Success notification with green badge
- `REJECTED` → Error notification with red badge
- `NEEDS_CORRECTION` → Warning notification with yellow badge

---

## Best Practices

1. **Always provide clear notes** when rejecting or requesting corrections
2. **Check document expiry dates** for certificates
3. **Verify all required documents** before approving
4. **Use batch operations** for efficiency when verifying multiple documents
5. **Monitor urgent pending items** (>48 hours old)
6. **Review audit history** before making decisions on resubmissions

---

## Code Examples

### Verify a Professional

```typescript
const response = await fetch('/api/admin/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`,
  },
  body: JSON.stringify({
    entityType: 'professional',
    entityId: 'prof_uuid',
    action: 'VERIFY',
    notes: 'All documents verified. NCA license valid until 2027.',
  }),
});

const data = await response.json();
```

### Batch Verify Documents

```typescript
const response = await fetch('/api/admin/verify-document', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`,
  },
  body: JSON.stringify({
    documents: [
      {
        documentType: 'professional_document',
        documentId: 'doc1_uuid',
        action: 'APPROVE',
      },
      {
        documentType: 'professional_document',
        documentId: 'doc2_uuid',
        action: 'APPROVE',
      },
    ],
  }),
});

const data = await response.json();
```

### Get Pending Verifications

```typescript
const response = await fetch(
  '/api/admin/pending-verifications?entityType=professional&status=PENDING&page=1&limit=20',
  {
    headers: {
      'Authorization': `Bearer ${clerkToken}`,
    },
  }
);

const data = await response.json();
```

---

## Support

For issues or questions, contact the development team or refer to the project documentation.
