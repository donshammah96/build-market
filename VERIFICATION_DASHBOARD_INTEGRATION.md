# Verification Dashboard Integration

## Overview

This document describes the integration of verification endpoints, notification templates, and monitoring alerts into the admin dashboard.

## Changes Made

### 1. Admin Dashboard Updates

**File**: `apps/admin/src/app/(dashboard)/page.tsx`

- ✅ Integrated verification statistics from `getVerificationStats()` endpoint
- ✅ Added verification metrics cards showing:
  - Pending verifications (with breakdown by entity type)
  - Verified items this month
  - Items needing correction
  - Urgent items (>48 hours pending)
- ✅ Added `VerificationAlertWidget` component for real-time alerts
- ✅ Fetches urgent verifications (>48 hours old) on page load

**Key Features**:

- Parallel data fetching for optimal performance
- Automatic urgent item detection based on SLA thresholds
- Visual indicators for urgent items (amber/red colors)
- Direct links to verification queue

### 2. Verification Alert Widget

**File**: `apps/admin/src/components/admin/verification/VerificationAlertWidget.tsx`

A new component that displays verification alerts based on SLA thresholds:

- **Critical Alerts**: ≥8 urgent items or queue size >60
- **Warning Alerts**: 3-7 urgent items or queue size 40-60
- **Info Alerts**: 1-2 urgent items
- **Success State**: No urgent items and healthy queue

**Alert Thresholds** (from `VERIFICATION_POLICIES_AND_SLAS.md`):

- Urgent items: >48 hours pending
- Warning threshold: 3 urgent items
- Critical threshold: 8 urgent items
- Queue size warning: >40 items
- Queue size critical: >60 items

### 3. Notification Templates Configuration

**File**: `apps/client/lib/services/verification/notification-templates.ts`

Centralized notification template system with:

- **Template Types**: VERIFIED, REJECTED, NEEDS_CORRECTION, DOCUMENT_APPROVED, DOCUMENT_REJECTED
- **Entity-Specific Templates**: Customized messages for professionals, stores, and properties
- **Email Support**: Includes email subject and body templates for external notifications
- **Dynamic Content**: Variable replacement for entity names, reasons, and notes

**Template Features**:

- Consistent messaging across all verification outcomes
- Context-aware links based on entity type
- Support for rejection reasons and correction notes
- Predefined helper functions for common scenarios

### 4. Notification Service Updates

**File**: `apps/client/lib/services/verification/notification.service.ts`

Updated to use the new template system:

- ✅ Replaced hardcoded notification messages with template system
- ✅ Fetches entity names for better notification context
- ✅ Supports email templates for external notification service
- ✅ Maintains backward compatibility with existing notification flow

**Improvements**:

- More consistent notification messages
- Better context (entity names included)
- Easier to customize templates
- Support for email notifications

### 5. Verification Monitoring Component

**File**: `apps/admin/src/components/admin/verification/VerificationMonitoring.tsx`

Real-time monitoring component (optional, can be added to dashboard):

- **Polling**: Automatically polls for verification updates every 60 seconds
- **Urgent Detection**: Identifies items pending >48 hours
- **Alert Levels**: Displays alerts based on SLA thresholds
- **Queue Monitoring**: Tracks queue size and alerts when thresholds exceeded

**Usage**:

```tsx
<VerificationMonitoring
  initialUrgentCount={urgentCount}
  initialPendingCount={pendingCount}
  pollingInterval={60000} // 1 minute
/>
```

## Dashboard Metrics Displayed

### Main Dashboard Cards

1. **Pending Verifications**
   - Total count
   - Breakdown: professionals, stores, properties

2. **Verified This Month**
   - Total verified count
   - Success indicator

3. **Needs Correction**
   - Items awaiting resubmission
   - Warning indicator

4. **Urgent Items**
   - Items pending >48 hours
   - Color-coded (amber/red) based on count
   - Direct link to urgent items

### Alert Widget

Displays in the "Verification Alerts" card:

- Critical/Warning/Info alerts based on thresholds
- Stats summary (pending, verified, needs correction)
- Direct action button to review urgent items

## Notification Templates

### Template Structure

Each template includes:

