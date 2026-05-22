# Staff-Level Audit: Documents, Certificates, Licenses

**Date:** 2026-03-15  
**Scope:** `app/lib/domains/certificates`, `app/lib/domains/documents`, `app/lib/domains/licenses`  
**Ref:** API-TO-FRONTEND-ARCHITECTURE.md §8B Refinement Checklist

---

## 1. Audit Summary

### 1.1 Domain Layer (Boundary Refinement)

| Domain           | Contracts      | DTO Shape                    | lib/services Import |
| ---------------- | -------------- | ---------------------------- | ------------------- |
| **certificates** | `contracts.ts` | Explicit DTOs + `mappers.ts` | None                |
| **documents**    | `contracts.ts` | Explicit DTOs + `mappers.ts` | None                |
| **licenses**     | `contracts.ts` | Explicit DTOs + `mappers.ts` | None                |

**Findings:**

- ✅ No compatibility imports from `lib/services/*` — domains are canonical
- ✅ **Explicit DTO mappers:** Each domain has `mappers.ts` mapping Prisma results to explicit DTOs; contracts use domain-owned types with serialized date fields (ISO strings)
- ✅ **Browser facades:** `documents-client`, `certificates-client`, `licenses-client` use domain contracts; no client-side DTO repair

### 1.2 API Layer

| Slice            | Routes                                                                     | Domain Delegation     | Tests                        |
| ---------------- | -------------------------------------------------------------------------- | --------------------- | ---------------------------- |
| **documents**    | `GET/POST /api/professional-portal/documents`, `GET/PATCH/DELETE /[id]`    | `documentsService`    | `documents.route.test.ts`    |
| **certificates** | `GET/POST /api/professional-portal/certificates`, `GET/PATCH/DELETE /[id]` | `certificatesService` | `certificates.route.test.ts` |
| **licenses**     | `GET/POST /api/professional-portal/licenses`, `GET/PATCH/DELETE /[id]`     | `licensesService`     | `licenses.route.test.ts`     |

**Findings:**

- ✅ Routes are thin HTTP adapters delegating to domain services
- ✅ Route tests exist
- ✅ `lib/links.ts` has `professionalPortalCertificates`, `professionalPortalDocuments`, and `professionalPortalLicenses` (plus Detail variants) — all three credential slices covered

### 1.3 UI Layer (Current State)

| Slice            | Professional-Portal Page       | Components | Notes                                                                       |
| ---------------- | ------------------------------ | ---------- | --------------------------------------------------------------------------- |
| **documents**    | ❌ None                        | —          | No CRUD UI for professional documents                                       |
| **certificates** | ❌ None (read-only in profile) | —          | Public profile `profile/[id]` shows certificates in a tab; no management UI |
| **licenses**     | ❌ None                        | —          | Settings shows `licenseNumber` (read-only); no license CRUD UI              |

**Findings:**

- **Gap:** No dedicated professional-portal settings pages for documents, certificates, or licenses
- **Reference patterns:** `settings/stores` and `settings/properties` use:
  - Thin `page.tsx` → `_components/*-settings-page-client.tsx`
  - Dynamic import for heavy forms (`StoreForm`, `PropertyForm`)
  - Tabs (list vs verification), stat cards, create/delete dialogs
  - Hooks (`useMyStores`, `useMyProperties`) backed by browser facades

---

## 2. Refinement Checklist Status

### Boundary Refinement

- [ ] Remove leftover client-side DTO repair logic — **N/A** (no client UI yet)
- [ ] Replace repository-return aliases with explicit DTO mappers — **Recommended** for future hardening
- [x] Remove compatibility imports from `lib/services/*` — **Done** (domains are canonical)

### UI Refinement

- [ ] Split optional, heavy, or modal-only UI into route-local dynamic components — **Proposed** below
- [ ] Prefer extracted route-local components for large client pages — **Proposed** below
- [ ] Keep route-local skeletons and error surfaces aligned with layout — **Proposed** below

### Correctness Refinement

- [ ] Review hydration-sensitive rendering — **Defer** until UI exists
- [x] Replace full-page reload fallbacks with route-aware refetch — **Done** (CertificatesTab, DocumentsTab, LicensesTab all have `onRetry` + "Try again" button)
- [x] Ensure idempotency, optimistic locking, actor propagation — **API layer already enforces** via domain

### Documentation Refinement

- [ ] Update CHANGELOG.md when slice gains materially stricter boundary
- [ ] Update PROGRESS-SUMMARY.md when slice moves to refinement
- [ ] Update ADRs if change affects architectural rules

---

## 3. Proposed Staff-Level Implementation

### 3.1 Architecture Overview

Introduce a **Credentials** settings section that unifies documents, certificates, and licenses under one navigation entry, with tabs for each slice. This aligns with the stores/properties pattern and reduces route proliferation.

