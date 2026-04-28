# Projects API Ownership

`/api/projects/**` is the canonical shared project resource surface for both homeowners and professionals.

`/api/professional-portal/projects/**` is retained for professional dashboard UX compatibility and now aliases the shared handlers for the full project route tree:

- `/api/professional-portal/projects` -> `/api/projects`
- `/api/professional-portal/projects/[id]` -> `/api/projects/[id]`
- `/api/professional-portal/projects/[id]/milestones/**` -> `/api/projects/[id]/milestones/**`
- `/api/professional-portal/projects/[id]/documents/**` -> `/api/projects/[id]/documents/**`
- `/api/professional-portal/projects/[id]/images/**` -> `/api/projects/[id]/images/**`
- `/api/professional-portal/projects/[id]/escrow/**` -> `/api/projects/[id]/escrow/**`

## Canonical Shared Routes

- `GET /api/projects` — actor-scoped project list.
- `POST /api/projects` — project creation (policy: professional/admin only).
- `GET /api/projects/[id]` — resource read for project participants.
- `PATCH /api/projects/[id]` — project mutation with optimistic lock (`If-Match`) and idempotency.
- `DELETE /api/projects/[id]` — soft delete with optimistic lock (`If-Match`) and idempotency.
- `GET /api/projects/[id]/milestones` — list milestones for project participants.
- `POST /api/projects/[id]/milestones` — create milestone (professional owner only).
- `GET/PATCH/DELETE /api/projects/[id]/milestones/[milestoneId]` — milestone detail and mutation flows.
- `POST /api/projects/[id]/milestones/[milestoneId]/approve` — milestone approval flow.
- `GET/POST /api/projects/[id]/documents` and `GET/DELETE /api/projects/[id]/documents/[documentId]`.
- `GET/POST /api/projects/[id]/images` and `GET/DELETE /api/projects/[id]/images/[imageId]`.
- `GET /api/projects/[id]/escrow` and `GET /api/projects/[id]/escrow/[escrowId]`.
- `POST /api/projects/[id]/escrow/[escrowId]/fund|release|dispute` — escrow lifecycle actions.

## Ownership Matrix

| Resource          | Action                           | Professional (owner) | Homeowner (client participant) | Admin                         |
| ----------------- | -------------------------------- | -------------------- | ------------------------------ | ----------------------------- |
| Project           | Read (`GET`)                     | Allow                | Allow                          | Allow                         |
| Project           | Create (`POST`)                  | Allow                | Deny                           | Allow                         |
| Project           | Update/Delete (`PATCH`/`DELETE`) | Allow                | Deny                           | Deny (current implementation) |
| Documents/Images  | Read                             | Allow                | Allow                          | Allow                         |
| Documents/Images  | Upload/Delete                    | Allow                | Deny                           | Allow                         |
| Milestone approve | Approve flow                     | Deny                 | Allow                          | Deny                          |

## Route Adapter Responsibilities

Routes stay thin and only handle:

- auth context extraction (`withAuth`)
- rate limiting
- zod input validation
- idempotency header processing
- resilient execution + response mapping

Business logic and authorization decisions belong in:

- `app/lib/domains/projects/service.ts`
- `app/lib/domains/projects/repository.ts`

## Validation + Configuration

- `app/lib/validation/projects-validation.ts`
- `app/lib/config/project.config.ts`
