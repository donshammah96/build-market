# Git Branch Split Automation Script

## Overview

Split the current `feature/store-integration` branch with mixed changes into 8 separate feature branches for clean PRs.

## Branches (Merge Order)

| #   | Branch                                     | Description                                        |
| --- | ------------------------------------------ | -------------------------------------------------- |
| 1   | `chore/db-schema-and-infra`                | Database schema, migrations, packages, root config |
| 2   | `feature/notification-nats-integration`    | Notification service + NATS + Redis                |
| 3   | `feature/admin-dashboard-improvements`     | Admin panel: analytics, audit, services            |
| 4   | `feature/admin-verification-system`        | Verification workflow for entities                 |
| 5   | `feature/property-management`              | Property listings and documents                    |
| 6   | `feature/professional-portal-enhancements` | Professional dashboard, leads, portfolio           |
| 7   | `feature/store-integration`                | Store/vendor integration                           |
| 8   | `chore/client-app-improvements`            | Client app: auth, onboarding, UI, config           |

---

## PowerShell Script

```powershell
# ============================================================================
# Git Branch Split Automation Script
# Repository: build-market
# Created: 2026-01-15
# ============================================================================

$ErrorActionPreference = "Stop"
$RepoPath = "C:\Users\User\build-market"
$BackupBranch = "backup/all-changes-2026-01-15"

Set-Location $RepoPath

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Git Branch Split Automation Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# ============================================================================
# STEP 1: Create backup branch with all changes
# ============================================================================
Write-Host "`n[1/9] Creating backup branch..." -ForegroundColor Yellow

git add -A
git stash push -m "temp-stash-for-backup"
git checkout -b $BackupBranch 2>$null || git checkout $BackupBranch
git stash pop
git add -A
git commit -m "backup: all uncommitted work before branch split (2026-01-15)" --allow-empty
git checkout feature/store-integration

Write-Host "Backup branch created: $BackupBranch" -ForegroundColor Green

# ============================================================================
# STEP 2: chore/db-schema-and-infra
# ============================================================================
Write-Host "`n[2/9] Creating chore/db-schema-and-infra..." -ForegroundColor Yellow

git checkout main
git pull origin main
git checkout -b chore/db-schema-and-infra 2>$null || git checkout chore/db-schema-and-infra

$dbFiles = @(
    # Root config
    ".gitignore",
    ".npmrc",
    "pnpm-lock.yaml",
    "turbo.json",
    ".github/",

    # Database package
    "packages/db/prisma/schema.prisma",
    "packages/db/prisma/seed.ts",
    "packages/db/prisma/migrations/20260106140454_init/",
    "packages/db/prisma/migrations/20260106141118_change_follow_up_date_to_datetime/",
    "packages/db/prisma/migrations/20260106142400_add_is_active_to_service_category/",
    "packages/db/prisma/migrations/20260106142631_add_is_active_sort_order_to_service_category/",
    "packages/db/prisma/migrations/20260107100124_add_propery_parking_spaces/",
    "packages/db/prisma/migrations/20260107101341_add_property_year_built_field/",
    "packages/db/prisma/migrations/20260114112618_add_failed_notif_table_and_queue_status_enums/",

    # Resilience package
    "packages/resilience/package.json",
    "packages/resilience/src/cache.ts",
    "packages/resilience/src/types.ts",

    # Types package
    "packages/types/src/auth.ts"
)

foreach ($file in $dbFiles) {
    try {
        git checkout $BackupBranch -- $file 2>$null
        Write-Host "  + $file" -ForegroundColor DarkGray
    } catch {
        Write-Host "  - $file (not found)" -ForegroundColor DarkYellow
    }
}

