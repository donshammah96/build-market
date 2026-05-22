# Onboarding Workflow: Primary Path and Dependency Graph

Date: 2026-04-14
Scope: apps/client runtime onboarding workflow only (entry -> UI -> API -> domain -> DB).

## 1. Strict Primary Execution Path (runtime only)

1. Auth entry and post-auth transition into onboarding-aware routing.
   - app/sign-up/[[...sign-up]]/page.tsx
   - app/sign-in/[[...sign-in]]/page.tsx
   - app/professional/sign-up/[[...sign-up]]/page.tsx
   - app/verify/page.tsx
   - app/auth-callback/page.tsx

2. Middleware gates route access and enforces onboarding state.
   - middleware.ts
   - app/lib/security/middleware/route-matcher.ts
   - app/lib/security/middleware/onboarding-resolver.ts
   - app/lib/security/middleware/redirect-policy.ts
   - app/lib/security/middleware/decision-log.ts

3. Onboarding UI route orchestrates step state and form rendering.
   - app/onboarding/page.tsx
   - app/onboarding/loading.tsx
   - app/onboarding/error.tsx
   - app/onboarding/\_hooks/useOnboarding.ts
   - app/onboarding/\_components/OnboardingView.tsx
   - app/onboarding/\_components/RoleCard.tsx
   - app/onboarding/\_components/StepIndicator.tsx

4. Active onboarding forms capture homeowner/professional data and upload documents.
   - components/forms/HomeownerForm.tsx
   - components/forms/ProfessionalForm.tsx
   - components/forms/professional-wizard/index.ts
   - components/forms/professional-wizard/ProfessionStep.tsx
   - components/forms/professional-wizard/DetailsStep.tsx
   - components/forms/professional-wizard/StoreStep.tsx
   - components/forms/professional-wizard/PropertyStep.tsx
   - components/forms/professional-wizard/CredentialsStep.tsx
   - components/forms/professional-wizard/DocumentsStep.tsx
   - components/forms/professional-wizard/ReviewStep.tsx
   - components/forms/professional-wizard/types.ts
   - components/forms/StoreForm.tsx
   - components/forms/MultiStoreForm.tsx
   - components/forms/MultiPropertyForm.tsx
   - components/ui/step-progress.tsx

5. Browser facade and route constants call onboarding API endpoints.
   - lib/onboarding-client.ts
   - lib/api-client-utils.ts
   - lib/links.ts

6. Onboarding API adapters implement submit/skip/upload surfaces.
   - app/api/onboarding/route.ts
   - app/api/onboarding/skip/route.ts
   - app/api/onboarding/skip-professional/route.ts
   - app/api/onboarding/uploads/route.ts

7. Domain and persistence layer execute business rules, metadata finalization, and idempotency.
   - app/lib/domains/user-profile/onboarding.ts
   - app/lib/domains/user-profile/completion.ts
   - app/lib/domains/user-profile/client-type-compliance.ts
   - app/lib/domains/user-profile/clerk-metadata.ts
   - app/lib/domains/user-profile/index.ts
   - app/lib/domains/uploads/index.ts
   - app/lib/domains/uploads/service.ts
   - app/lib/domains/uploads/repository.ts
   - app/lib/services/idempotency.service.ts
   - app/lib/security/roles.ts
   - app/lib/auth/clerk-claim-refresh.ts
   - packages/types/src/auth.ts
   - packages/db/prisma/schema.prisma

## 2. Dependency Graph (entry page -> domain -> DB)

```mermaid
flowchart TD
  subgraph Entry
    SU[app/sign-up/[[...sign-up]]/page.tsx]
    SI[app/sign-in/[[...sign-in]]/page.tsx]
    PSU[app/professional/sign-up/[[...sign-up]]/page.tsx]
    VF[app/verify/page.tsx]
    AC[app/auth-callback/page.tsx]
  end

  subgraph Guarding
    MW[middleware.ts]
    RM[app/lib/security/middleware/route-matcher.ts]
    ORS[app/lib/security/middleware/onboarding-resolver.ts]
    RP[app/lib/security/middleware/redirect-policy.ts]
    DL[app/lib/security/middleware/decision-log.ts]
  end

  subgraph UI
    ONB[app/onboarding/page.tsx]
    HOOK[app/onboarding/_hooks/useOnboarding.ts]
    VIEW[app/onboarding/_components/OnboardingView.tsx]
    HF[components/forms/HomeownerForm.tsx]
    PF[components/forms/ProfessionalForm.tsx]
    WIZ[components/forms/professional-wizard/*]
    FORMS[components/forms/StoreForm.tsx + MultiStoreForm.tsx + MultiPropertyForm.tsx]
    STEP[components/ui/step-progress.tsx]
  end

  subgraph ClientBoundary
    OC[lib/onboarding-client.ts]
    APIUTIL[lib/api-client-utils.ts]
    LINKS[lib/links.ts]
    CLAIMS[app/lib/auth/clerk-claim-refresh.ts]
  end

  subgraph ApiAdapters
    API1[app/api/onboarding/route.ts]
    API2[app/api/onboarding/skip/route.ts]
    API3[app/api/onboarding/skip-professional/route.ts]
    API4[app/api/onboarding/uploads/route.ts]
    IDEMP[app/lib/services/idempotency.service.ts]
  end

  subgraph Domain
    UPO[app/lib/domains/user-profile/onboarding.ts]
    UPC[app/lib/domains/user-profile/completion.ts]
    UPCT[app/lib/domains/user-profile/client-type-compliance.ts]
    CLERK[app/lib/domains/user-profile/clerk-metadata.ts]
    UPS[app/lib/domains/uploads/service.ts]
    UPR[app/lib/domains/uploads/repository.ts]
    ROLES[app/lib/security/roles.ts]
  end

  subgraph Data
    TYPES[packages/types/src/auth.ts]
    DB[@build/db prisma client]
    SCHEMA[packages/db/prisma/schema.prisma]
  end

  SU --> AC
  SI --> AC
  VF --> AC
  PSU --> PF

  AC --> MW
  MW --> RM
  MW --> ORS
  MW --> RP
  MW --> DL
  MW --> ONB

  ONB --> HOOK
  HOOK --> VIEW
  VIEW --> HF
  VIEW --> PF
  PF --> WIZ
  PF --> FORMS
  PF --> STEP

  HOOK --> OC
  HF --> OC
  PF --> OC
  HOOK --> CLAIMS
  AC --> CLAIMS
  HOOK --> LINKS
  OC --> LINKS
  OC --> APIUTIL

  OC --> API1
  OC --> API2
  OC --> API3
  OC --> API4

  API1 --> UPO
  API2 --> UPO
  API3 --> UPO
  API4 --> UPS

  API1 --> IDEMP
  API2 --> IDEMP
  API3 --> IDEMP

  API1 --> CLERK
  API2 --> CLERK
  API3 --> CLERK

  UPO --> UPC
  UPO --> UPCT
  UPO --> UPS
  UPS --> UPR

  API1 --> ROLES
  API2 --> ROLES
  API3 --> ROLES
  UPO --> ROLES

  API1 --> TYPES
  UPO --> TYPES

  UPO --> DB
  UPR --> DB
  DB --> SCHEMA
```

Primary-path notes:

- This graph intentionally excludes tests, scripts, preview routes, and docs.
- app/actions/onboarding.ts is an alternate server-action surface and is not imported by the active onboarding route hook/form path.
- app/api/onboarding/professional/complete/route.ts is a post-onboarding completion surface and is not on the primary onboarding submission path.
