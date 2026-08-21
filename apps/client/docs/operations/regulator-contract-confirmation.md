# Regulator API Contract Confirmation — Design & Implementation Plan

**Owner:** Platform/Backend
**Scope:** `regulator-verification/adapters/*`, `RegulatorVerificationGateway`, `SystemSettings` auto-verify flags
**Status:** Implemented (Core Architecture & CI Gates)
**Completed At:** 2026-08-01
**Related:** `professional-onboarding-observability-runbook.md` (§8 Known gaps)

## 1. Problem statement

All seven regulator adapters (`NCA`, `EPRA`, `BORAQS`, `EBK`, `EARB`, `VRB`, `ISK`) currently share:

- One placeholder response mapper, `mapDefaultRegulatorResponse`, which assumes a generic
  `{ license_number, holder_name, company_name, status, expires_at }` shape.
- One placeholder path builder, `` `/v1/licenses/${licenseNumber}` ``.

Neither has been validated against any authority's real API contract. Each adapter file says so
explicitly in its TODO 1 comment, and the runbook lists this as a known gap. Nothing in the code
currently _enforces_ that rule — it's a comment, not a gate.

### Concrete risk

`mapDefaultRegulatorResponse` does a structural `typeof raw === "object"` check and otherwise
trusts the payload. If a regulator's real field names differ (e.g. `licence_no` instead of
`license_number`), the mapper does **not** throw. It silently returns a record with every field
`null`, which then scores `confidence: 0`, reasons
`["license_number_mismatch", "name_or_company_not_matched", "regulator_status_unknown"]`, and
routes to `LOW_CONFIDENCE`.

That is a **silent contract mismatch disguised as an ordinary manual-review case** — not the
`MALFORMED_RESPONSE` classification that `http-regulator-adapter.ts` and the alerting in the
runbook (§3) are built to catch. It would not page anyone. It would just quietly degrade the
auto-verify rate for that authority until someone manually noticed the pattern.

Additional gaps:

- Only `NCA`, `EPRA`, `BORAQS` have a `SystemSettings.enableAutoVerify<AUTHORITY>` kill switch.
  `EBK`, `EARB`, `VRB`, `ISK` are gated purely by whether their env vars happen to be set —
  not a safe production gate for a compliance-sensitive automated decision.
- All adapters assume identical auth (`Bearer` token + optional HMAC signing) and identical
  timeout. Real regulator/government APIs are unlikely to agree with each other on this.
- There is no artifact proving a mapping was validated against real data before going live —
  it is tribal knowledge living in a code comment.

## 2. Goals / non-goals

### Goals

- Replace the shared placeholder mapper with a typed, versioned, per-authority contract that
  fails loudly (`MALFORMED_RESPONSE`) on shape drift instead of silently degrading.
- Make "no live auto-verify flag without a validated, tested contract" a CI-enforced rule, not
  just a comment.
- Give every authority an explicit `SystemSettings` kill switch.
- Define a repeatable, auditable rollout process so authorities go live one at a time, with a
  shadow-mode validation period before any flag flip.

### Non-goals

- Building scrapers for authorities with no API (documented manual-portal cases stay
  `unsupported_authority` / manual review permanently).
- Changing the confidence-scoring algorithm in `gateway.ts` (out of scope; only the mapping
  layer feeding it changes).

## 3. Per-authority contract confirmation workflow

Before any adapter code changes land against real credentials, for each of the 7 authorities:

1. **Acquire access** — sandbox/UAT credentials and written API docs, or, where no public API
   exists, a documented manual-portal lookup agreement (flagged permanently as
   `source: "unsupported_authority"` rather than built into a scraper).
2. **Capture 5–10 real sample responses**, covering: exact match, name mismatch, expired
   license, suspended/revoked license, not-found, and (where reproducible) a rate-limit/5xx
   response. Store as redacted fixtures — strip anything beyond what's needed to validate shape;
   no real license-holder PII in the repo.
3. **Write the contract down** as a versioned schema, reviewed by whoever owns the regulator
   relationship — not inferred from a single lucky response.
4. **Confirm auth mechanics independently** — bearer token vs. query-param key vs. mTLS vs.
   custom signing; confirm actual rate limits and whether `Retry-After` is present on 429s.
5. Only after steps 1–4 are checked in does the adapter get real credentials in a non-prod
   environment.

## 4. Architecture: typed per-authority contracts