# Handle deleted migrations - need to delete them in this branch too
$deletedMigrations = @(
    "packages/db/prisma/migrations/20251106113351_migration_001/",
    "packages/db/prisma/migrations/20251106120151_add_enums_and_indexes/",
    "packages/db/prisma/migrations/20251106125213_change_state_to_county_add_certificates/",
    "packages/db/prisma/migrations/20251112093824_cursory_changes_001/",
    "packages/db/prisma/migrations/20251114120826_add_profile_completion_fields/",
    "packages/db/prisma/migrations/20251118131755_add_performance_indexes/",
    "packages/db/prisma/migrations/20251127123744_refine_schema/",
    "packages/db/prisma/migrations/20251204123656_add_calendar_event_relations/",
    "packages/db/prisma/migrations/20251204132549_add_avatar_to_user/",
    "packages/db/prisma/migrations/20251205130554_add_notification_lead_transaction/",
    "packages/db/prisma/migrations/20251211135504_add_reviews_and_quotes/",
    "packages/db/prisma/migrations/20251211140251_add_clientprofile_and_id_to_quotes/",
    "packages/db/prisma/migrations/20251211152931_add_systemsettings_table/",
    "packages/db/prisma/migrations/20251215125030_add_projectid_project_to_professionaltransaction/",
    "packages/db/prisma/migrations/20251215125549_add_cancelled_status/",
    "packages/db/prisma/migrations/20251215134359_add_ideabook_attachments/",
    "packages/db/prisma/migrations/20251217113358_add_propery_enums_indexes_and_model/",
    "packages/db/prisma/migrations/20251218143335_store_enums_update/",
    "packages/db/prisma/migrations/add_performance_indexes.md"
)

foreach ($migration in $deletedMigrations) {
    if (Test-Path $migration) {
        Remove-Item -Recurse -Force $migration
        Write-Host "  x $migration (deleted)" -ForegroundColor DarkRed
    }
}

git add -A
git commit -m "chore(db): consolidate schema and reset migrations

- Reset migrations with fresh 20260106 init migration
- Add service category active/sort fields
- Add property parking_spaces and year_built fields
- Add failed notification table and queue status enums
- Update resilience package cache and types
- Update auth types in shared types package
- Clean up old migrations (20251106-20251218)
- Update turbo.json pipeline configuration
- Add GitHub workflows and templates"

Write-Host "Branch chore/db-schema-and-infra created and committed" -ForegroundColor Green

# ============================================================================
# STEP 3: feature/notification-nats-integration
# ============================================================================
Write-Host "`n[3/9] Creating feature/notification-nats-integration..." -ForegroundColor Yellow

git checkout main
git checkout -b feature/notification-nats-integration 2>$null || git checkout feature/notification-nats-integration

$notificationFiles = @(
    "apps/notification-service/src/index.ts",
    "apps/notification-service/src/services/emailService.ts",
    "apps/notification-service/src/services/natsConsumer.ts",
    "apps/notification-service/README.md",
    "apps/notification-service/package.json",
    "packages/nats/",
    "packages/redis/"
)

foreach ($file in $notificationFiles) {
    try {
        git checkout $BackupBranch -- $file 2>$null
        Write-Host "  + $file" -ForegroundColor DarkGray
    } catch {
        Write-Host "  - $file (not found)" -ForegroundColor DarkYellow
    }
}

git add -A
git commit -m "feat(notification): integrate NATS messaging and Redis caching

- Add NATS consumer service for event-driven notifications
- Create shared NATS package with pub/sub utilities
- Create shared Redis package for caching layer
- Update email service with improved error handling
- Update notification service entry point
- Add comprehensive README documentation"

Write-Host "Branch feature/notification-nats-integration created and committed" -ForegroundColor Green

# ============================================================================
# STEP 4: feature/admin-dashboard-improvements
# ============================================================================
Write-Host "`n[4/9] Creating feature/admin-dashboard-improvements..." -ForegroundColor Yellow

git checkout main
git checkout -b feature/admin-dashboard-improvements 2>$null || git checkout feature/admin-dashboard-improvements