```
professional-portal/settings/
├── credentials/
│   ├── page.tsx                    # Thin shell
│   ├── loading.tsx                 # Route-level skeleton
│   ├── error.tsx                   # Route-level error boundary
│   └── _components/
│       ├── credentials-settings-page-client.tsx   # Main client (tabs)
│       ├── documents-tab.tsx       # Document list + create/edit
│       ├── certificates-tab.tsx    # Certificate list + create/edit
│       ├── licenses-tab.tsx        # License list + create/edit
│       ├── credential-card.tsx     # Shared list item (doc/cert/license)
│       ├── document-form-dialog.tsx # Create/Edit document (dynamic)
│       ├── certificate-form-dialog.tsx
│       ├── license-form-dialog.tsx
│       └── credential-upload-step.tsx  # Reusable upload → assetId flow
```

### 3.2 New Prerequisites

| Artifact                     | Purpose                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| `lib/documents-client.ts`    | Browser facade for `/api/professional-portal/documents`         |
| `lib/certificates-client.ts` | Browser facade for `/api/professional-portal/certificates`      |
| `lib/licenses-client.ts`     | Browser facade for `/api/professional-portal/licenses`          |
| `hooks/useDocuments.ts`      | TanStack Query hooks for documents                              |
| `hooks/useCertificates.ts`   | TanStack Query hooks for certificates                           |
| `hooks/useLicenses.ts`       | TanStack Query hooks for licenses                               |
| `lib/links.ts`               | Add `professionalPortalDocuments`, `professionalPortalLicenses` |

### 3.3 UI Refinement Guidelines Applied

1. **Split heavy/modal UI into route-local dynamic components**
   - `DocumentFormDialog`, `CertificateFormDialog`, `LicenseFormDialog` loaded via `next/dynamic` with `ssr: false` and a loading placeholder
   - Reduces initial route JS; forms only load when user opens create/edit

2. **Extract route-local components**
   - `credentials-settings-page-client.tsx` owns tabs and layout; each tab is a separate component
   - `credential-card.tsx` shared for doc/cert/license list items (with type-specific badges/labels)
   - Avoids large inline `page.tsx` blocks

3. **Route-level loading and error**
   - `credentials/loading.tsx`: Skeleton matching the tab layout (stat cards + list placeholder)
   - `credentials/error.tsx`: Error surface with retry, aligned with settings layout

4. **Upload flow**
   - `credential-upload-step.tsx`: Reusable component that calls `uploadFiles`, extracts `assetId` from `raw` response (upload API returns `assetId` in `uploaded` array), and passes `assetId` to form submit
   - **Note:** Current `upload-client` returns only `urls`; extend `UploadResult` to include `assetIds` or parse `raw` for `assetId` when creating documents/certificates/licenses

### 3.4 Settings Navigation Update

Add a "Credentials" card to `settings/page.tsx`:

```tsx
<Card>
  <CardContent>
    <h3>Credentials & Verification</h3>
    <p>Manage your documents, certificates, and professional licenses</p>
    <Button asChild variant="outline" size="sm">
      <Link href="/professional-portal/settings/credentials">
        <FileCheck className="mr-2 h-4 w-4" />
        Manage Credentials
      </Link>
    </Button>
  </CardContent>
</Card>
```

### 3.5 Upload Client Extension ✅ Implemented

- **`uploadFiles`** now returns `assetIds: string[]` in addition to `urls`. Parses both flat-array and legacy keyed API response formats.
- **`uploadForCredential(file, fieldName?)`** — convenience helper that validates, uploads, and returns `{ assetId, url }` for document/certificate/license creation.

### 3.6 Implementation Phases

| Phase | Scope                   | Deliverables                                                                                                                        |
| ----- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Browser facades + hooks | `documents-client`, `certificates-client`, `licenses-client`; `useDocuments`, `useCertificates`, `useLicenses`; `lib/links` updates |
| **2** | Upload extension        | `UploadResult.assetIds` or `uploadForCredential`                                                                                    |
| **3** | Credentials page shell  | `credentials/page.tsx`, `loading.tsx`, `error.tsx`; settings nav link                                                               |
| **4** | Documents tab           | `documents-tab.tsx`, `document-form-dialog.tsx`, `credential-card` (document variant)                                               |
| **5** | Certificates tab        | `certificates-tab.tsx`, `certificate-form-dialog.tsx`                                                                               |
| **6** | Licenses tab            | `licenses-tab.tsx`, `license-form-dialog.tsx`                                                                                       |
| **7** | Polish                  | Empty states, verification badges, delete confirmation, route tests                                                                 |

---

## 4. Domain DTO Recommendation (Future)

For stricter boundary refinement, introduce explicit DTOs in each domain:

```ts
// app/lib/domains/documents/contracts.ts
export type DocumentListItemDto = {
  id: string;
  category: string;
  title: string;
  issuer?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  status: string;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  asset?: {
    id: string;
    cdnUrl: string;
    originalName?: string;
    mimeType?: string;
    size?: number;
  } | null;
};
```

Domain service would map repository result → DTO before returning. Defer until credentials UI is stable.

---

## 5. Verification

- [ ] Typecheck: `pnpm exec tsc --noEmit` in `apps/client`
- [ ] Lint: `pnpm lint` in `apps/client`
- [ ] Tests: `pnpm test --run __tests__/api/professional-portal/documents __tests__/api/professional-portal/certificates __tests__/api/professional-portal/licenses __tests__/lib/domains/documents __tests__/lib/domains/certificates __tests__/lib/domains/licenses`
- [ ] Manual: Create/edit/delete document, certificate, license from credentials page
