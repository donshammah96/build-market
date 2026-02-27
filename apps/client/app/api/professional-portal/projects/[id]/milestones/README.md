# Project Milestones API

Sub-resource of `/api/professional-portal/projects/[id]`.

## Endpoints

### GET `/projects/[id]/milestones`

List all milestones for a project, ordered by due date.

- **Auth**: Professional (project owner)
- **Rate limit**: READ
- **Response**: Array of milestones with proof image/document counts

### POST `/projects/[id]/milestones`

Create a new milestone.

- **Auth**: Professional (project owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported (scope: `project_milestone`)
- **Limit**: 50 milestones per project
- **Body**: `{ title, description?, amount?, dueDate? }`
- **GDPR**: Consent record created

### GET `/projects/[id]/milestones/[milestoneId]`

Get milestone detail with proof images, linked documents, and escrow status.

- **Auth**: Professional (project owner)
- **Rate limit**: READ

### PATCH `/projects/[id]/milestones/[milestoneId]`

Update a milestone. Status transitions are validated via state machine.

- **Auth**: Professional (project owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported
- **Body**: `{ title?, description?, amount?, dueDate?, status? }`

#### Status Transitions

```
PENDING -> IN_PROGRESS, DELAYED
IN_PROGRESS -> IN_REVIEW, DELAYED
IN_REVIEW -> COMPLETED, DELAYED, IN_PROGRESS (rejected)
DELAYED -> IN_PROGRESS, PENDING
```

### DELETE `/projects/[id]/milestones/[milestoneId]`

Delete a milestone. Cannot delete if escrow is linked.

- **Auth**: Professional (project owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported

### POST `/projects/[id]/milestones/[milestoneId]/approve`

Client-only approval endpoint.

- **Auth**: Client (project client only)
- **Rate limit**: WRITE
- **Idempotency**: Supported
- **Body**: `{ approvalStatus: APPROVED|REJECTED|REQUESTED_CHANGE, rejectionReason? }`
- **Side effects**: On APPROVED, triggers escrow release if funds held
- **Audit**: Logged via ComplianceService

#### Approval Transitions

```
PENDING -> APPROVED, REJECTED, REQUESTED_CHANGE
REJECTED -> PENDING (resubmit)
REQUESTED_CHANGE -> PENDING (resubmit)
```