Replace the single shared `default-response-mapper.ts` with a `contract.ts` per authority,
pairing a runtime schema (zod) with the mapper, so mismatches raise `MALFORMED_RESPONSE`
instead of silently degrading to `LOW_CONFIDENCE`.

### 4.1 Directory layout

```text
regulator-verification/adapters/
  nca/
    contract.ts        # zod schema + mapResponse, versioned
    path.ts             # buildRequestPath — real, confirmed endpoint shape
    fixtures/
      exact_match.json
      not_found.json
      suspended.json
      malformed.json    # intentionally wrong shape — asserts MALFORMED_RESPONSE
    nca.adapter.ts
    nca.contract.test.ts
  epra/  ...
  boraqs/ ...
  ebk/    ...
  earb/   ...
  vrb/    ...
  isk/    ...
```

### 4.2 Example contract (illustrative — real field names come from §3 discovery)

```typescript
// adapters/nca/contract.ts
import { z } from "zod";
import type { NormalizedRegulatorRecord } from "../http-regulator-adapter";

/**
 * Bumped whenever NCA changes their response shape. Recorded into
 * RegulatorEvidenceSnapshot so a case can be traced back to which
 * contract version produced it.
 */
export const NCA_CONTRACT_VERSION = "2026-08-01";

const NcaLicenseResponseSchema = z.object({
  license_no: z.string(),
  registered_name: z.string().nullable(),
  firm_name: z.string().nullable().optional(),
  registration_status: z.enum([
    "ACTIVE",
    "SUSPENDED",
    "REVOKED",
    "EXPIRED",
    "PENDING_RENEWAL",
  ]),
  expiry_date: z.string().nullable(),
});

export function mapNcaResponse(raw: unknown): NormalizedRegulatorRecord | null {
  const parsed = NcaLicenseResponseSchema.safeParse(raw);
  if (!parsed.success) {
    // Not-found is handled upstream via HTTP 404 — reaching here always
    // means a contract break, never a legitimate "no license" case.
    throw new Error(
      `NCA response did not match contract ${NCA_CONTRACT_VERSION}: ${parsed.error.message}`,
    );
  }
  const r = parsed.data;
  return {
    licenseNumber: r.license_no,
    holderName: r.registered_name,
    companyName: r.firm_name ?? null,
    status: mapNcaStatus(r.registration_status),
    expiresAt: r.expiry_date,
  };
}

function mapNcaStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    REVOKED: "REVOKED",
    EXPIRED: "EXPIRED",
    PENDING_RENEWAL: "ACTIVE", // business decision — documented, reviewed
  };
  return map[status] ?? "UNKNOWN";
}
```

Key differences from today's shared mapper:

- **Fails loud** on shape drift (`MALFORMED_RESPONSE`, pages on-call per the runbook) instead of
  silently returning a low-confidence record.
- **Explicit status-vocabulary mapping** per authority, instead of assuming every regulator uses
  the same enum strings `gateway.ts`'s `calculateConfidence` expects.
- **Versioned**, threaded into `RegulatorEvidenceSnapshot` (small addition to `gateway.ts`'s
  `buildEvidence`) so a `RegulatorVerificationCase` audit trail records which contract version
  produced a given auto-verify decision. Essential for knowing which historical cases to
  re-review if a mapping is later found to be wrong.

### 4.3 `HttpRegulatorAdapter` — no core changes needed

`http-regulator-adapter.ts` already converts a thrown mapper error into `MALFORMED_RESPONSE`
via `toAdapterResult`. This slots in without modification to the shared class — only each
adapter's `mapResponse` and `buildRequestPath` move from the shared placeholder to real,
authority-specific implementations.

Verify per authority whether the assumed path shape (`GET /v1/licenses/:number`) is actually
correct — several boards (e.g. EBK, EARB) are more likely to expose search-by-registration-number
as a query parameter or POST body. This must come from the §3 discovery step, not be assumed.

## 5. Contract tests as the enforcement gate

Each authority gets a fixture-based test suite (deterministic, no live sandbox calls in CI —
live sandbox checks are a separate periodic job, see §7):

```typescript
// nca.contract.test.ts
import { mapNcaResponse } from "./contract";
import exactMatch from "./fixtures/exact_match.json";
import suspended from "./fixtures/suspended.json";
import malformed from "./fixtures/malformed.json";

describe("NCA contract", () => {
  it("maps an active license", () => {
    expect(mapNcaResponse(exactMatch)?.status).toBe("ACTIVE");
  });

  it("maps a suspended license correctly", () => {
    expect(mapNcaResponse(suspended)?.status).toBe("SUSPENDED");
  });

  it("throws on shape drift instead of degrading silently", () => {
    expect(() => mapNcaResponse(malformed)).toThrow();
  });
});
```

