import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper to create URL-friendly slugs (e.g., "Interior Design" -> "interior-design")
function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")     // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-");  // Replace multiple - with single -
}

async function main() {
  console.log("🌱 Starting Service migration...");

  // 1. Fetch all professionals with their current string arrays
  const professionals = await prisma.professionalProfile.findMany({
    select: {
      userId: true,
      servicesOffered: true,
    },
  });

  console.log(`Found ${professionals.length} professionals.`);

  // 2. Collect all unique service names across all professionals
  const uniqueServiceNames = new Set<string>();
  professionals.forEach((prof) => {
    prof.servicesOffered.forEach((service) => {
      if (service && service.trim().length > 0) {
        uniqueServiceNames.add(service.trim());
      }
    });
  });

  console.log(`Found ${uniqueServiceNames.size} unique services to create.`);

  // 3. Create (or update) Service records for each unique name
  const serviceMap = new Map<string, string>(); // Maps "Service Name" -> UUID

  for (const name of uniqueServiceNames) {
    const slug = slugify(name);
    
    // We use upsert to avoid errors if the service already exists
    const service = await prisma.service.upsert({
      where: { slug },
      update: {}, // No changes if exists
      create: {
        name,
        slug,
        icon: "default-icon", // You can change this default later
      },
    });
    
    serviceMap.set(name, service.id);
    console.log(`Processed Service: ${name} -> ${slug}`);
  }

  // 4. Link professionals to the new Service records
  console.log("🔗 Linking professionals to services...");
  
  for (const prof of professionals) {
    if (prof.servicesOffered.length === 0) continue;

    // Find the IDs of the services this professional offers
    const serviceIdsToConnect = prof.servicesOffered
      .map((name) => serviceMap.get(name.trim()))
      .filter((id): id is string => !!id); // Filter out undefined

    if (serviceIdsToConnect.length > 0) {
      await prisma.professionalProfile.update({
        where: { userId: prof.userId },
        data: {
          services: {
            connect: serviceIdsToConnect.map((id) => ({ id })),
          },
        },
      });
      console.log(`Linked user ${prof.userId} to ${serviceIdsToConnect.length} services.`);
    }
  }

  console.log("✅ Migration complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });