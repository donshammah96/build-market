import "./load-env";
import { prisma } from "../lib/prisma";

// Route Helpers (mirrors apps/client/lib/links.ts for consistency)
const ROUTES = {
  userDashboard: "/dashboard",
  userProjects: "/projects",
  professionalLeads: "/professional-portal/leads",
  professionalProjects: "/professional-portal/projects",
  professionalCalendar: "/professional-portal/calendar",
  professionalStore: "/professional-portal/store",
  professionalProfile: "/professional-portal/profile",
  professionalProperties: "/professional-portal/properties",
  professionalNotifications: "/professional-portal/notifications",
  professionalTransactions: "/professional-portal/transactions",
  professionalReviews: "/professional-portal/reviews",
  professionalSettings: "/professional-portal/settings",
  professionalMessages: "/professional-portal/messages",
} as const;

const getProfessionalLeadUrl = (id: string) =>
  `${ROUTES.professionalLeads}/${id}`;
const getProfessionalProjectUrl = (id: string) =>
  `${ROUTES.professionalProjects}/${id}`;
const getProjectUrl = (id: string) => `${ROUTES.userProjects}/${id}`;
const getPropertyUrl = (id: string) => `${ROUTES.professionalProperties}/${id}`;
const getNotificationUrl = (id: string) =>
  `${ROUTES.professionalNotifications}/${id}`;
const getTransactionUrl = (id: string) =>
  `${ROUTES.professionalTransactions}/${id}`;
const getReviewUrl = (id: string) => `${ROUTES.professionalReviews}/${id}`;
const getSettingUrl = (id: string) => `${ROUTES.professionalSettings}/${id}`;
const getMessageUrl = (id: string) => `${ROUTES.professionalMessages}/${id}`;

/**
 * Comprehensive Seed File for Build Market
 * =========================================
 * This seed file creates ideal, fully-onboarded users representing:
 * - A complete Client profile (homeowner with all preferences set)
 * - A complete Professional profile (verified engineer with all credentials)
 * - Associated data: Services, Portfolios, Stores, Projects, Reviews, Leads, etc.
 *
 * Use this as a template for understanding the full data model and relationships.
 */

