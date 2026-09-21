# Subprocessor & Vendor Inventory

**Document Status:** Approved Baseline  
**Governing Statute:** Kenya Data Protection Act, 2019 (Section 23) / GDPR Article 28  
**Evidence Date:** 2026-09-20  
**Owner:** Platform Security & Legal Engineering  
**Next Review:** 2026-12-20

---

## 1. Subprocessor Registry

The following third-party processors are authorized to process personal data on behalf of Build Market Technologies Ltd. Each vendor is subject to executed Data Processing Addenda (DPAs) with Standard Contractual Clauses (SCCs) and periodic security reviews.

| Vendor Legal Entity               | Corporate Seat   | Service Provided                                                    | Data Classes Handled (ADR-006)                                         | DPA Status / Executed Date                       | Transfer Safeguard                                    | Downstream Sub-Subprocessors                       | Certifications                             |
| --------------------------------- | ---------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| **Clerk Inc.**                    | Delaware, USA    | Authentication, Identity Verification, Session Management           | Class A (tokens), Class B (email, phone hash), Class C                 | Executed (2026-01-15)                            | Standard Contractual Clauses (SCC)                    | Amazon Web Services (AWS), Cloudflare              | SOC 2 Type II, ISO 27001                   |
| **Amazon Web Services EMEA SARL** | Luxembourg / USA | Cloud Infrastructure, Object Storage (S3), Managed Encryption (KMS) | Class B (contractor licenses, national IDs), Class C                   | Executed via AWS Customer Agreement (2026-01-10) | AWS DPA with SCCs; ISO 27018 Data Privacy             | Level 3 Data Centers, Internal Regional Transit    | SOC 1/2/3, ISO 27001, ISO 27018, FedRAMP   |
| **Neon Inc.**                     | Delaware, USA    | Serverless Server-Side PostgreSQL Database                          | Class A (encrypted PINs), Class B (masked contacts, profiles), Class C | Executed (2026-02-01)                            | Commercial DPA; TLS-Enforced Transit; AES-256 Storage | Amazon Web Services (AWS us-east-1)                | SOC 2 Type II                              |
| **Safaricom PLC**                 | Nairobi, Kenya   | Daraja M-Pesa Payment Gateway (B2C & STK Push)                      | Class A (M-Pesa payment tokens), Class B (billing phone number)        | Executed Merchant Agreement (2026-01-20)         | Domestic Processing; CBK Regulatory Oversight         | In-house National Telecom Infrastructure           | ISO 27001, CBK Regulated PSP               |
| **Resend Inc.**                   | California, USA  | Transactional Email & Security Alert Dispatch                       | Class B (recipient email address, system notification copy)            | Executed (2026-02-10)                            | Commercial DPA with SCCs                              | Amazon Web Services (SES), Cloudflare              | SOC 2 Type II                              |
| **Africa's Talking Ltd**          | Nairobi, Kenya   | Transactional SMS Alerts & OTP Verification                         | Class B (mobile phone numbers, alert text)                             | Executed Service Agreement (2026-01-18)          | Domestic Processing; CAK / DPA Licensed               | Local Mobile Network Operators (Safaricom, Airtel) | Communications Authority of Kenya Licensed |
| **Cloudflare Inc.**               | California, USA  | Edge Security, DDoS Mitigation, Web Application Firewall (WAF)      | Class C (request IP, user agent, correlation IDs)                      | Executed Enterprise Agreement (2026-01-12)       | Standard Contractual Clauses (SCC)                    | Cloudflare Edge Points of Presence                 | SOC 2 Type II, ISO 27001, PCI-DSS Level 1  |

---

## 2. Downstream Chain Disclosures

Under Section 23 of the Kenya Data Protection Act, controllers must ensure that subprocessors bind any downstream processors to obligations no less restrictive than the primary controller-processor contract.

1. **Clerk Downstream Chain:**
   - Primary compute & cache: AWS US East (N. Virginia).
   - Edge routing: Cloudflare CDN.
   - Clerk maintains direct SOC 2 Type II audit reports verifying strict access control and zero third-party cross-tenant access.
2. **Neon Database Downstream Chain:**
   - Storage layer: Encrypted AWS EBS volumes.
   - WAL Archival: Encrypted AWS S3 object buckets.
   - All persistence is isolated per-tenant with transparent volume encryption.
3. **Email (Resend) Downstream Chain:**
   - Message routing: Amazon SES.
   - Data handling: Messages processed in-flight with zero secondary data mining or analytical retention.

---

## 3. Subprocessor Review & Onboarding Policy

Build Market enforces the following criteria before onboarding any new subprocessor touching Class A or Class B data:

- Prior execution of a formal DPA specifying adherence to Kenya DPA 2019 / GDPR Art 28.
- Independent third-party security verification (SOC 2 Type II or ISO 27001).
- Inclusion in the public customer disclosure table on the [Privacy Policy](file:///apps/client/app/legal/privacy/page.tsx).
- 30-day prior written notice to registered enterprise and professional data subjects prior to onboarding new processing entities.