$adminDashboardFiles = @(
    # Dashboard pages
    "apps/admin/src/app/(dashboard)/layout.tsx",
    "apps/admin/src/app/(dashboard)/page.tsx",
    "apps/admin/src/app/(dashboard)/professionals/",
    "apps/admin/src/app/(dashboard)/analytics/",
    "apps/admin/src/app/(dashboard)/audit/",
    "apps/admin/src/app/(dashboard)/services/",

    # Auth pages
    "apps/admin/src/app/(auth)/sign-in/",
    "apps/admin/src/app/(auth)/unauthorized/",

    # Actions
    "apps/admin/src/actions/admin/index.ts",
    "apps/admin/src/actions/admin/professionals.ts",
    "apps/admin/src/actions/admin/shared.ts",
    "apps/admin/src/actions/admin/types.ts",
    "apps/admin/src/actions/admin/analytics.ts",
    "apps/admin/src/actions/admin/audit.ts",
    "apps/admin/src/actions/admin/services.ts",

    # Components
    "apps/admin/src/components/admin/breadcrumbs.tsx",
    "apps/admin/src/components/ui/alert.tsx",
    "apps/admin/src/components/ui/dialog.tsx",

    # Config
    "apps/admin/src/middleware.ts",
    "apps/admin/src/app/globals.css"
)

foreach ($file in $adminDashboardFiles) {
    try {
        git checkout $BackupBranch -- $file 2>$null
        Write-Host "  + $file" -ForegroundColor DarkGray
    } catch {
        Write-Host "  - $file (not found)" -ForegroundColor DarkYellow
    }
}

git add -A
git commit -m "feat(admin): enhance dashboard with analytics, audit, and services

- Add analytics dashboard with charts and metrics
- Add audit log viewer for admin actions
- Add services management section
- Improve professionals detail page
- Add alert and dialog UI components
- Update admin middleware and auth pages
- Refactor shared admin actions and types
- Update global styles"

Write-Host "Branch feature/admin-dashboard-improvements created and committed" -ForegroundColor Green

# ============================================================================
# STEP 5: feature/admin-verification-system
# ============================================================================
Write-Host "`n[5/9] Creating feature/admin-verification-system..." -ForegroundColor Yellow

git checkout main
git checkout -b feature/admin-verification-system 2>$null || git checkout feature/admin-verification-system

$verificationFiles = @(
    # Admin verification
    "apps/admin/src/actions/admin/verification.ts",
    "apps/admin/src/app/(dashboard)/verifications/",
    "apps/admin/src/components/admin/verification/",

    # Client API routes
    "apps/client/app/api/admin/verify/",
    "apps/client/app/api/admin/verify-document/",
    "apps/client/app/api/admin/pending-verifications/",
    "apps/client/app/api/admin/verification-details/",
    "apps/client/app/api/admin/verification-stats/",

    # Client services and hooks
    "apps/client/lib/services/verification/",
    "apps/client/hooks/useVerificationRedirect.ts",

    # Tests
    "apps/client/__tests__/admin-verification/",

    # Documentation
    "VERIFICATION_API_DOCS.md",
    "VERIFICATION_DASHBOARD_INTEGRATION.md",
    "VERIFICATION_MIGRATION_GUIDE.md",
    "VERIFICATION_POLICIES_AND_SLAS.md",
    "VERIFICATION_SYSTEM_README.md"
)

foreach ($file in $verificationFiles) {
    try {
        git checkout $BackupBranch -- $file 2>$null
        Write-Host "  + $file" -ForegroundColor DarkGray
    } catch {
        Write-Host "  - $file (not found)" -ForegroundColor DarkYellow
    }
}

git add -A
git commit -m "feat(verification): add admin verification system for entities

- Add verification actions for professionals, stores, and properties
- Create admin verification dashboard pages
- Add verification API routes (verify, verify-document, stats, details)
- Implement pending verifications queue
- Add verification service with status management
- Add useVerificationRedirect hook for flow control
- Include comprehensive test suite
- Add verification system documentation:
  - API documentation
  - Dashboard integration guide
  - Migration guide
  - Policies and SLAs
  - System README"

Write-Host "Branch feature/admin-verification-system created and committed" -ForegroundColor Green

# ============================================================================
# STEP 6: feature/property-management
# ============================================================================
Write-Host "`n[6/9] Creating feature/property-management..." -ForegroundColor Yellow

git checkout main
git checkout -b feature/property-management 2>$null || git checkout feature/property-management

