# Project Escrow API

Sub-resource of `/api/professional-portal/projects/[id]`.

Manages milestone-linked escrow payment transactions with double-entry ledger accounting.

## Endpoints

### GET `/projects/[id]/escrow`

List all escrow transactions for a project with linked milestone info.

- **Auth**: Professional or Client (project participant)
- **Rate limit**: READ

### GET `/projects/[id]/escrow/[escrowId]`

Get escrow detail with full ledger entries.

- **Auth**: Professional or Client (project participant)
- **Rate limit**: READ

### POST `/projects/[id]/escrow/[escrowId]/fund`

Initiate funding (record payment reference).

- **Auth**: Project participant
- **Rate limit**: WRITE
- **Idempotency**: Critical — prevents double-funding
- **Guard**: Only from `PENDING_FUNDING` status
- **Body**: `{ referenceCode }`
- **Ledger**: DEBIT escrow_hold, CREDIT platform_receivable

### POST `/projects/[id]/escrow/[escrowId]/release`

Release funds to professional after milestone approval.

- **Auth**: Project participant
- **Rate limit**: WRITE
- **Idempotency**: Critical — prevents double-release
- **Guard**: Only from `FUNDS_HELD`, requires milestone `approvalStatus === APPROVED`
- **Ledger**: DEBIT professional_payable, CREDIT platform_fee, CREDIT tax entries
- **Finance side effects**: Creates `ProfessionalTransaction` (`INCOME`, `PROJECT_PAYMENT`, `SUCCESS`) so finance stats and transaction history remain consistent with escrow lifecycle
- **Side effects**: Marks milestone as paid

### POST `/projects/[id]/escrow/[escrowId]/dispute`

Flag a dispute on held funds.

- **Auth**: Project participant
- **Rate limit**: WRITE
- **Idempotency**: Supported
- **Guard**: Only from `FUNDS_HELD` status
- **Body**: `{ disputeReason }`
- **Side effects**: Flags project as disputed

## Escrow Status Transitions

```
PENDING_FUNDING -> FUNDS_HELD
FUNDS_HELD -> RELEASED, DISPUTED
DISPUTED -> REFUNDED, RELEASED (resolved)
```

## Payment Lifecycle Consistency

The canonical vertical flow is:

1. Milestone approval (`PENDING -> APPROVED`)
2. Escrow release guard validation (`FUNDS_HELD -> RELEASED`)
3. Ledger writes (double-entry)
4. Professional transaction write (`INCOME`)
5. Finance surfaces update (`/finance/stats`, `/finance/transactions`)

## Platform Commission and Fees

When creating escrow transactions, use `computePlatformFee` from `@build/db/system-settings` to calculate the platform fee from the current `platformCommission` setting:

```ts
import {
  computePlatformFee,
  getFinancialSettings,
} from "@build/db/system-settings";

// For a given milestone amount:
const platformFee = await computePlatformFee(amount);
const financial = await getFinancialSettings();
const vatAmount = (amount * financial.vatRate) / 100;
const withholdingTax = (amount * financial.withholdingTaxRate) / 100;
```

Set `platformFee`, `vatAmount`, and `withholdingTax` on the EscrowTransaction when creating it. The release flow uses these pre-stored values for ledger entries.

## Financial Data Protection

- Escrow amounts and M-Pesa references are never logged in plain text
- All mutations create immutable `LedgerEntry` records for financial audit
- Escrow records are retained for financial compliance (legal basis override for GDPR erasure)
