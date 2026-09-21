# Solo-Founder Governance & Incident Continuity Note

**Document Status:** Approved Baseline  
**Governing Statute:** Kenya Data Protection Act, 2019 (Section 24) • ADR-ADMIN-014  
**Evidence Date:** 2026-09-20  
**Owner:** Executive Architecture & Legal Operations  
**Next Review:** 2026-12-20

---

## 1. Operational Reality & Legal Context

Build Market operates under a solo-founder executive structure during its MVP alpha stage. While modern startup operations frequently lack large organizational hierarchies, Section 24 of the Kenya Data Protection Act and ADR-ADMIN-014 require that regulatory accountability and emergency incident response are durable and cannot fail due to single-person unavailability.

This document formally establishes the legal designation of the Data Protection Officer (DPO), emergency delegations, and the continuity protocol if the founder is unreachable during a critical 72-hour regulatory reporting window.

---

## 2. Statutory DPO Designation

- **Designated Officer:** Don Shammah (Founder & Principal Architect)
- **Official Capacity:** Acting Data Protection Officer (DPO) & Primary Regulatory Contact
- **Regulatory Authority:** Permitted under Kenya DPA 2019 and ODPC guidelines for emerging data controllers prior to hiring dedicated full-time compliance teams.
- **Dedicated Inbox:** `privacy@buildmarket.app` (monitored with high-priority mobile push notifications).

---

## 3. Emergency Incident Delegation & External Continuity Contacts

If a high-severity security incident (CRITICAL or HIGH per ADR-ADMIN-014) occurs while the founder is incapacitated, hospitalized, or unreachable for > 12 hours, authority to execute containment, forensic preservation, and statutory ODPC notification transfers sequentially to pre-authorized external proxies:

| Delegation Order                    | Role                                | Designated Entity / Contact                   | Scope of Emergency Authority                                             |
| ----------------------------------- | ----------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| **Primary (Default)**               | Founder & Incident Commander        | Don Shammah (`don@buildmarket.app`)           | Full operational, regulatory, and production break-glass authority       |
| **Secondary (Legal Proxy)**         | External Legal & Regulatory Counsel | Appointed Corporate Law Firm (Nairobi, Kenya) | Authority to file emergency 72-hour notifications directly with the ODPC |
| **Tertiary (Infrastructure Proxy)** | Fractional Cloud Security Engineer  | Pre-retained Infrastructure Consultant        | Emergency session revocation, database isolation, KMS secret rotation    |

---

## 4. Emergency Break-Glass & Credential Escrow

To prevent platform lockout during an active emergency (ADR-ADMIN-014):

1. **Encrypted Emergency Vault:**
   Production break-glass credentials (root AWS, Neon database admin, Clerk master dashboard) are stored in an encrypted multi-party vault.
2. **Time-Boxed Emergency Tokens:**
   Any emergency elevation generated during incident response expires automatically after 4 hours and requires re-authentication.
3. **Immutable Audit Logging:**
   Any activation of secondary or tertiary authority triggers immediate fail-closed audit log entries into `AdminAuditLog` with correlation tracking.