async function main() {
  console.log("🌱 Starting comprehensive database seed...");

  const now = new Date();
  const lastYear = new Date(now.getFullYear() - 1, 0, 10);
  const nextYear = new Date(now.getFullYear() + 1, 11, 31);
  const twoYearsFromNow = new Date(now.getFullYear() + 2, 5, 15);

  await prisma.$transaction(
    async (tx) => {
      // ============================================================
      // 1. SERVICE CATEGORIES & SERVICES
      // ============================================================
      console.log("📦 Creating service categories and services...");

      const engineeringCategory = await tx.serviceCategory.upsert({
        where: { slug: "engineering-services" },
        update: {},
        create: {
          name: "Engineering Services",
          slug: "engineering-services",
          description:
            "Professional engineering services including structural, civil, mechanical, and electrical engineering for construction projects.",
          icon: "engineering",
          imageUrl:
            "https://images.unsplash.com/photo-1581094794329-c8112a89af12",
          professionType: "STRUCTURAL_ENGINEER",
          isActive: true,
          sortOrder: 1,
          isFeatured: true,
          metaTitle: "Engineering Services in Kenya | Build Market",
          metaDescription:
            "Find verified structural, civil, and building engineers in Kenya for your construction projects.",
          keywords: [
            "structural engineering",
            "civil engineering",
            "building design",
            "Kenya engineers",
          ],
        },
      });

      const architectureCategory = await tx.serviceCategory.upsert({
        where: { slug: "architecture-design" },
        update: {},
        create: {
          name: "Architecture & Design",
          slug: "architecture-design",
          description:
            "Architectural design, interior design, and landscape architecture services.",
          icon: "architecture",
          imageUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e",
          professionType: "ARCHITECT",
          isActive: true,
          sortOrder: 2,
          isFeatured: true,
          metaTitle: "Architects in Kenya | Build Market",
          metaDescription:
            "Connect with top architects and designers in Kenya for residential and commercial projects.",
          keywords: [
            "architect",
            "interior design",
            "landscape design",
            "building design",
          ],
        },
      });

      // Create Services
      const structuralEngService = await tx.service.upsert({
        where: { slug: "structural-engineering" },
        update: {},
        create: {
          name: "Structural Engineering",
          slug: "structural-engineering",
          categoryId: engineeringCategory.id,
          description:
            "Structural analysis, design, and supervision for buildings and infrastructure.",
          icon: "building",
          defaultUnit: "project",
          avgPriceMin: 50000,
          avgPriceMax: 500000,
          searchKeywords: [
            "structural engineer",
            "building structure",
            "foundation design",
            "beam design",
          ],
          popularityScore: 95,
        },
      });

      const civilEngService = await tx.service.upsert({
        where: { slug: "civil-engineering" },
        update: {},
        create: {
          name: "Civil Engineering",
          slug: "civil-engineering",
          categoryId: engineeringCategory.id,
          description:
            "Civil engineering services for roads, drainage, water systems, and site development.",
          icon: "road",
          defaultUnit: "project",
          avgPriceMin: 100000,
          avgPriceMax: 2000000,
          searchKeywords: [
            "civil engineer",
            "roads",
            "drainage",
            "site development",
          ],
          popularityScore: 90,
        },
      });

      const buildingDesignService = await tx.service.upsert({
        where: { slug: "building-design" },
        update: {},
        create: {
          name: "Building Design",
          slug: "building-design",
          categoryId: engineeringCategory.id,
          description:
            "Complete building design from concept to construction drawings.",
          icon: "blueprint",
          defaultUnit: "sqm",
          avgPriceMin: 500,
          avgPriceMax: 2500,
          searchKeywords: [
            "building design",
            "construction drawings",
            "architectural plans",
          ],
          popularityScore: 88,
        },
      });

      const architecturalDesignService = await tx.service.upsert({
        where: { slug: "architectural-design" },
        update: {},
        create: {
          name: "Architectural Design",
          slug: "architectural-design",
          categoryId: architectureCategory.id,
          description:
            "Full architectural services from concept design to project completion.",
          icon: "architecture",
          defaultUnit: "sqm",
          avgPriceMin: 800,
          avgPriceMax: 3000,
          searchKeywords: [
            "architect",
            "house design",
            "commercial architecture",
          ],
          popularityScore: 92,
        },
      });

      // ============================================================
      // 2. ADMIN USER (for verification purposes)
      // ============================================================
      console.log("👤 Creating admin user...");

      const adminUser = await tx.user.upsert({
        where: { clerkId: "admin_buildmarket_001" },
        update: {},
        create: {
          clerkId: "admin_buildmarket_001",
          email: "donshammah1@gmail.com",
          firstName: "System",
          lastName: "Admin",
          phone: "+254798798770",
          avatar:
            "https://ui-avatars.com/api/?name=System+Admin&background=0D8ABC&color=fff",
          role: "ADMIN",
          status: "ACTIVE",
          isProfileComplete: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          termsAcceptedAt: now,
          termsVersion: "1.0",
          lastLoginAt: now,
          lastActiveAt: now,
          adminProfile: {
            create: {
              role: "SUPER_ADMIN",
              permissions: ["all"],
              department: "Platform Operations",
              isActive: true,
              lastLoginAt: now,
              lastActiveAt: now,
            },
          },
        },
      });

      // ============================================================
      // 3. IDEAL CLIENT PROFILE (Fully Onboarded Homeowner)
      // ============================================================
      console.log("🏠 Creating ideal client profile...");

      const idealClient = await tx.user.upsert({
        where: { clerkId: "don_shammah_client_001" },
        update: {},
        create: {
          clerkId: "don_shammah_client_001",
          email: "sohocarti@gmail.com",
          firstName: "Don",
          lastName: "Shammah",
          phone: "+254798798770",
          avatar:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
          role: "CLIENT",
          status: "ACTIVE",
          isProfileComplete: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          termsAcceptedAt: lastYear,
          termsVersion: "1.0",
          marketingConsent: true,
          lastLoginAt: now,
          lastActiveAt: now,
          metadata: {
            source: "organic",
            referralCode: null,
            onboardingCompleted: true,
          },
          clientProfile: {
            create: {
              type: "HOMEOWNER",
              companyName: null,
              kraPin: "A123456789X",
              companyRegistration: null,
              website: null,
              address: "123 Riverside Drive, Apt 4B",
              city: "Nairobi",
              county: "NAIROBI",
              neighborhood: "Westlands",
              landmark: "Near Sarit Centre",
              zipCode: "00100",
              latitude: -1.2697,
              longitude: 36.8086,
              interests: [
                "residential construction",
                "interior design",
                "landscaping",
                "smart home",
              ],
              budgetRangeMax: 15000000, // KES 15 million
              preferences: {
                preferredContactMethod: "whatsapp",
                preferredProjectType: "RESIDENTIAL",
                preferredPaymentMethods: ["MPESA", "BANK_TRANSFER"],
                notifications: {
                  email: true,
                  sms: true,
                  push: true,
                },
              },
              isVerified: true,
              verifiedAt: lastYear,
              loyaltyPoints: 500,
              membershipTier: "GOLD",
            },
          },
        },
      });

      // ============================================================
      // 4. IDEAL PROFESSIONAL PROFILE (Fully Verified Engineer)
      // ============================================================
      console.log("👷 Creating ideal professional profile...");

      const idealProfessional = await tx.user.upsert({
        where: { clerkId: "evans_ndegwa_pro_001" },
        update: {},
        create: {
          clerkId: "evans_ndegwa_pro_001",
          email: "evans.ndegwa@buildmarket.com",
          firstName: "Evans",
          lastName: "Ndegwa",
          phone: "+254791938881",
          avatar:
            "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200",
          role: "PROFESSIONAL",
          status: "ACTIVE",
          isProfileComplete: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          termsAcceptedAt: new Date(now.getFullYear() - 2, 5, 1),
          termsVersion: "1.0",
          marketingConsent: true,
          lastLoginAt: now,
          lastActiveAt: now,
          metadata: {
            source: "referral",
            referralCode: "PRO2024",
            onboardingCompleted: true,
            featureFlags: {
              betaAccess: true,
              premiumDashboard: true,
            },
          },
          professionalProfile: {
            create: {
              companyName: "Evannas Structural Engineers Ltd",
              profession: "STRUCTURAL_ENGINEER",
              bio: "Licensed Structural Engineer with over 15 years of experience in commercial and residential building design. Registered member of the Engineers Board of Kenya (EBK) and founder of Ndegwa Structural Engineers Ltd. Specialized in earthquake-resistant designs, high-rise structures, and sustainable building solutions. Successfully completed 200+ projects across Kenya including the iconic Nairobi Business Park.",
              website: "https://ndegwa-engineers.co.ke",
              portfolioUrl: "https://ndegwa-engineers.co.ke/portfolio",
              socials: {
                linkedin: "https://linkedin.com/in/evansndegwa",
                twitter: "https://twitter.com/ndegwa_eng",
                instagram: "https://instagram.com/ndegwaengineers",
                facebook: "https://facebook.com/ndegwaengineers",
              },
              city: "Nairobi",
              county: "NAIROBI",
              country: "Kenya",
              latitude: -1.2864,
              longitude: 36.8172,
              serviceRadiusKm: 50,
              availability: "AVAILABLE",
              operatingHours: {
                monday: { open: "08:00", close: "17:00" },
                tuesday: { open: "08:00", close: "17:00" },
                wednesday: { open: "08:00", close: "17:00" },
                thursday: { open: "08:00", close: "17:00" },
                friday: { open: "08:00", close: "17:00" },
                saturday: { open: "09:00", close: "13:00" },
                sunday: null,
              },
              kraPin: "P123456789Y",
              isInsured: true,
              insuranceProvider: "Jubilee Insurance",
              insurancePolicyNumber: "PI-2023-001234",
              insuranceExpiry: twoYearsFromNow,
              yearsExperience: 15,
              verified: true,
              verificationStatus: "VERIFIED",
              verificationNotes:
                "All documents verified. EBK license confirmed valid.",
              verifiedAt: new Date(now.getFullYear() - 2, 5, 15),
              verifiedById: adminUser.id,
              rating: 4.85,
              reviewCount: 127,
              completedProjects: 203,
              responseRate: 98,
              minProjectBudget: 500000,
              hourlyRate: 5000,

              acceptedPayments: ["MPESA", "BANK_TRANSFER", "CASH", "CARD"],

              // Create associated services
              offeredServices: {
                create: [
                  {
                    serviceId: structuralEngService.id,
                    price: 75000,
                    pricingUnit: "per project",
                    yearsExperience: 15,
                    isPrimary: true,
                  },
                  {
                    serviceId: civilEngService.id,
                    price: 120000,
                    pricingUnit: "per project",
                    yearsExperience: 12,
                    isPrimary: false,
                  },
                  {
                    serviceId: buildingDesignService.id,
                    price: 1500,
                    pricingUnit: "per sqm",
                    yearsExperience: 15,
                    isPrimary: false,
                  },
                ],
              },

              // Create professional licenses
              licenses: {
                create: [
                  {
                    authority: "EBK",
                    licenseNumber: "EBK-PE-2009-1234",
                    status: "VERIFIED",
                    validFrom: new Date("2009-06-15"),
                    validUntil: twoYearsFromNow,
                    fileUrl:
                      "https://storage.buildmarket.co.ke/licenses/ebk-evans-ndegwa.pdf",
                    fileKey: "licenses/ebk-evans-ndegwa.pdf",
                    verifiedAt: lastYear,
                    verifiedById: adminUser.id,
                    notes: "Verified with EBK registry on 2024-01-15",
                  },
                  {
                    authority: "NCA",
                    licenseNumber: "NCA/2015/5678",
                    status: "VERIFIED",
                    validFrom: new Date("2015-03-20"),
                    validUntil: nextYear,
                    fileUrl:
                      "https://storage.buildmarket.co.ke/licenses/nca-evans-ndegwa.pdf",
                    fileKey: "licenses/nca-evans-ndegwa.pdf",
                    verifiedAt: lastYear,
                    verifiedById: adminUser.id,
                    notes: "NCA Category 1 Contractor license confirmed",
                  },
                ],
              },

              // Create professional documents
              documents: {
                create: [
                  {
                    category: "EDUCATION_CERT",
                    title: "Bachelor of Science in Civil Engineering",
                    issuer: "University of Nairobi",
                    issueDate: new Date("2020-12-15"),
                    fileKey: "docs/evans-bsc-civil-eng.pdf",
                    fileUrl:
                      "https://storage.buildmarket.co.ke/docs/evans-bsc-civil-eng.pdf",
                    mimeType: "application/pdf",
                    size: 245000,
                    status: "VERIFIED",
                    verifiedAt: lastYear,
                    verifiedById: adminUser.id,
                  },
                  {
                    category: "EDUCATION_CERT",
                    title: "Master of Science in Structural Engineering",
                    issuer:
                      "Jomo Kenyatta University of Agriculture and Technology",
                    issueDate: new Date("2022-08-20"),
                    fileKey: "docs/evans-msc-structural-eng.pdf",
                    fileUrl:
                      "https://storage.buildmarket.co.ke/docs/evans-msc-structural-eng.pdf",
                    mimeType: "application/pdf",
                    size: 312000,
                    status: "VERIFIED",
                    verifiedAt: lastYear,
                    verifiedById: adminUser.id,
                  },
                  {
                    category: "INSURANCE_POLICY",
                    title: "Professional Indemnity Insurance",
                    issuer: "Jubilee Insurance",
                    issueDate: new Date(now.getFullYear() - 1, 0, 1),
                    expiryDate: twoYearsFromNow,
                    fileKey: "docs/evans-insurance-policy.pdf",
                    fileUrl:
                      "https://storage.buildmarket.co.ke/docs/evans-insurance-policy.pdf",
                    mimeType: "application/pdf",
                    size: 189000,
                    status: "VERIFIED",
                    verifiedAt: lastYear,
                    verifiedById: adminUser.id,
                  },
                  {
                    category: "TAX_COMPLIANCE",
                    title: "KRA Tax Compliance Certificate",
                    issuer: "Kenya Revenue Authority",
                    issueDate: new Date(now.getFullYear(), 0, 5),
                    expiryDate: new Date(now.getFullYear() + 1, 0, 4),
                    fileKey: "docs/evans-tcc-2024.pdf",
                    fileUrl:
                      "https://storage.buildmarket.co.ke/docs/evans-tcc-2024.pdf",
                    mimeType: "application/pdf",
                    size: 98000,
                    status: "VERIFIED",
                    verifiedAt: new Date(now.getFullYear(), 0, 10),
                    verifiedById: adminUser.id,
                  },
                  {
                    category: "CV_OR_RESUME",
                    title: "Professional CV",
                    fileKey: "docs/evans-cv-2024.pdf",
                    fileUrl:
                      "https://storage.buildmarket.co.ke/docs/evans-cv-2024.pdf",
                    mimeType: "application/pdf",
                    size: 156000,
                    status: "VERIFIED",
                    verifiedAt: lastYear,
                    verifiedById: adminUser.id,
                  },
                ],
              },
            },
          },
        },
      });

      // ============================================================
      // 5. PORTFOLIOS
      // ============================================================
      console.log("📸 Creating portfolios...");

      await tx.portfolio.upsert({
        where: { slug: "modern-office-complex-westlands" },
        update: {},
        create: {
          id: "portfolio-001",
          professionalId: idealProfessional.id,
          title: "Modern Office Complex - Westlands",
          slug: "modern-office-complex-westlands",
          description:
            "A 12-story Class A office complex featuring an innovative structural system with post-tensioned concrete floors and a sustainable facade design. The project achieved EDGE certification for green building standards.",
          projectType: "COMMERCIAL",
          tags: [
            "office building",
            "high-rise",
            "sustainable",
            "EDGE certified",
            "commercial",
          ],
          location: "Westlands, Nairobi",
          county: "NAIROBI",
          budget: 850000000,
          currency: "KES",
          durationValue: 24,
          durationUnit: "MONTHS",
          completionDate: new Date(now.getFullYear() - 1, 3, 15),
          isVerified: true,
          clientTestimonial:
            "Evans and his team delivered exceptional structural engineering services. The innovative design saved us 15% on construction costs while maintaining the highest safety standards.",
          clientName: "Westlands Commercial Properties Ltd",
          images: {
            create: [
              {
                fileKey: "portfolio/office-complex-exterior-main.jpg",
                fileUrl:
                  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab",
                mimeType: "image/jpeg",
                size: 520000,
                width: 1920,
                height: 1280,
                blurDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
                caption: "Completed office complex exterior view",
                category: "FINISHED_WORK",
                isMain: true,
                sortOrder: 0,
                uploadedById: idealProfessional.id,
              },
              {
                fileKey: "portfolio/office-complex-construction.jpg",
                fileUrl:
                  "https://images.unsplash.com/photo-1504307651254-35680f356dfd",
                mimeType: "image/jpeg",
                size: 480000,
                width: 1920,
                height: 1280,
                caption: "Construction phase - structural framework",
                category: "WORK_IN_PROGRESS",
                isMain: false,
                sortOrder: 1,
                uploadedById: idealProfessional.id,
              },
              {
                fileKey: "portfolio/office-complex-lobby.jpg",
                fileUrl:
                  "https://images.unsplash.com/photo-1497366216548-37526070297c",
                mimeType: "image/jpeg",
                size: 450000,
                width: 1920,
                height: 1280,
                caption: "Grand lobby entrance",
                category: "FINISHED_WORK",
                isMain: false,
                sortOrder: 2,
                uploadedById: idealProfessional.id,
              },
              {
                fileKey: "portfolio/office-complex-structural-plan.jpg",
                fileUrl:
                  "https://images.unsplash.com/photo-1503387762-592deb58ef4e",
                mimeType: "image/jpeg",
                size: 380000,
                width: 1920,
                height: 1280,
                caption: "Structural design blueprint",
                category: "BLUEPRINT_OR_PLAN",
                isMain: false,
                sortOrder: 3,
                uploadedById: idealProfessional.id,
              },
            ],
          },
        },
      });

      await tx.portfolio.upsert({
        where: { slug: "luxury-residence-karen" },
        update: {},
        create: {
          id: "portfolio-002",
          professionalId: idealProfessional.id,
          title: "Luxury Residence - Karen",
          slug: "luxury-residence-karen",
          description:
            "A stunning 6-bedroom luxury home featuring cantilevered structures, floor-to-ceiling glass walls, and an infinity pool overlooking the Ngong Hills. The structural design maximizes open spaces while ensuring seismic safety.",
          projectType: "RESIDENTIAL",
          tags: [
            "luxury home",
            "residential",
            "karen",
            "modern architecture",
            "infinity pool",
          ],
          location: "Karen, Nairobi",
          county: "NAIROBI",
          budget: 120000000,
          currency: "KES",
          durationValue: 18,
          durationUnit: "MONTHS",
          completionDate: new Date(now.getFullYear() - 2, 8, 10),
          isVerified: true,
          clientTestimonial:
            "The attention to detail in the structural design allowed for the ambitious architectural vision to become reality. Truly world-class engineering.",
          clientName: "Private Client",
          images: {
            create: [
              {
                fileKey: "portfolio/karen-residence-exterior.jpg",
                fileUrl:
                  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6",
                mimeType: "image/jpeg",
                size: 560000,
                width: 1920,
                height: 1280,
                caption: "Front elevation of completed residence",
                category: "FINISHED_WORK",
                isMain: true,
                sortOrder: 0,
                uploadedById: idealProfessional.id,
              },
              {
                fileKey: "portfolio/karen-residence-pool.jpg",
                fileUrl:
                  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9",
                mimeType: "image/jpeg",
                size: 520000,
                width: 1920,
                height: 1280,
                caption: "Infinity pool with Ngong Hills view",
                category: "FINISHED_WORK",
                isMain: false,
                sortOrder: 1,
                uploadedById: idealProfessional.id,
              },
            ],
          },
        },
      });

      // ============================================================
      // 6. PROJECT (Active project between client and professional)
      // ============================================================
      console.log("🏗️ Creating projects...");

      const activeProject = await tx.project.upsert({
        where: { id: "project-001" },
        update: {},
        create: {
          id: "project-001",
          clientId: idealClient.id,
          professionalId: idealProfessional.id,
          title: "Kilimani Apartment Complex",
          description:
            "A 6-story residential apartment complex with 48 units, featuring modern amenities including rooftop gardens, gymnasium, and underground parking.",
          type: "RESIDENTIAL",
          contractType: "FULL_CONTRACT",
          status: "IN_PROGRESS",
          isDisputed: false,
          location: "Kilimani, Nairobi",
          siteAddress: "Plot LR No. 1234/5678, Along Argwings Kodhek Road",
          county: "NAIROBI",
          coordinates: { lat: -1.2921, lng: 36.7896 },
          agreedPrice: 450000000,
          totalPaid: 180000000,
          totalInvoiced: 225000000,
          retentionPercentage: 5,
          retentionAmount: 22500000,
          retentionReleaseDate: new Date(now.getFullYear() + 1, 5, 30),
          startDate: new Date(now.getFullYear(), 0, 15),
          endDate: new Date(now.getFullYear() + 1, 6, 30),
          milestones: {
            create: [
              {
                title: "Foundation & Excavation",
                description:
                  "Site preparation, excavation, and foundation works",
                amount: 45000000,
                isPaid: true,
                status: "COMPLETED",
                approvalStatus: "APPROVED",
                approvedAt: new Date(now.getFullYear(), 2, 15),
                dueDate: new Date(now.getFullYear(), 2, 1),
                completedAt: new Date(now.getFullYear(), 2, 10),
              },
              {
                title: "Structural Framework - Floors 1-3",
                description:
                  "Concrete columns, beams, and slabs for lower floors",
                amount: 90000000,
                isPaid: true,
                status: "COMPLETED",
                approvalStatus: "APPROVED",
                approvedAt: new Date(now.getFullYear(), 5, 20),
                dueDate: new Date(now.getFullYear(), 5, 15),
                completedAt: new Date(now.getFullYear(), 5, 18),
              },
              {
                title: "Structural Framework - Floors 4-6",
                description:
                  "Concrete columns, beams, and slabs for upper floors",
                amount: 90000000,
                isPaid: false,
                status: "IN_PROGRESS",
                approvalStatus: "PENDING",
                dueDate: new Date(now.getFullYear(), 8, 30),
              },
              {
                title: "Finishes & MEP",
                description: "Electrical, plumbing, and interior finishes",
                amount: 120000000,
                isPaid: false,
                status: "PENDING",
                approvalStatus: "PENDING",
                dueDate: new Date(now.getFullYear() + 1, 3, 30),
              },
            ],
          },
        },
      });

      // ============================================================
      // 7. STORE (Professional's hardware store)
      // ============================================================
      console.log("🏪 Creating store...");

      const professionalStore = await tx.store.upsert({
        where: { id: "store-001" },
        update: {},
        create: {
          id: "store-001",
          professionalId: idealProfessional.id,
          name: "Ndegwa Engineering Supplies",
          slug: "ndegwa-engineering-supplies",
          description:
            "Premium construction materials and engineering supplies. Authorized distributor of major brands including Bamburi Cement, ARM Steel, and Davis & Shirtliff pumps.",
          logoUrl: "https://storage.buildmarket.co.ke/stores/ndegwa-logo.png",
          bannerUrl:
            "https://images.unsplash.com/photo-1504307651254-35680f356dfd",
          contactPhone: "+254798765432",
          whatsappNumber: "+254798765432",
          email: "supplies@ndegwa-engineers.co.ke",
          website: "https://ndegwa-engineers.co.ke/supplies",
          mpesaTillNumber: "123456",
          mpesaPaybill: "4001234",
          acceptsCard: true,
          acceptsCash: true,
          address: "Industrial Area, Enterprise Road",
          city: "Nairobi",
          county: "NAIROBI",
          neighborhood: "Industrial Area",
          zipCode: "00100",
          coordinates: { lat: -1.3048, lng: 36.8472 },
          latitude: -1.3048,
          longitude: 36.8472,
          storeType: "DISTRIBUTOR",
          categories: [
            "BUILDING_MATERIALS",
            "STEEL_AND_METALS",
            "SAFETY_AND_TOOLS",
          ],
          deliveryOption: "DELIVERY_AVAILABLE",
          deliveryRadiusKm: 30,
          baseDeliveryFee: 2000,
          minOrderValue: 10000,
          operatingHours: {
            monday: { open: "07:30", close: "18:00" },
            tuesday: { open: "07:30", close: "18:00" },
            wednesday: { open: "07:30", close: "18:00" },
            thursday: { open: "07:30", close: "18:00" },
            friday: { open: "07:30", close: "18:00" },
            saturday: { open: "08:00", close: "14:00" },
            sunday: null,
          },
          isOpen: true,
          businessRegNo: "PVT-2015-012345",
          kraPin: "P123456789Y",
          verified: true,
          verificationStatus: "VERIFIED",
          verificationNotes:
            "All business permits and distributor licenses verified.",
          verifiedAt: lastYear,
          featured: true,
          rating: 4.6,
          reviewCount: 89,
          products: {
            create: [
              {
                name: "Bamburi Portland Cement 50kg",
                slug: "bamburi-portland-cement-50kg",
                description:
                  "High-quality Portland cement for general construction",
                price: 850,
                category: "BUILDING_MATERIALS",
                stockQuantity: 100,
              },
              {
                name: "Y16 Deformed Steel Bar (12m)",
                slug: "y16-deformed-steel-bar-12m",
                description:
                  "High-tensile deformed steel reinforcement bar, 16mm diameter",
                price: 1200,
                category: "STEEL_AND_METALS",
                stockQuantity: 500,
              },
              {
                name: "Dawa Waterproofing Compound 20L",
                slug: "dawa-waterproofing-compound-20l",
                description: "Integral waterproofing admixture for concrete",
                price: 4500,
                category: "BUILDING_MATERIALS",
                stockQuantity: 20,
              },
            ],
          },
          images: {
            create: [
              {
                fileKey: "stores/ndegwa-storefront.jpg",
                fileUrl:
                  "https://images.unsplash.com/photo-1504307651254-35680f356dfd",
                mimeType: "image/jpeg",
                size: 450000,
                width: 1920,
                height: 1080,
                category: "STOREFRONT",
                caption: "Main storefront entrance",
                isMain: true,
                sortOrder: 0,
                uploadedById: idealProfessional.id,
              },
              {
                fileKey: "stores/ndegwa-warehouse.jpg",
                fileUrl:
                  "https://images.unsplash.com/photo-1565617587748-84d5e4a9e0a0",
                mimeType: "image/jpeg",
                size: 380000,
                width: 1920,
                height: 1080,
                category: "WAREHOUSE",
                caption: "Warehouse with stock",
                isMain: false,
                sortOrder: 1,
                uploadedById: idealProfessional.id,
              },
            ],
          },
          documents: {
            create: [
              {
                type: "BUSINESS_PERMIT",
                fileKey: "stores/docs/ndegwa-business-permit.pdf",
                fileUrl:
                  "https://storage.buildmarket.co.ke/stores/docs/ndegwa-business-permit.pdf",
                mimeType: "application/pdf",
                size: 125000,
                status: "APPROVED",
                verified: true,
                verifiedAt: lastYear,
                issueDate: new Date(now.getFullYear(), 0, 1),
                expiryDate: new Date(now.getFullYear() + 1, 0, 1),
                uploadedById: idealProfessional.id,
              },
              {
                type: "KRA_TAX_COMPLIANCE",
                fileKey: "stores/docs/ndegwa-tcc.pdf",
                fileUrl:
                  "https://storage.buildmarket.co.ke/stores/docs/ndegwa-tcc.pdf",
                mimeType: "application/pdf",
                size: 98000,
                status: "APPROVED",
                verified: true,
                verifiedAt: new Date(now.getFullYear(), 0, 10),
                issueDate: new Date(now.getFullYear(), 0, 5),
                expiryDate: new Date(now.getFullYear() + 1, 0, 4),
                uploadedById: idealProfessional.id,
              },
            ],
          },
        },
      });

      // ============================================================
      // 8. REVIEWS
      // ============================================================
      console.log("⭐ Creating reviews...");

      await tx.review.upsert({
        where: { id: "review-001" },
        update: {},
        create: {
          id: "review-001",
          reviewerId: idealClient.id,
          professionalId: idealProfessional.id,
          projectId: activeProject.id,
          isVerified: true,
          type: "PROFESSIONAL",
          rating: 5,
          subRatings: {
            communication: 5,
            quality: 5,
            timeliness: 4,
            professionalism: 5,
            valueForMoney: 5,
          },
          title: "Exceptional Structural Engineering Services",
          comment:
            "Evans and his team at Ndegwa Structural Engineers delivered outstanding work on our apartment complex project. Their expertise in structural design is evident in the quality of the construction. Communication was excellent throughout, with regular site visits and detailed progress reports. Highly recommended for any major construction project.",
          status: "PUBLISHED",
          replyComment:
            "Thank you for your kind words, Don! It has been a pleasure working with you on the Kilimani project. We look forward to collaborating on future developments.",
          replyAt: new Date(now.getFullYear(), 6, 5),
          helpfulCount: 24,
          reportedCount: 0,
        },
      });

      await tx.review.upsert({
        where: { id: "review-002" },
        update: {},
        create: {
          id: "review-002",
          reviewerId: idealClient.id,
          storeId: professionalStore.id,
          type: "STORE",
          rating: 5,
          subRatings: {
            productQuality: 5,
            delivery: 4,
            pricing: 5,
            customerService: 5,
          },
          title: "Reliable Supplier for Construction Materials",
          comment:
            "We have been sourcing materials from Ndegwa Engineering Supplies for our Kilimani project. Excellent quality products, competitive pricing, and reliable delivery. The team is knowledgeable and always ready to assist.",
          status: "PUBLISHED",
          helpfulCount: 12,
        },
      });

      // ============================================================
      // 9. LEADS
      // ============================================================
      console.log("📋 Creating leads...");

      await tx.lead.upsert({
        where: { id: "lead-001" },
        update: {},
        create: {
          id: "lead-001",
          professionalId: idealProfessional.id,
          clientId: idealClient.id,
          clientName: "Don Shammah",
          clientEmail: "don.shammah@buildmarket.com",
          clientPhone: "+254712345678",
          title: "New Commercial Development - Mombasa Road",
          description:
            "Looking for structural engineering services for a new 8-story commercial development along Mombasa Road. Need preliminary design consultation and cost estimates.",
          projectType: "COMMERCIAL",
          location: "Mombasa Road, Nairobi",
          county: "NAIROBI",
          budget: 75000000,
          budgetMin: 50000000,
          budgetMax: 100000000,
          currency: "KES",
          status: "PROPOSAL",
          priority: "HIGH",
          source: "PLATFORM_SEARCH",
          notes:
            "Client is ready to proceed once proposal is approved. Fast-track timeline expected.",
          lastContactedAt: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 2,
          ),
          followUpDate: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 3,
          ),
          reminderSent: false,
        },
      });

      await tx.lead.upsert({
        where: { id: "lead-002" },
        update: {},
        create: {
          id: "lead-002",
          professionalId: idealProfessional.id,
          clientName: "ABC Developers Ltd",
          clientEmail: "info@abcdevelopers.co.ke",
          clientPhone: "+254723456789",
          title: "Hospital Expansion Project",
          description:
            "Seeking structural engineering consultancy for hospital wing expansion. Project includes new ICU block and emergency department.",
          projectType: "COMMERCIAL",
          location: "Nairobi CBD",
          county: "NAIROBI",
          budgetMin: 200000000,
          budgetMax: 350000000,
          status: "NEW",
          priority: "URGENT",
          source: "REFERRAL",
          notes: "Referred by Dr. Kamau from previous hospital project.",
          followUpDate: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
          ),
        },
      });

      // ============================================================
      // 10. CALENDAR EVENTS
      // ============================================================
      console.log("📅 Creating calendar events...");

      await tx.calendarEvent.upsert({
        where: { id: "event-001" },
        update: {},
        create: {
          id: "event-001",
          professionalId: idealProfessional.id,
          clientId: idealClient.id,
          projectId: activeProject.id,
          guestEmails: [
            "contractor@buildmarket.com",
            "architect@buildmarket.com",
          ],
          title: "Kilimani Project - Site Inspection",
          description:
            "Monthly site inspection to review progress on floors 4-6 structural works. Will assess concrete curing, rebar installation, and MEP coordination.",
          type: "SITE_VISIT",
          status: "SCHEDULED",
          startDate: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 7,
            10,
            0,
          ),
          endDate: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 7,
            13,
            0,
          ),
          isAllDay: false,
          timeZone: "Africa/Nairobi",
          location: "Kilimani Construction Site, Argwings Kodhek Road",
          reminders: [30, 60, 1440], // 30 mins, 1 hour, 1 day before
          color: "#4CAF50",
        },
      });

      await tx.calendarEvent.upsert({
        where: { id: "event-002" },
        update: {},
        create: {
          id: "event-002",
          professionalId: idealProfessional.id,
          title: "EBK License Renewal Deadline",
          description:
            "Deadline to submit EBK license renewal application and documentation.",
          type: "DEADLINE",
          status: "SCHEDULED",
          startDate: twoYearsFromNow,
          endDate: twoYearsFromNow,
          isAllDay: true,
          timeZone: "Africa/Nairobi",
          reminders: [1440, 10080, 43200], // 1 day, 1 week, 1 month before
          color: "#F44336",
        },
      });

      // ============================================================
      // 11. NOTIFICATIONS
      // ============================================================
      console.log("🔔 Creating notifications...");

      await tx.notification.create({
        data: {
          userId: idealProfessional.id,
          title: "New Lead Received",
          message:
            "You have received a new lead from ABC Developers Ltd for a hospital expansion project. Priority: Urgent.",
          type: "LEAD",
          priority: "HIGH",
          channels: ["IN_APP", "EMAIL", "PUSH"],
          metadata: { leadId: "lead-002" },
          link: getProfessionalLeadUrl("lead-002"),
          isRead: false,
          deliveryStatus: "DELIVERED",
        },
      });

      await tx.notification.create({
        data: {
          userId: idealClient.id,
          title: "Milestone Update",
          message:
            'Milestone "Structural Framework - Floors 4-6" is now 75% complete for your Kilimani Apartment Complex project.',
          type: "PROJECT",
          priority: "MEDIUM",
          channels: ["IN_APP", "EMAIL"],
          metadata: { projectId: activeProject.id },
          link: getProjectUrl("project-001"),
          isRead: false,
          deliveryStatus: "DELIVERED",
        },
      });

      // ============================================================
      // 12. SYSTEM SETTINGS (Platform Configuration)
      // ============================================================
      console.log("⚙️ Creating system settings...");

      await tx.systemSettings.upsert({
        where: { id: "global" },
        update: {},
        create: {
          id: "global",
          // Availability
          maintenanceMode: false,
          maintenanceMessage: null,
          allowedIPs: [],

          // Onboarding
          publicSignup: true,
          allowProfessionalSignup: true,
          emailVerificationRequired: true,

          // Financials (Kenya-specific)
          currency: "KES",
          platformCommission: 10.0, // 10% platform commission
          vatRate: 16.0, // Kenya VAT rate
          withholdingTaxRate: 5.0, // Withholding tax on services
          minWithdrawalKes: 1000.0, // Minimum KES 1,000 withdrawal
          maxWithdrawalKes: 150000.0, // M-Pesa limit

          // Verification & Compliance
          enforceStrictVerification: true,
          enforceProfessionalLicenses: true,
          enableAutoVerifyNCA: false, // Manual NCA verification
          enableAutoVerifyEPRA: false, // Manual EPRA verification
          enableAutoVerifyBORAQS: false, // Manual BORAQS verification
          enforcePropertyDocuments: true,
          enableLandRegistryCheck: false, // Future integration
          enforceStorePermits: true,
          requireTaxCompliance: false, // Optional for now

          // Dynamic Rules (aligned with DEFAULT_VERIFICATION_RULES)
          verificationRules: {
            requiredLicenses: {
              STRUCTURAL_ENGINEER: ["EBK"],
              CIVIL_ENGINEER: ["EBK"],
              MECHANICAL_ENGINEER: ["EBK"],
              ELECTRICAL_ENGINEER: ["EBK"],
              ARCHITECT: ["BORAQS"],
              LANDSCAPE_ARCHITECT: ["BORAQS"],
              QUANTITY_SURVEYOR: ["BORAQS"],
              LAND_SURVEYOR: ["ISK"],
              REAL_ESTATE_VALUER: ["VRB"],
              GENERAL_CONTRACTOR: ["NCA"],
              ELECTRICIAN: ["EPRA"],
              SOLAR_ENERGY_TECHNICIAN: ["EPRA"],
            },
            requiredDocuments: {
              STRUCTURAL_ENGINEER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
              CIVIL_ENGINEER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
              MECHANICAL_ENGINEER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
              ELECTRICAL_ENGINEER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
              ARCHITECT: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
              LANDSCAPE_ARCHITECT: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
              QUANTITY_SURVEYOR: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
              LAND_SURVEYOR: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
              REAL_ESTATE_VALUER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
              GENERAL_CONTRACTOR: [
                "ID_OR_PASSPORT",
                "KRA_TAX_COMPLIANCE",
                "BUSINESS_REGISTRATION",
              ],
              ELECTRICIAN: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
              SOLAR_ENERGY_TECHNICIAN: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
              PLUMBER: [
                "ID_OR_PASSPORT",
                "NCA_ACCREDITATION",
                "KRA_TAX_COMPLIANCE",
              ],
              MASON: [
                "ID_OR_PASSPORT",
                "NCA_ACCREDITATION",
                "KRA_TAX_COMPLIANCE",
              ],
              CARPENTER: [
                "ID_OR_PASSPORT",
                "NCA_ACCREDITATION",
                "KRA_TAX_COMPLIANCE",
              ],
              PAINTER: [
                "ID_OR_PASSPORT",
                "NCA_ACCREDITATION",
                "KRA_TAX_COMPLIANCE",
              ],
              ROOFER: [
                "ID_OR_PASSPORT",
                "NCA_ACCREDITATION",
                "KRA_TAX_COMPLIANCE",
              ],
              HVAC_TECHNICIAN: [
                "ID_OR_PASSPORT",
                "NCA_ACCREDITATION",
                "KRA_TAX_COMPLIANCE",
              ],
              INTERIOR_DESIGNER: [
                "ID_OR_PASSPORT",
                "KRA_TAX_COMPLIANCE",
                "PORTFOLIO_DOC",
              ],
              PROJECT_MANAGER: [
                "ID_OR_PASSPORT",
                "KRA_TAX_COMPLIANCE",
                "PROFESSIONAL_CERT",
              ],
              OTHER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
            },
            requiredStoreDocuments: [
              "BUSINESS_REGISTRATION",
              "KRA_PIN_CERTIFICATE",
              "KRA_TAX_COMPLIANCE",
              "ID_OR_PASSPORT",
              "LEASE_OR_OWNERSHIP",
              "TRADING_LICENSE",
            ],
            requiredPropertyDocuments: [
              "TITLE_DEED",
              "OFFICIAL_SEARCH",
              "ID_OR_PASSPORT",
              "LAND_RENT_CLEARANCE",
              "LAND_RATES_COMPLIANCE",
              "MUTATION_FORM",
              "SECTIONAL_PROPERTIES_ACT_DOC",
            ],
            maxUploadAttempts: 3,
            maxDocumentsPerProfessional: 50,
            maxDocumentsPerStore: 20,
            maxDocumentsPerProperty: 15,
            autoRejectAfterDays: 30,
            urgentPendingThresholdHours: 48,
            escalationThresholdHours: 72,
            documentQuality: {
              maxFileSizeMB: 10,
              allowedMimeTypes: [
                "application/pdf",
                "image/jpeg",
                "image/png",
                "image/webp",
              ],
              minPortfolioProjects: 3,
              minStoreProducts: 10,
              minPropertyImages: 5,
            },
            rejectionReasonCodes: [
              "EXPIRED_DOCUMENT",
              "POOR_QUALITY",
              "INFO_MISMATCH",
              "MISSING_REQUIRED",
              "SUSPICIOUS",
              "INCOMPLETE_PROFILE",
            ],
            version: "1.0",
          },
          featureFlags: {
            enableMessaging: true,
            enableIdeaBooks: true,
            enableStores: true,
            enableProperties: true,
            enableQuotes: true,
            enablePayments: true,
            enableAnalytics: true,
            betaFeatures: {
              aiMatching: false,
              videoConsultation: false,
            },
          },

          // Support
          supportEmail: "support@buildmarket.co.ke",
          supportPhone: "+254700000000",
          whatsappNumber: "+254700000000",

          // Security
          securityMFA: false, // Disabled for ease of testing
          adminEmailAlerts: true,
          sessionTimeoutMins: 60,
          maxUploadSizeMB: 10,
          allowedFileTypes: [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
          ],

          // Versions
          termsVersion: "1.0",
          privacyPolicyVersion: "1.0",
          minAppVersion: "1.0.0",
        },
      });

      // ============================================================
      // 13. PROPERTY (Real Estate Listing)
      // ============================================================
      console.log("🏡 Creating property listings...");

      const luxuryProperty = await tx.property.upsert({
        where: { id: "property-001" },
        update: {},
        create: {
          id: "property-001",
          title: "Stunning 4-Bedroom Villa with Pool in Karen",
          slug: "stunning-4-bedroom-villa-karen",
          description: `A magnificent 4-bedroom villa set on a half-acre landscaped garden in the prestigious Karen neighborhood.

This architectural masterpiece features:
- Spacious master bedroom with en-suite bathroom and walk-in closet
- 3 additional bedrooms, each with en-suite bathrooms
- Grand living room with floor-to-ceiling windows
- Modern open-plan kitchen with granite countertops and premium appliances
- Private infinity pool overlooking the Ngong Hills
- Separate guest cottage
- Staff quarters
- 3-car garage with automated doors
- 24/7 security with CCTV and electric fence

Perfect for executives and families seeking luxury living in a serene environment. Minutes from Karen Country Club, shopping centers, and international schools.`,
          type: "SALE",
          category: "RESIDENTIAL",

          // Pricing
          price: 85000000, // KES 85 million
          currency: "KES",
          priceNegotiable: true,
          serviceCharge: 25000, // Monthly service charge
          depositRequired: "10% of purchase price",
          paymentTerms:
            "Flexible payment plans available. Bank financing accepted.",

          // Tenure
          tenure: "FREEHOLD",
          titleDeedReady: true,

          // Property Details
          bedrooms: 4,
          bathrooms: 5,
          parkingSpaces: 3,
          buildingSize: 450.0, // 450 sqm
          plotSize: 2023.0, // Half acre = ~2023 sqm
          areaUnit: "SQ_METERS",
          yearBuilt: 2021,
          furnishing: "SEMI_FURNISHED",
          completionStatus: "READY_TO_MOVE",

          // Location
          location: "Karen, Nairobi",
          address: "Karen Road, Near Karen Country Club",
          county: "NAIROBI",
          constituency: "Lang'ata",
          neighbourhood: "Karen",
          coordinates: { lat: -1.3226, lng: 36.7114 },
          latitude: -1.3226,
          longitude: 36.7114,
          nearbyLandmarks: {
            schools: ["Braeburn School", "Hillcrest International"],
            shopping: ["Karen Hub", "The Hub Karen"],
            hospitals: ["Karen Hospital", "Nairobi Hospital"],
            other: ["Karen Country Club", "Giraffe Centre"],
          },

          // Amenities
          hasBorehole: true,
          hasBackupGenerator: true,
          hasElevator: false,
          hasCCTV: true,
          isGatedCommunity: true,
          features: [
            "Swimming Pool",
            "Garden",
            "Guest Cottage",
            "Staff Quarters",
            "Solar Water Heating",
            "Fiber Internet Ready",
            "Water Tank",
            "Electric Fence",
            "Intercom System",
            "Built-in Wardrobes",
            "Air Conditioning",
            "Fireplace",
          ],

          // Status
          status: "AVAILABLE",
          featured: true,
          verified: true,
          verifiedAt: lastYear,
          submittedAt: new Date(now.getFullYear() - 1, 0, 1),
          verificationStatus: "VERIFIED",
          verificationNotes: "Title deed verified with Ministry of Lands",

          // Statistics
          viewCount: 1250,
          inquiryCount: 47,

          // Agent
          agentId: idealProfessional.id,

          // Media
          floorPlanUrl:
            "https://storage.buildmarket.co.ke/properties/karen-villa-floorplan.pdf",
          videoUrl: "https://www.youtube.com/watch?v=example",
          virtualTourUrl: "https://my.matterport.com/show/?m=example",

          // Images
          images: {
            create: [
              {
                fileKey: "properties/karen-villa-exterior-main.jpg",
                url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6",
                mimeType: "image/jpeg",
                size: 580000,
                width: 1920,
                height: 1280,
                blurDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
                caption: "Front view of the villa",
                category: "EXTERIOR",
                tags: ["front", "exterior", "main"],
                isMain: true,
                sortOrder: 0,
                uploadedById: idealProfessional.id,
              },
              {
                fileKey: "properties/karen-villa-pool.jpg",
                url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9",
                mimeType: "image/jpeg",
                size: 520000,
                width: 1920,
                height: 1280,
                caption: "Infinity pool with Ngong Hills view",
                category: "AMENITIES",
                tags: ["pool", "outdoor", "view"],
                isMain: false,
                sortOrder: 1,
                uploadedById: idealProfessional.id,
              },
              {
                fileKey: "properties/karen-villa-living-room.jpg",
                url: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0",
                mimeType: "image/jpeg",
                size: 490000,
                width: 1920,
                height: 1280,
                caption: "Spacious living room with high ceilings",
                category: "LIVING_ROOM",
                tags: ["living room", "interior", "lounge"],
                isMain: false,
                sortOrder: 2,
                uploadedById: idealProfessional.id,
              },
              {
                fileKey: "properties/karen-villa-kitchen.jpg",
                url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136",
                mimeType: "image/jpeg",
                size: 460000,
                width: 1920,
                height: 1280,
                caption: "Modern kitchen with premium finishes",
                category: "KITCHEN",
                tags: ["kitchen", "interior", "modern"],
                isMain: false,
                sortOrder: 3,
                uploadedById: idealProfessional.id,
              },
              {
                fileKey: "properties/karen-villa-master-bedroom.jpg",
                url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
                mimeType: "image/jpeg",
                size: 440000,
                width: 1920,
                height: 1280,
                caption: "Master bedroom suite",
                category: "BEDROOM",
                tags: ["bedroom", "master", "interior"],
                isMain: false,
                sortOrder: 4,
                uploadedById: idealProfessional.id,
              },
              {
                fileKey: "properties/karen-villa-aerial.jpg",
                url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
                mimeType: "image/jpeg",
                size: 550000,
                width: 1920,
                height: 1280,
                caption: "Aerial view of the property",
                category: "AERIAL_VIEW",
                tags: ["aerial", "drone", "overview"],
                isMain: false,
                sortOrder: 5,
                uploadedById: idealProfessional.id,
              },
            ],
          },

          // Documents
          documents: {
            create: [
              {
                type: "TITLE_DEED",
                fileKey: "properties/docs/karen-villa-title-deed.pdf",
                url: "https://storage.buildmarket.co.ke/properties/docs/karen-villa-title-deed.pdf",
                mimeType: "application/pdf",
                size: 125000,
                status: "APPROVED",
                verifiedAt: lastYear,
                isPrivate: true,
                uploadedById: idealProfessional.id,
              },
              {
                type: "OFFICIAL_SEARCH",
                fileKey: "properties/docs/karen-villa-official-search.pdf",
                url: "https://storage.buildmarket.co.ke/properties/docs/karen-villa-official-search.pdf",
                mimeType: "application/pdf",
                size: 85000,
                status: "APPROVED",
                verifiedAt: lastYear,
                issueDate: new Date(now.getFullYear(), 0, 15),
                expiryDate: new Date(now.getFullYear(), 6, 15), // 6 months validity
                isPrivate: true,
                uploadedById: idealProfessional.id,
              },
              {
                type: "LAND_RATES_CLEARANCE",
                fileKey: "properties/docs/karen-villa-rates-clearance.pdf",
                url: "https://storage.buildmarket.co.ke/properties/docs/karen-villa-rates-clearance.pdf",
                mimeType: "application/pdf",
                size: 65000,
                status: "APPROVED",
                verifiedAt: lastYear,
                issueDate: new Date(now.getFullYear(), 0, 10),
                expiryDate: new Date(now.getFullYear() + 1, 0, 10),
                isPrivate: true,
                uploadedById: idealProfessional.id,
              },
            ],
          },

          // Attachments
          attachments: {
            create: [
              {
                title: "Floor Plan - All Levels",
                type: "FLOOR_PLAN",
                fileKey: "properties/attachments/karen-villa-floorplan.pdf",
                fileUrl:
                  "https://storage.buildmarket.co.ke/properties/attachments/karen-villa-floorplan.pdf",
                mimeType: "application/pdf",
                size: 1250000,
                downloadCount: 89,
                uploadedById: idealProfessional.id,
              },
              {
                title: "Property Brochure",
                type: "BROCHURE",
                fileKey: "properties/attachments/karen-villa-brochure.pdf",
                fileUrl:
                  "https://storage.buildmarket.co.ke/properties/attachments/karen-villa-brochure.pdf",
                mimeType: "application/pdf",
                size: 3500000,
                downloadCount: 156,
                uploadedById: idealProfessional.id,
              },
            ],
          },

          // Inquiries
          inquiries: {
            create: [
              {
                senderId: idealClient.id,
                name: "Don Shammah",
                email: "sohocarti@gmail.com",
                phone: "+254798798770",
                message:
                  "I am interested in scheduling a viewing for this property. Is it available this weekend?",
                status: "PENDING",
              },
            ],
          },
        },
      });

      // Create a second property - Apartment for Rent
      await tx.property.upsert({
        where: { id: "property-002" },
        update: {},
        create: {
          id: "property-002",
          title: "Modern 2-Bedroom Apartment in Kilimani",
          slug: "modern-2-bedroom-apartment-kilimani",
          description: `A beautifully finished 2-bedroom apartment in the heart of Kilimani, ideal for young professionals or small families.

Features include:
- 2 spacious bedrooms with built-in wardrobes
- Master en-suite with modern fittings
- Open-plan living and dining area
- Fully fitted kitchen
- Balcony with city views
- Secure basement parking

Walking distance to Yaya Centre and Valley Arcade. Easy access to CBD via Argwings Kodhek Road.`,
          type: "RENT",
          category: "RESIDENTIAL",
          price: 85000, // KES 85,000 monthly rent
          currency: "KES",
          priceNegotiable: false,
          serviceCharge: 5000,
          depositRequired: "2 months rent",
          paymentTerms: "Monthly in advance",
          tenure: "LEASEHOLD",
          leaseYearsRemaining: 95,
          bedrooms: 2,
          bathrooms: 2,
          parkingSpaces: 1,
          buildingSize: 95.0,
          areaUnit: "SQ_METERS",
          yearBuilt: 2019,
          furnishing: "UNFURNISHED",
          completionStatus: "READY_TO_MOVE",
          location: "Kilimani, Nairobi",
          address: "Argwings Kodhek Road",
          county: "NAIROBI",
          neighbourhood: "Kilimani",
          latitude: -1.2921,
          longitude: 36.7866,
          hasBorehole: true,
          hasBackupGenerator: true,
          hasCCTV: true,
          isGatedCommunity: true,
          features: [
            "Gym",
            "Rooftop Terrace",
            "Fiber Internet",
            "Lift",
            "Security Guard",
            "Backup Water",
          ],
          status: "AVAILABLE",
          featured: false,
          verified: true,
          verifiedAt: lastYear,
          verificationStatus: "VERIFIED",
          viewCount: 456,
          inquiryCount: 23,
          agentId: idealProfessional.id,
          images: {
            create: [
              {
                fileKey: "properties/kilimani-apt-living.jpg",
                url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688",
                mimeType: "image/jpeg",
                size: 420000,
                width: 1920,
                height: 1280,
                caption: "Open-plan living area",
                category: "LIVING_ROOM",
                isMain: true,
                sortOrder: 0,
                uploadedById: idealProfessional.id,
              },
            ],
          },
        },
      });

      console.log("✅ Comprehensive seed data created successfully!");
    },
    {
      maxWait: 10000, // 10s to acquire connection (default 2s causes P2028 with pg adapter)
      timeout: 120000, // 2min for full seed (default 5s is too short)
    },
  );
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
