# Data Protection Impact Assessment (DPIA)

**Document Status:** Approved Baseline  
**Governing Statute:** Kenya Data Protection Act, 2019 (Section 31)  
**Evidence Date:** 2026-09-20  
**Owner:** Privacy & Legal Architecture  
**Next Review:** 2026-12-20

---

## 1. Executive Summary & Purpose

Section 31 of the Kenya Data Protection Act 2019 requires data controllers to conduct a Data Protection Impact Assessment (DPIA) prior to processing operations that are likely to result in high risk to the rights and freedoms of data subjects.

Build Market processes professional contractor credentials, government regulatory numbers (NCA, EBK, BORAQS), geographic property coordinates, masked communications, and financial transaction records. This document systematically assesses the operational and technical risks, details mitigation measures, and establishes a binding ongoing screening checklist.

---

## 2. Risk-Scoring Rubric

Risks are evaluated using a standardized two-variable scoring matrix:
$$\text{Risk Score} = \text{Likelihood (1–5)} \times \text{Impact / Severity (1–5)}$$

| Score Range | Classification       | Required Action                                                            |
| ----------- | -------------------- | -------------------------------------------------------------------------- |
| **1 – 6**   | Low Risk             | Standard operational controls; periodic review                             |
| **8 – 12**  | Medium Risk          | Specific mitigation required; monitored in monthly audit                   |
| **15 – 25** | High / Critical Risk | Mandatory technical barrier, fail-closed enforcement, prior legal sign-off |

---

## 3. Systematic Assessment of Processing Operations

### Flow 1: Professional Onboarding & Statutory Trade Verification

- **Data Elements:** National ID numbers, NCA/EBK registration certificates, tax KRA PINs, business location coordinates.
- **Classification:** Class A (Restricted) and Class B (Sensitive).
- **Inherent Risk:**
  - _Likelihood: 3 (Moderate targeting of identity documents)_
  - _Severity: 4 (Risk of identity theft, professional credential forgery)_
  - _Inherent Score: 12 (Medium/High)_
- **Mitigation Controls Implemented:**
  - AES-256 transparent field encryption in persistence layers.
  - Verification artifacts stored in private S3 buckets with time-limited presigned URLs (no public bucket read).
  - PII scrubbing on all structured logs (ADR-005).
  - Admin verification operations require Tier 1 recent authentication (<180s) and append-only tamper-evident audit logging (ADR-ADMIN-001, ADR-ADMIN-008).
- **Residual Risk:** $2 \times 2 = \mathbf{4}$ (**Low Risk**).

### Flow 2: Homeowner Project Intake & Lead Routing

- **Data Elements:** Project description, estimated budget, physical county/neighborhood, contact phone number, in-app messages.
- **Classification:** Class B (Sensitive).
- **Inherent Risk:**
  - _Likelihood: 3 (Harassment, unsolicited spam, contractor circumvention)_
  - _Severity: 3 (Loss of privacy, unsolicited commercial marketing)_
  - _Inherent Score: 9 (Medium)_
- **Mitigation Controls Implemented:**
  - Masked disclosure: Homeowner telephone numbers and exact street addresses are withheld from contractors until the homeowner explicitly accepts a proposal.
  - In-app messaging gateway filters phone numbers and off-platform payment links.
  - Rate-limited API adapters prevent bulk scraping of homeowner project directories.
- **Residual Risk:** $1 \times 2 = \mathbf{2}$ (**Low Risk**).

### Flow 3: M-Pesa Payment & Financial Accounting

- **Data Elements:** M-Pesa phone number, Daraja transaction ID, billing amount, timestamp.
- **Classification:** Class A (Restricted).
- **Inherent Risk:**
  - _Likelihood: 2 (Targeted financial fraud)_
  - _Severity: 4 (Direct financial loss)_
  - _Inherent Score: 8 (Medium)_
- **Mitigation Controls Implemented:**
  - Zero platform custody (P0-7): Funds are never held in escrow or custodial wallets.
  - Webhook callback signature verification and idempotency replay deduplication (ADR-008).
  - Strict 7-year retention in anonymized ledgers per the Kenya Tax Procedures Act.
- **Residual Risk:** $1 \times 3 = \mathbf{3}$ (**Low Risk**).

---

## 4. Ongoing DPIA-Trigger Checklist for Future PRs

To ensure privacy compliance survives continuous development, any Pull Request touching the codebase must be evaluated against this trigger checklist:

- [ ] **New Prisma Model:** Does the PR add a database entity containing personal identifiers (name, email, phone, location, photo, ID number)?
- [ ] **Data Classification Upgrade:** Does the PR introduce or manipulate Class A or Class B data fields?
- [ ] **New Third-Party Integration:** Does the PR add an external API, SDK, or SaaS processor that receives user data?
- [ ] **Cross-Border Route:** Does the feature transfer data to a cloud region outside Kenya without an existing DPA?
- [ ] **Automated Decision-Making:** Does the PR implement algorithmic profiling or automated matching that materially impacts professional ranking or work assignment?

_If any box is checked, a dedicated DPIA review addendum and architecture approval is required before merging to `main`._