- **Title**: Short, descriptive title
- **Message**: User-friendly message explaining the outcome
- **Type**: success, error, warning, or info
- **Link**: Direct link to relevant page
- **Email Subject** (optional): For email notifications
- **Email Body** (optional): HTML email template

### Available Templates

1. **VERIFIED**: Success notification with green badge
2. **REJECTED**: Error notification with red badge and rejection reason
3. **NEEDS_CORRECTION**: Warning notification with correction notes
4. **DOCUMENT_APPROVED**: Success notification for document approval
5. **DOCUMENT_REJECTED**: Error notification for document rejection

### Usage Example

```typescript
import { getVerificationTemplate } from "@/lib/services/verification/notification-templates";

const template = getVerificationTemplate("VERIFIED", "professional", {
  entityName: "ABC Construction",
  adminNotes: "All documents verified. NCA license valid until 2027.",
});

// template.title: "Professional Verified Successfully"
// template.message: "Congratulations! ABC Construction has been verified..."
// template.type: "success"
// template.link: "/professional-portal/profile"
```

## Monitoring and Alerts

### Alert Thresholds

Based on `VERIFICATION_POLICIES_AND_SLAS.md`:

| Metric       | Warning | Critical | Action           |
| ------------ | ------- | -------- | ---------------- |
| Urgent Items | ≥3      | ≥8       | Alert admin team |
| Queue Size   | >40     | >60      | Review capacity  |

### Alert Levels

- **Critical**: Red alert, requires immediate action
- **Warning**: Amber alert, monitor closely
- **Info**: Blue alert, informational
- **Success**: Green indicator, all good

### Real-time Updates

The monitoring component polls for updates every 60 seconds (configurable) and:

- Detects new urgent items
- Updates queue counts
- Refreshes alert status
- Shows last update time

## Integration Points

### API Endpoints Used

1. `GET /api/admin/verification-stats` - Verification statistics
2. `GET /api/admin/pending-verifications` - Pending items list
3. `GET /api/admin/verification-updates` - Polling for updates (via server action)

### Server Actions Used

1. `getVerificationStats()` - Fetch verification statistics
2. `getPendingVerifications()` - Fetch pending items with filters
3. `getVerificationUpdates()` - Poll for updates since timestamp

## Configuration

### Environment Variables

No new environment variables required. Uses existing:

- `ENABLE_NOTIFICATION_SERVICE` - Enable external notification service
- `NOTIFICATION_SERVICE_URL` - Notification service URL

### Polling Configuration

Default polling interval: 60 seconds (1 minute)

Can be customized in `VerificationMonitoring` component:

```tsx
<VerificationMonitoring pollingInterval={30000} /> // 30 seconds
```

## Testing

### Manual Testing Checklist

- [ ] Dashboard loads verification stats correctly
- [ ] Urgent items are detected (>48 hours)
- [ ] Alert widget shows correct alert levels
- [ ] Notification templates generate correct messages
- [ ] Links in notifications work correctly
- [ ] Monitoring component polls for updates
- [ ] Alerts update based on thresholds

### Test Scenarios

1. **No Urgent Items**: Should show success state
2. **3-7 Urgent Items**: Should show warning alert
3. **≥8 Urgent Items**: Should show critical alert
4. **Queue Size >40**: Should show warning
5. **Queue Size >60**: Should show critical alert

## Future Enhancements

### Potential Improvements

1. **WebSocket Integration**: Replace polling with WebSocket for real-time updates
2. **Email Notifications**: Integrate email sending via notification service
3. **Admin Assignment**: Assign urgent items to specific admins
4. **SLA Tracking**: Track and display SLA compliance metrics
5. **Customizable Thresholds**: Allow admins to configure alert thresholds
6. **Notification Preferences**: Let users customize notification preferences

## Related Documentation

- [VERIFICATION_POLICIES_AND_SLAS.md](./VERIFICATION_POLICIES_AND_SLAS.md) - SLA thresholds and policies
- [VERIFICATION_API_DOCS.md](./VERIFICATION_API_DOCS.md) - API reference
- [VERIFICATION_SYSTEM_README.md](./VERIFICATION_SYSTEM_README.md) - System overview

## Support

For questions or issues:

- Email: dev@buildmarket.co.ke
- Slack: #verification-system
- Documentation: https://docs.buildmarket.co.ke/verification
