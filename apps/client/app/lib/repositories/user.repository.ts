import { PrismaClient, UserRole } from '@prisma/client';

export interface CreateUserData {
  clerkId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  role?: UserRole;
}

export interface UpdateUserData {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  role?: UserRole;
  isProfileComplete?: boolean;
}

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find user by Clerk ID
   */
  async findByClerkId(clerkId: string) {
    return this.prisma.user.findUnique({
      where: { clerkId },
      include: {
        clientProfile: true,
        professionalProfile: true,
      },
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        clientProfile: true,
        professionalProfile: true,
      },
    });
  }

  /**
   * Find user by database ID
   */
  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        clientProfile: true,
        professionalProfile: true,
      },
    });
  }

  /**
   * Create a new user
   */
  async create(data: CreateUserData) {
    return this.prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        clerkId: data.clerkId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role || 'client',
        isProfileComplete: false,
      },
    });
  }

  /**
   * Update user
   */
  async update(clerkId: string, data: UpdateUserData) {
    return this.prisma.user.update({
      where: { clerkId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Upsert user (create or update)
   */
  async upsert(clerkId: string, createData: CreateUserData, updateData: UpdateUserData) {
    return this.prisma.user.upsert({
      where: { clerkId },
      update: {
        ...updateData,
        updatedAt: new Date(),
      },
      create: {
        id: crypto.randomUUID(),
        clerkId: createData.clerkId,
        email: createData.email,
        firstName: createData.firstName,
        lastName: createData.lastName,
        phone: createData.phone,
        role: createData.role || 'client',
        isProfileComplete: false,
      },
    });
  }

  /**
   * Check if profile is complete
   */
  async isProfileComplete(clerkId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { isProfileComplete: true },
    });

    return user?.isProfileComplete || false;
  }
}

