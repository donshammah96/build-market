# Verification Policies and Service Level Agreements (SLAs)

## Overview

This document outlines the verification policies, quality standards, and service level agreements (SLAs) for the Build Market verification system. These policies ensure consistent, fair, and timely verification of professionals, stores, and properties.

---

## Table of Contents

1. [Verification Policies](#verification-policies)
2. [Service Level Agreements (SLAs)](#service-level-agreements-slas)
3. [Quality Standards](#quality-standards)
4. [Priority Levels](#priority-levels)
5. [Escalation Procedures](#escalation-procedures)
6. [Compliance Requirements](#compliance-requirements)
7. [Monitoring and Reporting](#monitoring-and-reporting)

---

## Verification Policies

### General Verification Principles

1. **Fairness**: All entities are verified using consistent criteria regardless of size, location, or relationship
2. **Transparency**: Clear communication of verification requirements and outcomes
3. **Accountability**: Complete audit trail of all verification decisions
4. **Efficiency**: Streamlined process to minimize wait times while maintaining quality
5. **Security**: Protection of sensitive documents and personal information

### Entity-Specific Verification Requirements

#### Professional Verification

**Required Documents:**

- National ID or Passport (government-issued identification)
- Business Registration Certificate (if applicable)
- Professional License/Certification (e.g., NCA license, EARB number)
- Proof of Address (utility bill or bank statement)
- Portfolio samples (minimum 3 projects)

**Verification Criteria:**

- ✅ All required documents are present and legible
- ✅ Documents are not expired (certificates must be valid)
- ✅ Information matches across documents (name, address, etc.)
- ✅ Professional license is current and valid
- ✅ Portfolio demonstrates relevant experience
- ✅ Contact information is verifiable

**Rejection Reasons (Common):**

- Missing required documents
- Expired licenses or certificates
- Document quality too poor to verify
- Information mismatch between documents
- Suspicious or fraudulent documents
- Incomplete profile information

#### Store Verification

**Required Documents:**

- Business Registration Certificate
- Tax Compliance Certificate (KRA PIN)
- Store Owner Identification (National ID/Passport)
- Proof of Business Location (lease agreement or ownership documents)
- Product Catalog (minimum 10 products)

**Verification Criteria:**

- ✅ Business is legally registered
- ✅ Tax compliance certificate is current
- ✅ Store location is verifiable
- ✅ Product catalog meets minimum requirements
- ✅ Store owner identity is confirmed
- ✅ Business address matches registration

**Rejection Reasons (Common):**

- Unregistered business
- Expired tax compliance certificate
- Invalid business location
- Insufficient product catalog
- Owner identity cannot be verified

#### Property Verification

**Required Documents:**

- Property Ownership Documents (Title Deed, Sale Agreement)
- Property Owner Identification (National ID/Passport)
- Property Location Verification (GPS coordinates, address)
- Property Images (minimum 5 images showing different angles)
- Property Details (size, type, amenities)

**Verification Criteria:**

- ✅ Ownership documents are legitimate
- ✅ Property location is accurate and verifiable
- ✅ Property images match description
- ✅ Owner identity is confirmed
- ✅ Property details are complete and accurate
- ✅ Property is available for listing (not duplicate)

**Rejection Reasons (Common):**

- Invalid or fraudulent ownership documents
- Property location cannot be verified
- Insufficient or misleading property images
- Duplicate property listing
- Incomplete property information

### Document Verification Standards

#### Document Quality Requirements

- **Clarity**: Documents must be clear and readable (no blur, glare, or shadows)
- **Completeness**: All pages of multi-page documents must be included
- **Format**: Accepted formats: PDF, JPG, PNG (max 10MB per file)
- **Authenticity**: Documents must be original or certified copies
- **Currency**: Documents must be current (licenses/certificates not expired)

#### Document Types and Requirements

| Document Type         | Required Fields                                | Validity Period     |
| --------------------- | ---------------------------------------------- | ------------------- |
| National ID           | Full name, ID number, photo, signature         | Valid until expiry  |
| Business Registration | Registration number, business name, date       | Valid until renewal |
| Professional License  | License number, expiry date, issuing authority | Valid until expiry  |
| Tax Certificate       | PIN number, business name, issue date          | Valid for 1 year    |
| Property Title        | Title number, owner name, property description | Valid indefinitely  |

---

## Service Level Agreements (SLAs)

### Response Time SLAs

| Priority Level | Initial Review  | Verification Decision | Total Processing Time |
| -------------- | --------------- | --------------------- | --------------------- |
| **Standard**   | Within 24 hours | Within 48 hours       | **48 hours**          |
| **High**       | Within 12 hours | Within 24 hours       | **24 hours**          |
| **Urgent**     | Within 4 hours  | Within 8 hours        | **8 hours**           |

**Note**: Response time is measured from `submittedAt` timestamp to first admin action.

### Processing Time SLAs

| Entity Type      | Average Processing Time | Target (95th percentile) | Maximum  |
| ---------------- | ----------------------- | ------------------------ | -------- |
| **Professional** | 18 hours                | 36 hours                 | 48 hours |
| **Store**        | 16 hours                | 32 hours                 | 48 hours |
| **Property**     | 12 hours                | 24 hours                 | 48 hours |

**Note**: Processing time is measured from `submittedAt` to `verifiedAt` or final status change.

### Urgent Pending Items

Items are considered **urgent** if they have been pending for more than **48 hours** without admin action. These items:

- Appear in the "Urgent Pending" section of the admin dashboard
- Trigger automated alerts to admin team
- Are prioritized in the verification queue
- Require escalation if not addressed within 72 hours

### Notification SLAs

| Event                 | Notification Delivery Time | Channel        |
| --------------------- | -------------------------- | -------------- |
| Verification Approved | Within 5 minutes           | In-app + Email |
| Verification Rejected | Within 5 minutes           | In-app + Email |
| Correction Requested  | Within 5 minutes           | In-app + Email |
| Document Approved     | Within 2 minutes           | In-app         |
| Document Rejected     | Within 2 minutes           | In-app         |

### System Availability SLAs

- **API Uptime**: 99.9% (maximum 43 minutes downtime per month)
- **Dashboard Availability**: 99.5% (maximum 3.6 hours downtime per month)
- **Document Storage**: 99.99% availability
- **Notification Delivery**: 99% success rate

---

## Quality Standards

### Verification Accuracy

- **Target Accuracy Rate**: ≥ 98%
- **False Positive Rate**: < 1% (incorrectly verified)
- **False Negative Rate**: < 2% (incorrectly rejected)

### Admin Performance Standards

- **Minimum Reviews per Day**: 20 verifications per admin
- **Quality Score**: ≥ 95% (based on audit reviews)
- **Error Rate**: < 2% (reversals or corrections)
- **Documentation Rate**: 100% (all decisions must include notes)

### Document Verification Standards

- **Document Approval Rate**: ≥ 90% (of submitted documents)
- **Batch Processing Accuracy**: ≥ 99%
- **Average Documents per Entity**:
  - Professionals: 5-8 documents
  - Stores: 4-6 documents
  - Properties: 3-5 documents

---

## Priority Levels

### Standard Priority (Default)

**Applies to:**

- Regular professional, store, and property submissions
- Complete applications with all required documents
- No special circumstances

**SLA**: 48-hour processing time

### High Priority

**Applies to:**

- Premium/verified users resubmitting after rejection
- Entities with high-value transactions pending
- Referrals from partner organizations
- Entities with complete documentation and good history

**SLA**: 24-hour processing time

**Escalation**: Can be manually assigned by admin team lead

### Urgent Priority

**Applies to:**

- Items pending > 48 hours (automatic)
- Customer service escalations
- Legal/compliance issues requiring immediate attention
- VIP or enterprise customers

**SLA**: 8-hour processing time

**Escalation**: Automatic alert to admin team lead and manager

---

## Escalation Procedures

### Level 1: Standard Escalation

**Trigger**: Item pending > 48 hours

**Actions**:

1. Automatic notification to admin team
2. Item marked as "Urgent" in dashboard
3. Assignment to available admin
4. Follow-up notification after 24 hours if still pending

### Level 2: Manager Escalation

**Trigger**: Item pending > 72 hours

**Actions**:

1. Notification to admin manager
2. Manual assignment to senior admin
3. Review of admin workload and capacity
4. Potential temporary resource allocation

### Level 3: Executive Escalation

**Trigger**:

- Item pending > 96 hours
- Multiple complaints about same entity
- Legal/compliance concerns

**Actions**:

1. Notification to operations director
2. Immediate manual review
3. Root cause analysis
4. Process improvement recommendations

### Customer Service Escalation

**Process**:

1. Customer contacts support about verification delay
2. Support creates escalation ticket
3. Ticket automatically assigned "High" priority
4. Admin team lead reviews and assigns
5. Customer notified of status within 2 hours

---

## Compliance Requirements

### Data Protection

- **GDPR Compliance**: All personal data handled per GDPR requirements
- **Data Retention**:
  - Verified documents: Retained for 7 years
  - Rejected documents: Retained for 2 years
  - Audit logs: Retained indefinitely
- **Data Access**: Only authorized admins can access verification data
- **Data Deletion**: Users can request data deletion per privacy policy

### Audit Requirements

- **Complete Audit Trail**: Every verification action is logged
- **Audit Log Retention**: Indefinite (for compliance and security)
- **Audit Review**: Quarterly review of audit logs by compliance team
- **Audit Access**: Audit logs accessible to authorized personnel only

### Regulatory Compliance

- **Professional Licensing**: Verify against official licensing databases
- **Business Registration**: Confirm with relevant government registries
- **Tax Compliance**: Verify tax certificates with KRA (Kenya Revenue Authority)
- **Property Ownership**: Cross-reference with land registry when possible

### Security Requirements

- **Access Control**: Admin-only access via role-based authentication
- **IP Logging**: All admin actions logged with IP address
- **Rate Limiting**: Protection against abuse (20 verifications/minute)
- **Document Security**: Encrypted storage, secure URLs, access logging

---

## Monitoring and Reporting

### Key Performance Indicators (KPIs)

#### Processing Metrics

- **Average Verification Time**: Target < 20 hours
- **Verification Throughput**: Target > 100 verifications/day
- **Pending Queue Size**: Target < 50 items
- **Urgent Items**: Target < 5 items at any time

#### Quality Metrics

- **Verification Accuracy**: Target ≥ 98%
- **Rejection Rate**: Target 5-10% (too high indicates unclear requirements)
- **Correction Request Rate**: Target 10-15% (indicates quality control)
- **Customer Satisfaction**: Target ≥ 4.5/5.0

#### Admin Performance Metrics

- **Admin Productivity**: Average verifications per admin per day
- **Admin Quality Score**: Based on audit reviews and error rates
- **Response Time**: Time to first action on submitted items
- **Documentation Rate**: Percentage of decisions with notes

### Reporting Schedule

- **Daily**: Automated dashboard with current metrics
- **Weekly**: Summary report to admin team
- **Monthly**: Comprehensive report to management including:
  - Verification volumes by entity type
  - Average processing times
  - Quality metrics
  - Admin performance
  - SLA compliance
  - Escalation trends

### Alert Thresholds

| Metric                  | Warning Threshold | Critical Threshold | Action               |
| ----------------------- | ----------------- | ------------------ | -------------------- |
| Pending Queue Size      | > 40 items        | > 60 items         | Alert admin team     |
| Average Processing Time | > 30 hours        | > 40 hours         | Review capacity      |
| Urgent Items            | > 3 items         | > 8 items          | Escalate to manager  |
| Verification Accuracy   | < 97%             | < 95%              | Quality review       |
| System Uptime           | < 99.5%           | < 99%              | Technical escalation |

### Dashboard Metrics

The admin dashboard displays real-time:

- Total pending verifications
- Urgent items count
- Average verification time
- Today's verification count
- Admin activity feed
- Queue distribution by entity type
- SLA compliance status

---

## Policy Updates and Version Control

### Version History

- **v1.0** (2026-01-06): Initial policy document
  - Established SLAs and quality standards
  - Defined verification requirements
  - Set escalation procedures

### Review Schedule

- **Quarterly Review**: Policies reviewed every 3 months
- **Annual Audit**: Comprehensive review and update annually
- **Ad-hoc Updates**: Policies updated as needed based on:
  - Regulatory changes
  - System improvements
  - User feedback
  - Performance data

### Change Management

Policy changes require:

1. Review by operations team
2. Approval from operations director
3. Communication to admin team (minimum 1 week notice)
4. Update to documentation
5. Training if process changes

---

## Contact and Support

### Policy Questions

- **Email**: policies@buildmarket.co.ke
- **Slack**: #verification-policies
- **Documentation**: https://docs.buildmarket.co.ke/verification/policies

### Escalation Contacts

- **Admin Team Lead**: Available via Slack #admin-team
- **Operations Manager**: Available via Slack #operations
- **Emergency**: Contact via on-call rotation

---

## Appendix

### A. Verification Checklist Template

**Professional Verification Checklist:**

- [ ] National ID verified
- [ ] Business registration verified
- [ ] Professional license verified (not expired)
- [ ] Proof of address verified
- [ ] Portfolio reviewed (minimum 3 projects)
- [ ] Contact information verified
- [ ] All documents are clear and legible
- [ ] Information matches across documents
- [ ] Notes added to verification decision

**Store Verification Checklist:**

- [ ] Business registration verified
- [ ] Tax compliance certificate verified (current)
- [ ] Store owner identity verified
- [ ] Business location verified
- [ ] Product catalog reviewed (minimum 10 products)
- [ ] All documents are clear and legible
- [ ] Information matches across documents
- [ ] Notes added to verification decision

**Property Verification Checklist:**

- [ ] Property ownership documents verified
- [ ] Property owner identity verified
- [ ] Property location verified (GPS coordinates)
- [ ] Property images reviewed (minimum 5 images)
- [ ] Property details complete and accurate
- [ ] No duplicate listings found
- [ ] All documents are clear and legible
- [ ] Notes added to verification decision

### B. Common Rejection Reasons Template

When rejecting, use clear, specific reasons:

**Professional Rejections:**

- "National ID is expired. Please upload a valid ID."
- "Professional license expired on [date]. Please renew and resubmit."
- "Portfolio images are too low quality. Please upload higher resolution images."
- "Business registration certificate does not match company name. Please verify."

**Store Rejections:**

- "Tax compliance certificate expired. Please obtain current certificate from KRA."
- "Business location cannot be verified. Please provide lease agreement or ownership documents."
- "Product catalog has fewer than 10 items. Please add more products before resubmitting."

**Property Rejections:**

- "Property ownership documents are unclear. Please upload clearer images."
- "Property location GPS coordinates do not match address. Please verify."
- "Duplicate property listing found. This property is already listed by [user]."

### C. SLA Exception Handling

**Valid Exceptions to SLA:**

- System outages (excluded from uptime calculations)
- Public holidays (processing time extended by 1 day)
- Force majeure events
- User-requested holds (e.g., "Please hold verification until [date]")

**Invalid Exceptions:**

- High volume (should trigger capacity planning)
- Admin unavailability (should trigger resource allocation)
- Complex cases (should trigger escalation, not delay)

---

**Document Status**: Active  
**Last Updated**: 2026-01-06  
**Next Review**: 2026-04-06  
**Owner**: Operations Team  
**Approved By**: Operations Director
