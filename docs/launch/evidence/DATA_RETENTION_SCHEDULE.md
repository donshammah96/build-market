# Data Retention & Disposal Schedule

**Document Status:** Approved Baseline  
**Governing Statutes:** Kenya Data Protection Act 2019 (§39, §40) • Tax Procedures Act 2015 (§23) • Companies Act 2015  
**Evidence Date:** 2026-09-20  
**Owner:** Compliance Architecture  
**Next Review:** 2026-12-20

---

## 1. Statutory Retention Principles

The Kenya Data Protection Act (Section 39) mandates that personal data must not be kept longer than necessary for the purpose for which it was collected, unless retention is required by another written law.

In the Kenyan marketplace context:

1. **Tax & Financial Priority:** Section 23 of the Tax Procedures Act mandates retaining books of accounts and records of all business transactions for a minimum of **seven (7) years**. Right-to-erasure requests do not delete transactional rows; instead, personal contact identifiers are scrubbed while financial sums and reference codes are preserved.
2. **Safety & Dispute Priority:** Professional verification artifacts and signed project contracts are retained for **two (2) years** following account deactivation to resolve construction defect claims and statutory inquiries.
3. **Minimization of Ephemeral Data:** Data portability export zip archives, unverified registration drafts, and temporary test fixtures are expunged automatically after short retention windows.

---

## 2. Retention Schedule by Entity Type

| Data Domain / Entity                    | Database / Storage Model                               | Target Retention Period      | Statutory / Business Justification                    | Automated Disposal Mechanism                                                  |
| --------------------------------------- | ------------------------------------------------------ | ---------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Financial & M-Pesa Ledgers**          | `MpesaTransaction`, `Order`, `ProfessionalTransaction` | **7 Years**                  | Tax Procedures Act 2015 (§23); KRA Audit Compliance   | Anonymization of customer name/phone post-account closure; ledger kept intact |
| **Tamper-Evident Audit Trails**         | `AdminAuditLog`                                        | **7 Years**                  | ADR-ADMIN-008 & ADR-ADMIN-015 Compliance Governance   | Append-only database partition; zero hard delete                              |
| **Professional Verification Artifacts** | `ProfessionalDocument`, `ProfessionalLicense`          | **Active Profile + 2 Years** | Kenya Building Code & NCAB dispute limitation periods | S3 lifecycle rule; batch deletion worker upon expiration                      |
| **Inactive / Unconverted Leads**        | `Lead`, `MarketplaceLeadRoutingEvent`                  | **180 Days**                 | Data Minimization; stale lead protection              | Nightly BullMQ `data-retention` cleanup cron                                  |
| **Unverified Onboarding Drafts**        | `ProfessionalProfile` (Pending draft)                  | **30 Days**                  | Abandoned onboarding hygiene                          | BullMQ daily maintenance job                                                  |
| **User Data Portability Exports**       | `DataExport`, S3 Export Archives                       | **7 Days**                   | DPA Section 40 Portability Fulfillment                | Nightly BullMQ `asset-cleanup` worker + S3 bucket auto-expiry                 |
| **User Erasure Grace Period**           | `User` (Deactivated status)                            | **30 Days**                  | User dispute & accidental deletion recovery           | `gdpr-erasure` background worker after 30d grace                              |
| **Security Incident Records**           | `SecurityIncident`                                     | **5 Years**                  | ODPC regulatory reporting & incident defense          | Secure archive with restricted read permissions                               |

---

## 3. Automated Reconciliation & Drift Detection

To guarantee that retention schedules are actively executed rather than remaining theoretical commitments:

1. **Daily Cleanup Cron Execution:**
   - BullMQ daemon executes `data-retention` at 02:00 UTC and `asset-cleanup` at 04:00 UTC (ADR-ADMIN-015 / `JOBS-QUEUES-RUNBOOKS.md`).
2. **Weekly Reconciliation Report:**
   - A reconciliation script audits the database for candidates exceeding the retention window:
     $$\text{Drift Count} = \text{Count}(\text{Records with } \text{createdAt} < \text{Schedule Deadline}) - \text{Whitelisted Tax Records}$$
   - Any non-zero drift count emits a high-priority alert (`retention.reconciliation.drift_count > 0`) to `compliance-notifications` and on-call engineering.
3. **Cryptographic Verification of Erasure:**
   - User account anonymization replaces `email`, `phone`, and `nationalId` with synthetic cryptographic hashes (`anonymized-<uuid>@buildmarket.internal`), verified by automated test suites.