$propertyFiles = @(
    # Types
    "apps/client/types/property.ts",

    # API routes
    "apps/client/app/api/properties/[id]/route.ts",
    "apps/client/app/api/properties/route.ts",
    "apps/client/app/api/properties/[id]/documents/",
    "apps/client/app/api/properties/my-listings/",

    # Pages
    "apps/client/app/properties/[id]/page.tsx",
    "apps/client/app/properties/page.tsx",
    "apps/client/app/professional-portal/settings/properties/",

    # Repository
    "apps/client/app/lib/repositories/property.repository.ts",

    # Components
    "apps/client/components/real-estate/Property.tsx",
    "apps/client/components/real-estate/PropertyCard.tsx",
    "apps/client/components/forms/PropertyForm.tsx",

    # Admin
    "apps/admin/src/actions/admin/properties.ts",
    "apps/admin/src/app/(dashboard)/properties/",
    "apps/admin/src/components/admin/properties/"
)

foreach ($file in $propertyFiles) {
    try {
        git checkout $BackupBranch -- $file 2>$null
        Write-Host "  + $file" -ForegroundColor DarkGray
    } catch {
        Write-Host "  - $file (not found)" -ForegroundColor DarkYellow
    }
}

git add -A
git commit -m "feat(property): add property management system

- Add property types and interfaces
- Create property API routes (CRUD, documents, my-listings)
- Add property listing and detail pages
- Implement property repository layer
- Add Property and PropertyCard components
- Create PropertyForm for listings
- Add professional portal property settings
- Add admin property management dashboard
- Add admin property actions and components"

Write-Host "Branch feature/property-management created and committed" -ForegroundColor Green

# ============================================================================
# STEP 7: feature/professional-portal-enhancements
# ============================================================================
Write-Host "`n[7/9] Creating feature/professional-portal-enhancements..." -ForegroundColor Yellow

git checkout main
git checkout -b feature/professional-portal-enhancements 2>$null || git checkout feature/professional-portal-enhancements

$professionalFiles = @(
    # Types
    "apps/client/types/professional.ts",
    "apps/client/types/project.ts",

    # Professional portal pages
    "apps/client/app/professional-portal/dashboard/page.tsx",
    "apps/client/app/professional-portal/leads/page.tsx",
    "apps/client/app/professional-portal/leads/[id]/",
    "apps/client/app/professional-portal/portfolio/page.tsx",
    "apps/client/app/professional-portal/portfolio/[id]/",
    "apps/client/app/professional-portal/pipeline/",
    "apps/client/app/professional-portal/inquiries/",
    "apps/client/app/professional-portal/finance/page.tsx",
    "apps/client/app/professional-portal/finance/[id]/",
    "apps/client/app/professional-portal/calendar/page.tsx",
    "apps/client/app/professional-portal/calendar/[id]/",
    "apps/client/app/professional-portal/messages/page.tsx",
    "apps/client/app/professional-portal/messages/[id]/",
    "apps/client/app/professional-portal/profile/",
    "apps/client/app/professional-portal/settings/page.tsx",
    "apps/client/app/professional-portal/settings/complete-profile/page.tsx",
    "apps/client/app/professional-portal/layout.tsx",

    # Professional portal API routes
    "apps/client/app/api/professional-portal/finance/transactions/route.ts",
    "apps/client/app/api/professional-portal/leads/[id]/route.ts",
    "apps/client/app/api/professional-portal/leads/route.ts",
    "apps/client/app/api/professional-portal/portfolio/[id]/route.ts",
    "apps/client/app/api/professional-portal/portfolio/route.ts",
    "apps/client/app/api/professional-portal/profile/[id]/route.ts",
    "apps/client/app/api/professional-portal/profile/route.ts",
    "apps/client/app/api/professional-portal/projects/[id]/route.ts",
    "apps/client/app/api/professional-portal/projects/route.ts",
    "apps/client/app/api/professional-portal/certificates/",
    "apps/client/app/api/professional-portal/dashboard/",
    "apps/client/app/api/professional-portal/documents/",
    "apps/client/app/api/professional-portal/inquiries/",
    "apps/client/app/api/professional-portal/inventory/",
    "apps/client/app/api/professional-portal/orders/",
    "apps/client/app/api/professional-portal/pipeline/",
    "apps/client/app/api/professional-portal/products/",

    # Public professional pages
    "apps/client/app/professionals/[id]/page.tsx",
    "apps/client/app/professionals/page.tsx",
    "apps/client/app/professional/onboarding/page.tsx",
    "apps/client/app/professional/page.tsx",
    "apps/client/app/api/professionals/[id]/route.ts",
    "apps/client/app/api/professionals/route.ts",

    # Leads API
    "apps/client/app/api/leads/[id]/route.ts",
    "apps/client/app/api/leads/route.ts",

    # Repository
    "apps/client/app/lib/repositories/professional.repository.ts",

    # Components
    "apps/client/components/layout/ProfessionalNavbar.tsx",
    "apps/client/components/layout/ProfessionalSidebar.tsx",
    "apps/client/components/professional/ProfessionalCard.tsx",
    "apps/client/components/professional/Professionals.tsx",
    "apps/client/components/professional/OnboardingWizard.tsx",
    "apps/client/components/projects/ProjectCard.tsx",
    "apps/client/components/forms/professional-wizard/",

    # Hooks and utilities
    "apps/client/hooks/useDashboardData.ts",
    "apps/client/lib/dashboard/",

    # Admin leads
    "apps/admin/src/actions/admin/leads.ts",
    "apps/admin/src/app/(dashboard)/leads/",
    "apps/admin/src/components/admin/leads/"
)

