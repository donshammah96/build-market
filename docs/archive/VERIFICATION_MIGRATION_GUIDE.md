# Admin Verification System - Migration Guide

## Database Migration

The admin verification system introduces new audit fields and the AdminAuditLog table. Follow these steps to apply the schema changes:

### 1. Review Schema Changes

**New Model:**

- `AdminAuditLog` - Centralized audit logging for all verification actions

**Enhanced Models:**

- `ProfessionalProfile` - Added `verifiedAt`, `verifiedById`, `verifiedBy`, `verificationNotes`, `rejectionReason`, `submittedAt`
- `Store` - Added `verificationStatus`, `verifiedAt`, `verifiedById`, `verifiedBy`, `verificationNotes`, `rejectionReason`, `submittedAt`
- `Property` - Added `verifiedAt`, `verifiedById`, `verifiedBy`, `verificationNotes`, `rejectionReason`, `submittedAt`
- `User` - Added relations for `verifiedProfessionals`, `verifiedStores`, `verifiedProperties`, `adminAuditLogs`

### 2. Generate Migration

```powershell
cd packages/db
pnpm prisma migrate dev --name add_verification_audit_trail
```

### 3. Apply Migration to Production

```powershell
pnpm prisma migrate deploy
```

### 4. Verify Migration

```powershell
pnpm prisma studio
```

Check that:

- `AdminAuditLog` table exists
- New columns are present in `ProfessionalProfile`, `Store`, `Property` tables
- Indexes are created

## Environment Variables

Add these optional environment variables to your `.env` file:

```bash
# Notification Service Integration (Optional)
ENABLE_NOTIFICATION_SERVICE=false  # Set to true to enable external notification service
NOTIFICATION_SERVICE_URL=http://localhost:3011  # URL of notification service

# Admin Verification Settings
DEV_ADMIN_BYPASS=false  # Allow admin bypass in development (for testing)
```

## Data Migration (Optional)

If you have existing data with the old verification structure, you may want to migrate it:

### Option 1: Set submittedAt for PENDING items

```sql
-- For professionals with PENDING status, set submittedAt to createdAt
UPDATE "ProfessionalProfile"
SET "submittedAt" = "createdAt"
WHERE status = 'PENDING' AND "submittedAt" IS NULL;

-- For stores with PENDING status
UPDATE "Store"
SET "submittedAt" = "createdAt"
WHERE "verificationStatus" = 'PENDING' AND "submittedAt" IS NULL;

-- For properties with PENDING status
UPDATE "Property"
SET "submittedAt" = "createdAt"
WHERE "verificationStatus" = 'PENDING' AND "submittedAt" IS NULL;
```

### Option 2: Backfill verifiedAt for already verified items

```sql
-- For already verified professionals, set verifiedAt to updatedAt
UPDATE "ProfessionalProfile"
SET "verifiedAt" = "updatedAt"
WHERE status = 'VERIFIED' AND "verifiedAt" IS NULL;

-- For stores
UPDATE "Store"
SET "verifiedAt" = "updatedAt"
WHERE "verificationStatus" = 'VERIFIED' AND "verifiedAt" IS NULL;

-- For properties
UPDATE "Property"
SET "verifiedAt" = "updatedAt"
WHERE "verificationStatus" = 'VERIFIED' AND "verifiedAt" IS NULL;
```

## Post-Migration Steps

1. **Test the verification endpoints:**

   ```bash
   # Run the test suite
   cd apps/client
   pnpm test admin-verification
   ```

2. **Verify admin permissions:**
   - Ensure admin users have the correct role in the database
   - Test login and access to verification endpoints

3. **Monitor audit logs:**
   - Check that audit logs are being created for verification actions
   - Review initial data in `AdminAuditLog` table

## Rollback Plan

If you need to rollback the migration:

```powershell
# Revert to previous migration
cd packages/db
pnpm prisma migrate resolve --rolled-back <migration-name>

# Or restore from backup
# Restore your database from backup taken before migration
```

## Performance Considerations

The new schema includes several indexes to optimize queries:

- `ProfessionalProfile`: `verifiedById`, `submittedAt`
- `Store`: `verificationStatus`, `verifiedById`, `submittedAt`
- `Property`: `verificationStatus`, `verifiedById`, `submittedAt`
- `AdminAuditLog`: `adminId`, `entityType`, `entityId`, `action`, `createdAt`

Monitor query performance and adjust indexes as needed based on your usage patterns.

## Next Steps

1. Update admin dashboard UI to use new verification endpoints
2. Configure notification templates for verification outcomes
3. Set up monitoring and alerts for pending verifications
4. Train admin users on the new verification workflow
5. **Document verification policies and SLAs** ✅
   - See [VERIFICATION_POLICIES_AND_SLAS.md](./VERIFICATION_POLICIES_AND_SLAS.md) for comprehensive documentation
   - Includes verification requirements, SLAs, quality standards, escalation procedures, and compliance requirements
