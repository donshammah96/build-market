import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Use transaction for atomic operations
  await prisma.$transaction(async (tx) => {
    // Create users
    console.log('Creating users...');
    const client1 = await tx.user.upsert({
      where: { email: 'don.shammah@example.com' },
      update: {},
      create: {
        clerkId: 'user_test_client_1',
        email: 'don.shammah@example.com',
        firstName: 'Don',
        lastName: 'Shammah',
        role: 'client',
        isProfileComplete: true,
        clientProfile: {
          create: {
            address: '123 Main St',
            city: 'Nairobi',
            county: 'Nairobi',
            zipCode: '00100',
          },
        },
      },
    });

    const professional1 = await tx.user.upsert({
      where: { email: 'evans.ndegwa@example.com' },
      update: {},
      create: {
        clerkId: 'user_test_pro_1',
        email: 'evans.ndegwa@example.com',
        firstName: 'Evans',
        lastName: 'Ndegwa',
        role: 'professional',
        isProfileComplete: true,
        professionalProfile: {
          create: {
            companyName: 'Evannas Structural Engineering',
            licenseNumber: 'SE-12345',
            yearsExperience: 10,
            servicesOffered: [
              'Structural Engineering',
              'Civil Engineering',
              'Building Design',
            ],
            bio: 'Licensed structural engineer with 10 years of experience specializing in commercial and residential building design.',
            city: 'Nairobi',
            county: 'Nairobi',
            country: 'Kenya',
            verified: true,
          },
        },
      },
    });

    // Create portfolios
    console.log('Creating portfolios...');
    await tx.portfolio.upsert({
      where: {
        // Using a unique constraint would be better, but for now we'll create
        id: 'portfolio-1',
      },
      update: {},
      create: {
        id: 'portfolio-1',
        professionalId: professional1.id,
        title: 'Modern Office Complex',
        description: '5-story commercial office building',
        images: [
          'https://unsplash.com/photos/low-angle-photography-of-high-rise-building-pPxhM0CRzl4',
          'https://unsplash.com/photos/people-walking-near-buildings-kFoh7gacj_0',
        ],
        projectType: 'Commercial',
        clientTestimonial: 'Outstanding work! Evans delivered a structural design that was both innovative and cost-effective.',
      },
    });

    // Create reviews
    console.log('Creating reviews...');
    await tx.review.upsert({
      where: {
        id: 'review-1',
      },
      update: {},
      create: {
        id: 'review-1',
        reviewerId: client1.id,
        professionalId: professional1.id,
        type: 'professional',
        rating: 5,
        comment: 'Excellent service! Evans delivered a structural design that was both innovative and cost-effective.',
        approved: true,
      },
    });

    // Create certificates
    console.log('Creating certificates...');
    const now = new Date();
    const certificates = [
      {
        id: 'cert-1',
        professionalId: professional1.id,
        name: 'Professional Engineer (PE) License',
        issuer: 'Engineers Board of Kenya',
        issueDate: new Date('2014-06-15'),
        expiryDate: new Date('2025-06-15'),
        fileUrl: 'https://unsplash.com/photos/white-printer-paper-ojP_rEz7xr4',
        verificationStatus: 'verified' as const,
        verifiedAt: new Date(now.getFullYear() - 1, 0, 10),
        notes: 'License verified and active',
      },
      {
        id: 'cert-2',
        professionalId: professional1.id,
        name: 'Structural Engineering Certification',
        issuer: 'Institution of Engineers of Kenya',
        issueDate: new Date('2015-03-20'),
        expiryDate: new Date('2026-03-20'),
        fileUrl: 'https://example.com/certificates/structural-eng-cert.pdf',
        verificationStatus: 'verified' as const,
        verifiedAt: new Date(now.getFullYear() - 1, 0, 10),
        notes: 'Certification verified',
      },
      {
        id: 'cert-3',
        professionalId: professional1.id,
        name: 'Building Design and Construction Certificate',
        issuer: 'Kenya National Construction Authority',
        issueDate: new Date('2020-09-10'),
        expiryDate: new Date('2025-09-10'),
        fileUrl: 'https://example.com/certificates/building-design-cert.pdf',
        verificationStatus: 'pending' as const,
        notes: 'Awaiting verification',
      },
      {
        id: 'cert-4',
        professionalId: professional1.id,
        name: 'Advanced Structural Analysis Course',
        issuer: 'International Association for Bridge and Structural Engineering',
        issueDate: new Date('2023-11-05'),
        fileUrl: 'https://example.com/certificates/advanced-structural-analysis.pdf',
        verificationStatus: 'verified' as const,
        verifiedAt: new Date(now.getFullYear() - 1, 0, 15),
        notes: 'Continuing education certificate',
      },
    ];

    for (const cert of certificates) {
      await tx.certificate.upsert({
        where: { id: cert.id },
        update: {},
        create: cert,
      });
    }

    console.log('✅ Seed data created successfully');
  });
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });