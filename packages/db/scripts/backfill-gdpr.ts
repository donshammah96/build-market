import { PrismaClient, ConsentType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting GDPR Consent Backfill...');
  
  const users = await prisma.user.findMany({
    include: {
      consents: true
    }
  });

  console.log(`Found ${users.length} users.`);

  for (const user of users) {
    if (user.consents.length > 0) continue; // Skip if already has consent records

    console.log(`Backfilling user: ${user.email} (${user.role})`);

    const consentsToCreate: { type: ConsentType, granted: boolean }[] = [
      { type: 'TERMS_OF_SERVICE', granted: true }, // Assumed active for existing users
      { type: 'PRIVACY_POLICY', granted: true },
    ];

    // Migrating legacy flags
    if (user.marketingConsent || user.emailMarketingConsent) {
       consentsToCreate.push({ type: 'MARKETING_EMAIL', granted: true });
    }
    if (user.smsMarketingConsent) {
       consentsToCreate.push({ type: 'MARKETING_SMS', granted: true });
    }
    if (user.analyticsConsent) {
       consentsToCreate.push({ type: 'ANALYTICS_COOKIES', granted: true });
    }

    // Role specific
    if (user.role === 'PROFESSIONAL') {
        consentsToCreate.push({ type: 'KRA_DATA_SHARING', granted: true }); 
    }

    for (const c of consentsToCreate) {
      await prisma.consentRecord.create({
        data: {
          userId: user.id,
          type: c.type,
          granted: c.granted,
          grantedAt: new Date(), 
          documentVersion: 'legacy-migration-v1',
          ipAddress: 'migration-script'
        }
      });
    }
  }

  console.log('Backfill complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
