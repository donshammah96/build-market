# Project Documents API

Sub-resource of `/api/professional-portal/projects/[id]`.

## Endpoints

### GET `/projects/[id]/documents`

List documents for a project with asset details.

- **Auth**: Professional (project owner)
- **Rate limit**: READ
- **Query**: `?type=CONTRACT_AGREEMENT` to filter by document type
- **GDPR**: Access to sensitive document types (CONTRACT, INVOICE, BOQ) is audit-logged

### POST `/projects/[id]/documents`

Create a document linked to a pre-uploaded Asset.

- **Auth**: Professional (project owner)
- **Rate limit**: WRITE
- **Limit**: 100 documents per project
- **Body**: `{ title, type, assetId, milestoneId? }`
- **Validations**: Asset ownership verified, milestone verified if provided
- **GDPR**: Consent record created, audit log for sensitive types

### DELETE `/projects/[id]/documents?documentId=xxx`

Delete a project document. Asset cleanup handled by existing job.

- **Auth**: Professional (project owner)
- **Rate limit**: WRITE
- **Audit**: Deletion logged via ComplianceService

## Document Types

Uses `ProjectDocumentType` enum from Prisma schema (e.g., `CONTRACT_AGREEMENT`, `INVOICE`, `BOQ`, `VARIATION_ORDER`, `COMPLETION_CERTIFICATE`, etc.).