foreach ($file in $professionalFiles) {
    try {
        git checkout $BackupBranch -- $file 2>$null
        Write-Host "  + $file" -ForegroundColor DarkGray
    } catch {
        Write-Host "  - $file (not found)" -ForegroundColor DarkYellow
    }
}

git add -A
git commit -m "feat(professional): enhance professional portal with full workflow

- Add professional and project types
- Create professional portal pages:
  - Dashboard with metrics
  - Leads management with detail views
  - Portfolio showcase with project details
  - Pipeline/CRM workflow
  - Inquiries management
  - Finance/transactions
  - Calendar with event details
  - Messages with conversation view
  - Profile settings
- Add comprehensive API routes for all portal features
- Implement professional repository layer
- Add ProfessionalNavbar and Sidebar components
- Create OnboardingWizard for new professionals
- Add professional-wizard form components
- Implement useDashboardData hook
- Add dashboard utilities
- Add admin leads management"

Write-Host "Branch feature/professional-portal-enhancements created and committed" -ForegroundColor Green

# ============================================================================
# STEP 8: feature/store-integration
# ============================================================================
Write-Host "`n[8/9] Creating feature/store-integration..." -ForegroundColor Yellow

git checkout main
git checkout -b feature/store-integration 2>$null || git checkout feature/store-integration

$storeFiles = @(
    # Types
    "apps/client/types/store.ts",
    "apps/client/types/vendor.ts",

    # Components
    "apps/client/components/vendors/VendorCard.tsx",
    "apps/client/components/vendors/VendorSection.tsx",
    "apps/client/components/forms/StoreForm.tsx",
    "apps/client/components/forms/MultiStoreForm.tsx",

    # API routes
    "apps/client/app/api/stores/",

    # Professional portal store settings
    "apps/client/app/professional-portal/settings/stores/",

    # Admin
    "apps/admin/src/actions/admin/stores.ts",
    "apps/admin/src/app/(dashboard)/stores/"
)

foreach ($file in $storeFiles) {
    try {
        git checkout $BackupBranch -- $file 2>$null
        Write-Host "  + $file" -ForegroundColor DarkGray
    } catch {
        Write-Host "  - $file (not found)" -ForegroundColor DarkYellow
    }
}

git add -A
git commit -m "feat(store): add store and vendor integration

- Add store and vendor types
- Create VendorCard and VendorSection components
- Add StoreForm and MultiStoreForm for store management
- Create store API routes (CRUD operations)
- Add professional portal store settings page
- Add admin store management actions
- Add admin store dashboard pages"

Write-Host "Branch feature/store-integration created and committed" -ForegroundColor Green

# ============================================================================
# STEP 9: chore/client-app-improvements
# ============================================================================
Write-Host "`n[9/9] Creating chore/client-app-improvements..." -ForegroundColor Yellow

git checkout main
git checkout -b chore/client-app-improvements 2>$null || git checkout chore/client-app-improvements

