import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Use transaction for atomic operations
  await prisma.$transaction(async (tx) => {
    // Create users
    console.log('Creating users...');
    const client1 = await tx.user.upsert({
      where: { email: 'don.shammah@buildmarket.com' },
      update: {},
      create: {
        clerkId: 'user_test_client_1',
        email: 'don.shammah@buildmarket.com',
        firstName: 'Don',
        lastName: 'Shammah',
        role: 'CLIENT',
        isProfileComplete: true,
        clientProfile: {
          create: {
            address: '123 Main St',
            city: 'Nairobi',
            county: 'NAIROBI',
            zipCode: '00100',
          },
        },
      },
    });

    const professional1 = await tx.user.upsert({
      where: { email: 'evans.ndegwa@buildmarket.com' },
      update: {},
      create: {
        clerkId: 'user_test_pro_1',
        email: 'evans.ndegwa@buildmarket.com',
        firstName: 'Evans',
        lastName: 'Ndegwa',
        role: 'PROFESSIONAL',
        isProfileComplete: true,
        professionalProfile: {
          create: {
            companyName: 'Evannas Structural Engineering',
            licenseNumber: 'SE-12345',
            yearsExperience: 10,
            specializations: [
              'Structural Engineering',
              'Civil Engineering',
              'Building Design',
            ],
            bio: 'Licensed structural engineer with 10 years of experience specializing in commercial and residential building design.',
            city: 'Nairobi',
            county: 'NAIROBI',
            country: 'KENYA',
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
        slug: 'modern-office-complex',
        description: '5-story commercial office building',
        images: {
          create: [
            {
              fileKey: 'evans-portfolio-1-img-1',
              fileUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab',
              mimeType: 'image/jpeg',
              size: 500000,
              width: 1920,
              height: 1280,
              caption: 'Modern office exterior',
              category: 'FINISHED_WORK',
              isMain: true,
              sortOrder: 0,
            },
            {
              fileKey: 'evans-portfolio-1-img-2',
              fileUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c',
              mimeType: 'image/jpeg',
              size: 450000,
              width: 1920,
              height: 1280,
              caption: 'Office building entrance',
              category: 'FINISHED_WORK',
              isMain: false,
              sortOrder: 1,
            },
          ],
        },
        projectType: 'COMMERCIAL',
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
        type: 'PROFESSIONAL',
        rating: 5,
        comment: 'Excellent service! Evans delivered a structural design that was both innovative and cost-effective.',
        status: 'PUBLISHED',
      },
    });

    // Create certificates
    console.log('Creating certificates...');
    const now = new Date();
    // Create certificates one by one with proper typing
    await tx.certificate.upsert({
      where: { id: 'cert-1' },
      update: {},
      create: {
        id: 'cert-1',
        professionalId: professional1.id,
        name: 'Professional Engineer (PE) License',
        issuer: 'Engineers Board of Kenya',
        issueDate: new Date('2014-06-15'),
        expiryDate: new Date('2025-06-15'),
        fileUrl: 'https://unsplash.com/photos/white-printer-paper-ojP_rEz7xr4',
        fileKey: 'evans-pe-license.pdf',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(now.getFullYear() - 1, 0, 10),
        notes: 'License verified and active',
      },
    });

    await tx.certificate.upsert({
      where: { id: 'cert-2' },
      update: {},
      create: {
        id: 'cert-2',
        professionalId: professional1.id,
        name: 'Structural Engineering Certification',
        issuer: 'Institution of Engineers of Kenya',
        issueDate: new Date('2015-03-20'),
        expiryDate: new Date('2026-03-20'),
        fileUrl: 'https://example.com/certificates/structural-eng-cert.pdf',
        fileKey: 'evans-structural-eng-cert.pdf',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(now.getFullYear() - 1, 0, 10),
        notes: 'Certification verified',
      },
    });

    await tx.certificate.upsert({
      where: { id: 'cert-3' },
      update: {},
      create: {
        id: 'cert-3',
        professionalId: professional1.id,
        name: 'Building Design and Construction Certificate',
        issuer: 'Kenya National Construction Authority',
        issueDate: new Date('2020-09-10'),
        expiryDate: new Date('2025-09-10'),
        fileUrl: 'https://example.com/certificates/building-design-cert.pdf',
        fileKey: 'evans-building-design-cert.pdf',
        verificationStatus: 'PENDING',
        notes: 'Awaiting verification',
      },
    });

    await tx.certificate.upsert({
      where: { id: 'cert-4' },
      update: {},
      create: {
        id: 'cert-4',
        professionalId: professional1.id,
        name: 'Advanced Structural Analysis Course',
        issuer: 'International Association for Bridge and Structural Engineering',
        issueDate: new Date('2023-11-05'),
        fileUrl: 'https://example.com/certificates/advanced-structural-analysis.pdf',
        fileKey: 'evans-advanced-structural-analysis.pdf',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(now.getFullYear() - 1, 0, 15),
        notes: 'Continuing education certificate',
      },
    });

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