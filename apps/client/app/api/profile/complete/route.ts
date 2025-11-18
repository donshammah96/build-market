import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@repo/db';
import { z } from 'zod';

// Validation schemas
const ClientProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(10, 'Phone number is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  zipCode: z.string().optional(),
});

const ProfessionalProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(10, 'Phone number is required'),
  companyName: z.string().min(1, 'Company name is required'),
  licenseNumber: z.string().optional(),
  yearsExperience: z.number().int().min(0).optional(),
  servicesOffered: z.array(z.string()).min(1, 'Select at least one service'),
  bio: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  country: z.string().optional(),
});

export async function POST(req: NextRequest) {
  console.log('===============================================');
  console.log('Profile Completion Request Started');
  console.log('===============================================');
  
  try {
    // Step 1: Authenticate user
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      console.error('Unauthorized: No clerkId found in session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`User authenticated: ${clerkId}`);

    // Step 2: Parse request body
    let body: any;
    try {
      body = await req.json();
      console.log('Request body received:', {
        role: body.role,
        hasFirstName: !!body.firstName,
        hasLastName: !!body.lastName,
        hasPhone: !!body.phone,
      });
    } catch (err) {
      console.error('Failed to parse request body:', err);
      return NextResponse.json(
        { error: 'Invalid request body', details: 'Could not parse JSON' },
        { status: 400 }
      );
    }

    const { role, ...profileData } = body;

    // Step 3: Validate role
    if (!role || !['client', 'professional'].includes(role)) {
      console.error('Invalid role:', role);
      return NextResponse.json(
        { error: 'Invalid role', details: 'Role must be either "client" or "professional"' },
        { status: 400 }
      );
    }

    // Step 4: Get or create user from database (handles webhook race condition)
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { clerkId },
        include: {
          clientProfile: true,
          professionalProfile: true,
        },
      });
      
      if (!user) {
        console.warn(`User not found in database for clerkId: ${clerkId}`);
        console.log('⚠️ Webhook may not have fired yet. Fetching from Clerk...');
        
        // Get user data from Clerk as fallback
        try {
          const { clerkClient } = await import('@clerk/nextjs/server');
          const client = await clerkClient();
          const clerkUserData = await client.users.getUser(clerkId);
          const userEmail = clerkUserData.emailAddresses[0]?.emailAddress || '';
          
          console.log('✓ Fetched user data from Clerk');
          
          // Check if user exists by email (webhook may have created it)
          const existingUserByEmail = await prisma.user.findUnique({
            where: { email: userEmail },
            include: {
              clientProfile: true,
              professionalProfile: true,
            },
          });

          if (existingUserByEmail) {
            console.log('✓ User found by email, updating clerkId');
            // Update the existing user with the correct clerkId
            user = await prisma.user.update({
              where: { email: userEmail },
              data: {
                clerkId: clerkId,
                firstName: clerkUserData.firstName || existingUserByEmail.firstName,
                lastName: clerkUserData.lastName || existingUserByEmail.lastName,
                phone: clerkUserData.phoneNumbers[0]?.phoneNumber || existingUserByEmail.phone,
              },
              include: {
                clientProfile: true,
                professionalProfile: true,
              },
            });
            console.log(`✓ User updated successfully: ${user.id}`);
          } else {
            // Create new user
            user = await prisma.user.create({
              data: {
                id: crypto.randomUUID(),
                clerkId: clerkId,
                email: userEmail,
                firstName: clerkUserData.firstName || undefined,
                lastName: clerkUserData.lastName || undefined,
                phone: clerkUserData.phoneNumbers[0]?.phoneNumber || undefined,
                role: role,
                isProfileComplete: false,
              },
            });
            console.log(`✓ User created successfully: ${user.id}`);
          }
        } catch (clerkErr: any) {
          console.error('Failed to create/update user from Clerk data:', clerkErr);
          
          // Check if this is a unique constraint error
          if (clerkErr?.code === 'P2002') {
            return NextResponse.json(
              { 
                error: 'User creation conflict', 
                details: 'Your account is being set up. Please try again in a moment.' 
              },
              { status: 409 }
            );
          }
          
          return NextResponse.json(
            { 
              error: 'User not found', 
              details: 'Please wait a moment and try again. Your account is being set up.' 
            },
            { status: 404 }
          );
        }
      } else {
        console.log(`✓ User found in database: ${user.id}`);
      }
    } catch (err) {
      console.error('Database error while fetching user:', err);
      return NextResponse.json(
        { error: 'Database error', details: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // Step 5: Process based on role
    if (role === 'client') {
      console.log('Processing CLIENT profile...');
      
      try {
        // Validate client data
        const validatedData = ClientProfileSchema.parse(profileData);
        console.log('Client data validated');

        // Update user in transaction
        await prisma.$transaction(async (tx) => {
          // Update user
          await tx.user.update({
            where: { id: user.id },
            data: {
              firstName: validatedData.firstName,
              lastName: validatedData.lastName,
              phone: validatedData.phone,
              role: 'client',
              isProfileComplete: true,
            },
          });

          // Create or update client profile
          await tx.clientProfile.upsert({
            where: { userId: user.id },
            update: {
              address: validatedData.address,
              city: validatedData.city,
              county: validatedData.county,
              zipCode: validatedData.zipCode,
            },
            create: {
              userId: user.id,
              address: validatedData.address,
              city: validatedData.city,
              county: validatedData.county,
              zipCode: validatedData.zipCode,
            },
          });
        });

        console.log('Client profile completed successfully');
        console.log('===============================================\n');

        return NextResponse.json({ 
          success: true, 
          message: 'Profile completed successfully',
          role: 'client'
        });

      } catch (err) {
        console.error('Error processing client profile:', err);
        
        if (err instanceof z.ZodError) {
          console.error('Validation errors:', JSON.stringify(err.issues, null, 2));
          return NextResponse.json(
            { 
              error: 'Validation error', 
              details: err.issues.map((issue: any) => ({
                field: issue.path.join('.'),
                message: issue.message
              }))
            },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { error: 'Failed to complete client profile', details: err instanceof Error ? err.message : 'Unknown error' },
          { status: 500 }
        );
      }

    } else if (role === 'professional') {
      console.log('Processing PROFESSIONAL profile...');
      
      try {
        // Validate professional data
        const validatedData = ProfessionalProfileSchema.parse(profileData);
        console.log('Professional data validated');

        // Update user in transaction
        await prisma.$transaction(async (tx) => {
          // Update user
          await tx.user.update({
            where: { id: user.id },
            data: {
              firstName: validatedData.firstName,
              lastName: validatedData.lastName,
              phone: validatedData.phone,
              role: 'professional',
              isProfileComplete: true,
            },
          });

          // Create or update professional profile
          await tx.professionalProfile.upsert({
            where: { userId: user.id },
            update: {
              companyName: validatedData.companyName,
              licenseNumber: validatedData.licenseNumber,
              yearsExperience: validatedData.yearsExperience,
              servicesOffered: validatedData.servicesOffered,
              bio: validatedData.bio,
              city: validatedData.city,
              county: validatedData.county,
              country: validatedData.country,
            },
            create: {
              userId: user.id,
              companyName: validatedData.companyName,
              licenseNumber: validatedData.licenseNumber,
              yearsExperience: validatedData.yearsExperience,
              servicesOffered: validatedData.servicesOffered,
              bio: validatedData.bio,
              city: validatedData.city,
              county: validatedData.county,
              country: validatedData.country,
            },
          });
        });

        console.log('Professional profile completed successfully');
        console.log('===============================================\n');

        return NextResponse.json({ 
          success: true, 
          message: 'Profile completed successfully',
          role: 'professional'
        });

      } catch (err) {
        console.error('Error processing professional profile:', err);
        
        if (err instanceof z.ZodError) {
          console.error('Validation errors:', JSON.stringify(err.issues, null, 2));
          return NextResponse.json(
            { 
              error: 'Validation error', 
              details: err.issues.map((e: any) => ({
                field: e.path.join('.'),
                message: e.message
              }))
            },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { error: 'Failed to complete professional profile', details: err instanceof Error ? err.message : 'Unknown error' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  } catch (error) {
    console.error('===============================================');
    console.error('FATAL ERROR in Profile Completion');
    console.error('===============================================');
    console.error(error);
    console.error('===============================================\n');
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check profile status
export async function GET() {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: {
        clientProfile: true,
        professionalProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      isProfileComplete: user.isProfileComplete,
      role: user.role,
      hasProfile: user.role === 'client' 
        ? !!user.clientProfile 
        : !!user.professionalProfile,
    });
  } catch (error) {
    console.error('Profile status error:', error);
    return NextResponse.json(
      { error: 'Failed to get profile status' },
      { status: 500 }
    );
  }
}