$clientFiles = @(
    # Core app files
    "apps/client/middleware.ts",
    "apps/client/app/layout.tsx",
    "apps/client/app/page.tsx",
    "apps/client/app/globals.css",
    "apps/client/styles/globals.css",
    "apps/client/next.config.ts",
    "apps/client/package.json",

    # Auth pages
    "apps/client/app/sign-in/",
    "apps/client/app/sign-up/",
    "apps/client/app/auth-callback/page.tsx",
    "apps/client/app/verify/page.tsx",

    # Onboarding
    "apps/client/app/onboarding/page.tsx",
    "apps/client/app/api/onboarding/route.ts",
    "apps/client/app/api/onboarding/skip/route.ts",
    "apps/client/app/api/onboarding/uploads/route.ts",
    "apps/client/app/api/onboarding/skip-professional/",

    # User/Profile API
    "apps/client/app/api/user/profile/complete/route.ts",
    "apps/client/app/api/user/profile/route.ts",
    "apps/client/app/api/profile/",
    "apps/client/app/api/clerk-webhook/route.ts",
    "apps/client/app/api/internal/user-status/route.ts",

    # Other API routes
    "apps/client/app/api/client/dashboard/route.ts",
    "apps/client/app/api/health/route.ts",
    "apps/client/app/api/metrics/route.ts",
    "apps/client/app/api/notifications/route.ts",
    "apps/client/app/api/services/",

    # Idea books
    "apps/client/app/api/idea-books/[id]/attachments/[attachmentId]/route.ts",
    "apps/client/app/api/idea-books/[id]/attachments/route.ts",
    "apps/client/app/api/idea-books/[id]/route.ts",
    "apps/client/app/api/idea-books/route.ts",

    # Messaging
    "apps/client/app/api/messaging/conversations/[id]/read/route.ts",
    "apps/client/app/api/messaging/conversations/route.ts",
    "apps/client/app/api/messaging/messages/[id]/read/route.ts",
    "apps/client/app/api/messaging/messages/route.ts",

    # Reviews
    "apps/client/app/(user)/reviews/page.tsx",
    "apps/client/components/reviews/ReviewCard.tsx",
    "apps/client/components/reviews/ReviewsSection.tsx",

    # Home components
    "apps/client/components/home/CTA.tsx",
    "apps/client/components/home/FeatureCard.tsx",
    "apps/client/components/home/FeatureSection.tsx",
    "apps/client/components/home/Hero.tsx",
    "apps/client/components/home/Onboarding.tsx",

    # Layout components
    "apps/client/components/layout/NavBar.tsx",
    "apps/client/components/layout/Footer.tsx",

    # Forms
    "apps/client/components/forms/HomeownerForm.tsx",
    "apps/client/components/forms/ProfessionalForm.tsx",

    # Notifications
    "apps/client/components/notifications/NotificationsPopover.tsx",

    # Shared components
    "apps/client/components/shared/ProfileCompletionWidget.tsx",
    "apps/client/components/shared/ProfileCompletionWidgetWrapper.tsx",
    "apps/client/components/accessibility/",
    "apps/client/components/dashboard/",
    "apps/client/components/admin/",
    "apps/client/components/ui/step-progress.tsx",

    # Hooks
    "apps/client/hooks/useProfileStatus.ts",
    "apps/client/hooks/useABTest.ts",
    "apps/client/hooks/useClerkMetadataSync.ts",
    "apps/client/hooks/useImageUploader.ts",

    # Lib utilities
    "apps/client/app/lib/api-response.ts",
    "apps/client/app/lib/api-utils.ts",
    "apps/client/app/lib/repositories/client.repository.ts",
    "apps/client/lib/links.ts",
    "apps/client/lib/schemas/onboarding.ts",
    "apps/client/lib/services/search.ts",
    "apps/client/lib/services/upload.ts",
    "apps/client/lib/utils.ts",
    "apps/client/lib/constants/professionOptions.ts",
    "apps/client/lib/generate-keys.ts",
    "apps/client/lib/hooks/",
    "apps/client/lib/stores/",

    # Public assets
    "apps/client/public/favicon.ico",
    "apps/client/public/apple-touch-icon.png",
    "apps/client/public/favicon-96x96.png",
    "apps/client/public/favicon.svg",
    "apps/client/public/icon-192.png",
    "apps/client/public/icon-512.png",
    "apps/client/public/manifest.json",
    "apps/client/public/site.webmanifest",

    # Testing
    "apps/client/cypress.config.ts",
    "apps/client/cypress/",
    "apps/client/__tests__/components/",
    "apps/client/__tests__/hooks/"
)

