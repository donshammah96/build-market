# Cross-Border Data Transfer Assessment

**Document Status:** Approved Baseline  
**Governing Statute:** Kenya Data Protection Act, 2019 (Sections 48 & 49)  
**Evidence Date:** 2026-09-20  
**Owner:** Privacy & Legal Architecture  
**Next Review:** 2026-12-20

---

## 1. Statutory Context

Sections 48 and 49 of the Kenya Data Protection Act, 2019 establish strict conditions for transferring personal data outside the territory of Kenya:

1. **Appropriate Safeguards:** The data controller or processor must confirm adequate safeguards (e.g., binding corporate rules, Standard Contractual Clauses) protecting personal data.
2. **Adequacy Determination:** The recipient country must maintain legal frameworks providing equivalent protection to Kenya's DPA 2019.
3. **Explicit Consent / Necessity:** Transfers must be strictly necessary for the performance of a contract, legal obligation, or approved by the data subject with informed consent.

Build Market Technologies Ltd operates modern distributed cloud infrastructure to power marketplace matchmaking, document verification, payments, and messaging. This document details the statutory assessment for every third-party processing entity handling data originating in Kenya.

---

## 2. Assessment Matrix by Subprocessor

| Subprocessor                                  | Corporate Seat         | Nature of Personal Data                                          | Primary Processing Region           | Statutory Legal Basis (§48/49)                                      | Contractual & Technical Safeguards                                                                                                          | Residual Transfer Risk |
| --------------------------------------------- | ---------------------- | ---------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Clerk Inc.**                                | United States          | User identity, auth tokens, email, phone hashes                  | AWS US-East / Global CDN            | DPA with Standard Contractual Clauses (SCCs); Contractual Necessity | SOC 2 Type II, ISO 27001; TLS 1.3 in transit; Session tokens salt-hashed                                                                    | **Low**                |
| **Amazon Web Services (AWS) / Cloudflare R2** | United States / Global | Contractor credentials, identity cards, project images           | US-East / EU-West / Global Edge     | AWS GDPR/DPA Data Processing Addendum; SCCs                         | Envelope encryption using AWS KMS (AES-256); Time-limited presigned S3 URLs (7-day max for exports); Zero public bucket access              | **Low**                |
| **Neon Inc. / AWS RDS**                       | United States          | Relational marketplace database (profiles, quotes, projects)     | US-East (Virginia) / AWS eu-central | Commercial DPA; Contractual Necessity                               | PostgreSQL TLS-enforced connections; Transparent data encryption at rest (AES-256-GCM); Field-level encryption for Class A/B data (ADR-006) | **Low**                |
| **Resend Inc.**                               | United States          | Transactional emails, breach notifications, user email addresses | United States                       | Commercial DPA; Service Performance                                 | Encrypted in transit; Zero long-term storage of email body text post-delivery                                                               | **Low**                |
| **Africa's Talking Ltd**                      | Kenya                  | SMS notifications, recipient phone numbers                       | Nairobi, Kenya                      | Domestic Processing (No cross-border transfer)                      | Local carrier interconnects; Kenya DPA compliant data processing terms                                                                      | **Negligible**         |
| **Safaricom PLC (Daraja API)**                | Kenya                  | M-Pesa phone numbers, transaction amounts, reference codes       | Nairobi, Kenya                      | Domestic Processing (No cross-border transfer)                      | Regulated by Central Bank of Kenya (CBK); Encrypted B2C/STK push channels; IP-whitelisted webhook endpoints                                 | **Negligible**         |
| **Twilio Inc. (Fallback)**                    | United States          | International SMS alerts & fallback telephony                    | United States                       | DPA with SCCs; Emergency Alert Necessity                            | Encrypted transit; PII redaction on message logging                                                                                         | **Low**                |

---

## 3. Technical Safeguards Enforced

To satisfy the stringent requirements of DPA Section 48(b), Build Market implements multi-layer technical barriers:

1. **Field-Level Transparent Encryption:**
   All Class A restricted fields (KRA PINs, payment credentials) and Class B verification documents stored in Neon/RDS are encrypted using AES-256-GCM prior to crossing network adapters.
2. **Regional Edge Caching Protections:**
   Client sessions and assets routed through Cloudflare CDN enforce strict Geo-IP headers and do not store plain-text biometric or identity artifacts at edge nodes.
3. **Zero-PII Telemetry Policy (ADR-005 & ADR-ADMIN-003):**
   Third-party APM and observability sinks (Datadog, OpenTelemetry) strictly scrub `userId`, `userEmail`, `phone`, and national ID numbers, preventing incidental foreign PII leakage.

---

## 4. Transfer Fallback & Sovereignty Roadmap

If the Office of the Data Protection Commissioner (ODPC) issues revised guidelines restricting transfers to US jurisdictions, Build Market maintains the following contingency path:

1. **Database Migration to Local/EU Nodes:** Neon and RDS can pin PostgreSQL cluster instances to AWS Cape Town (`af-south-1`) or Frankfurt (`eu-central-1`).
2. **Self-Hosted Storage Sinks:** Object storage can fail over to MinIO instances hosted on local sovereign cloud providers within Nairobi.