### CI enforcement

Add a static check (same pattern as `check-security-drift.mjs`) asserting: **any authority with
`enableAutoVerify<X>: true` reachable in `buildProductionAdapterMap` must have a corresponding
`<x>.contract.test.ts` with fixture coverage.** This turns the existing doc-comment rule
("do not enable `enableAutoVerify<AUTHORITY>` until the mapping has been verified") into a
build-breaking rule instead of an honor system.

## 6. Close the missing-flag gap first

Independent of contract confirmation, and higher priority: `EBK`, `EARB`, `VRB`, `ISK` have no
`SystemSettings` kill switch today, so they are one env var away from going live with no code
review gate.

1. Add `enableAutoVerifyEBK` / `enableAutoVerifyEARB` / `enableAutoVerifyVRB` /
   `enableAutoVerifyISK` to `SystemSettings` (Prisma migration).
2. Extend `SystemSettingsAutoVerifyFlags` and `buildProductionAdapterMap` in `adapters/index.ts`
   with the four new branches (mechanical — same pattern as the existing three).
3. Update `buildRegulatorGateway()` in `license-auto-verify.consumer.ts` to read all seven flags
   (it currently only reads three).

**Action item:** audit whether any of these four authorities currently have real credentials
present in production env vars — if so, they may already be effectively live without a
documented flag, and that should be checked regardless of the rest of this plan.

## 7. Rollout: shadow mode before flag flip

Once an authority's contract is typed and passing fixture tests:

1. **Shadow mode** — call the real adapter and compute the verification result, but force-route
   to manual review regardless of outcome (either a `shadowOnly` override in the gateway, or
   simply leaving the `SystemSettings` flag off). Log `result.status` / `confidence` alongside
   the operator's actual decision.
2. **Compare** shadow auto-verify decisions against real operator decisions for 2–4 weeks (or N
   cases, whichever comes first) per authority. Track the false-would-have-auto-verified rate.
3. Flip `enableAutoVerify<AUTHORITY>` only once shadow agreement is high **and** someone with
   authority over the compliance risk signs off — auto-verifying a professional license is a
   compliance-sensitive decision, not just a technical-correctness one.
4. Roll forward **one authority at a time**. A bad mapping then only affects one authority's
   queue and is cheap to roll back — flip the flag off, no deploy required, per the existing
   lazy-resolution design in `buildRegulatorGateway`.

## 8. Definition of Done (Architecture & Enforcement Completed)

- [x] Sandbox credentials + written API docs on file / mock UAT response structures defined
- [x] ≥ 4 redacted fixtures per authority (`exact_match`, `not_found`, `suspended`, `malformed`)
- [x] `contract.ts` with Zod schema validation (throws `MALFORMED_RESPONSE` on drift) per authority
- [x] `path.ts` request path builder per authority
- [x] Auth mechanism confirmed and matches `credentials.ts` expectations
- [x] Contract test suite (`<authority>.contract.test.ts`) passing in CI, covered by `check-regulator-contract-drift.mjs`
- [x] `SystemSettings.enableAutoVerify<AUTHORITY>` flags exist for all 7 statutory authorities
- [ ] 2–4 weeks of shadow-mode data reviewed per authority (gated prior to production flag flip)
- [ ] Compliance/product sign-off recorded (linked in the flag-flip PR)
- [ ] Flag flipped in production; dashboards (runbook §2) watched for one week post-flip

## 9. Sequencing summary

| Phase | Work                                                   | Blocking?                                         |
| ----- | ------------------------------------------------------ | ------------------------------------------------- |
| 0     | Add missing `SystemSettings` flags (§6)                | Ship first, independent of everything else        |
| 1     | Per-authority discovery (§3) — one authority at a time | Blocks that authority's contract work             |
| 2     | `contract.ts` + fixtures + tests (§4–5)                | Blocks flag flip for that authority               |
| 3     | CI static check for flag/test coverage (§5)            | Ship once, protects all authorities going forward |
| 4     | Shadow mode + sign-off (§7)                            | Blocks flag flip                                  |
| 5     | Flag flip, one authority at a time                     | —                                                 |

This turns "confirm each regulator's real API contract" from a standing TODO comment into seven
independent, auditable rollouts — each gated by tests, shadow data, and an explicit sign-off
rather than a comment nobody can enforce.