foreach ($file in $clientFiles) {
    try {
        git checkout $BackupBranch -- $file 2>$null
        Write-Host "  + $file" -ForegroundColor DarkGray
    } catch {
        Write-Host "  - $file (not found)" -ForegroundColor DarkYellow
    }
}

# Handle deleted auth files
$deletedAuthFiles = @(
    "apps/client/app/auth/credentials/page.tsx",
    "apps/client/app/auth/signin/page.tsx"
)

foreach ($file in $deletedAuthFiles) {
    if (Test-Path $file) {
        Remove-Item -Force $file
        Write-Host "  x $file (deleted)" -ForegroundColor DarkRed
    }
}

git add -A
git commit -m "chore(client): improve core app infrastructure and UX

- Update middleware with enhanced auth handling
- Improve app layout and global styles
- Update sign-in/sign-up pages with Clerk
- Remove deprecated auth pages (credentials, signin)
- Enhance onboarding flow with skip options
- Update user profile API routes
- Improve Clerk webhook handling
- Update idea books, messaging, and notifications APIs
- Add services API routes
- Enhance home page components (Hero, CTA, Features)
- Update NavBar and Footer components
- Improve forms (Homeowner, Professional)
- Add ProfileCompletionWidget components
- Add accessibility components
- Add dashboard components
- Add step-progress UI component
- Add hooks: useProfileStatus, useABTest, useClerkMetadataSync, useImageUploader
- Add lib utilities: api-utils, upload service, profession options
- Add Zustand stores
- Update PWA assets (icons, manifest)
- Add Cypress E2E testing setup
- Add component and hook unit tests"

Write-Host "Branch chore/client-app-improvements created and committed" -ForegroundColor Green

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Branch Creation Complete!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

Write-Host "`nBranches created (in merge order):" -ForegroundColor White
Write-Host "  1. chore/db-schema-and-infra" -ForegroundColor Green
Write-Host "  2. feature/notification-nats-integration" -ForegroundColor Green
Write-Host "  3. feature/admin-dashboard-improvements" -ForegroundColor Green
Write-Host "  4. feature/admin-verification-system" -ForegroundColor Green
Write-Host "  5. feature/property-management" -ForegroundColor Green
Write-Host "  6. feature/professional-portal-enhancements" -ForegroundColor Green
Write-Host "  7. feature/store-integration" -ForegroundColor Green
Write-Host "  8. chore/client-app-improvements" -ForegroundColor Green

Write-Host "`nBackup branch: $BackupBranch" -ForegroundColor Yellow

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Review each branch: git log --oneline -5 <branch-name>"
Write-Host "  2. Push branches: git push -u origin <branch-name>"
Write-Host "  3. Create PRs in order shown above"
Write-Host "  4. After all PRs merged, delete backup: git branch -D $BackupBranch"

# Push all branches
Write-Host "`nWould you like to push all branches now? (Run the following)" -ForegroundColor Yellow
Write-Host @"

git push -u origin chore/db-schema-and-infra
git push -u origin feature/notification-nats-integration
git push -u origin feature/admin-dashboard-improvements
git push -u origin feature/admin-verification-system
git push -u origin feature/property-management
git push -u origin feature/professional-portal-enhancements
git push -u origin feature/store-integration
git push -u origin chore/client-app-improvements

"@ -ForegroundColor DarkGray

Write-Host "Done!" -ForegroundColor Green
```

---

## Post-Script Commands

### Push All Branches

```powershell
git push -u origin chore/db-schema-and-infra
git push -u origin feature/notification-nats-integration
git push -u origin feature/admin-dashboard-improvements
git push -u origin feature/admin-verification-system
git push -u origin feature/property-management
git push -u origin feature/professional-portal-enhancements
git push -u origin feature/store-integration
git push -u origin chore/client-app-improvements
```

### Cleanup After All PRs Merged

```powershell
git branch -D backup/all-changes-2026-01-15
git fetch --prune
```
