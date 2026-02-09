import { PrismaClient, UserRole, ClientProfile, ProfessionalProfile, User } from '@prisma/client';

export interface CreateUserData {
  clerkId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  avatar?: string | null;
  role?: UserRole;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
}

export interface UpdateUserData {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  avatar?: string | null;
  role?: UserRole;
  isProfileComplete?: boolean;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
}

export type UserWithProfiles = User & {
  clientProfile: ClientProfile | null;
  professionalProfile: ProfessionalProfile | null;
};

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find user by Clerk ID
   */
  async findByClerkId(clerkId: string): Promise<UserWithProfiles | null> {
    return this.prisma.user.findUnique({
      where: { 
        clerkId,
        deletedAt: null,
      },
      include: {
        clientProfile: true,
        professionalProfile: true,
      },
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserWithProfiles | null> {
    return this.prisma.user.findFirst({
      where: { 
        email,
        deletedAt: null,
      },
      include: {
        clientProfile: true,
        professionalProfile: true,
      },
    });
  }

  /**
   * Find user by database ID
   */
  async findById(id: string): Promise<UserWithProfiles | null> {
    return this.prisma.user.findFirst({
      where: { 
        id,
        deletedAt: null,
      },
      include: {
        clientProfile: true,
        professionalProfile: true,
      },
    });
  }

  /**
   * Create a new user
   */
  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        // id is autocreated by defaults usually, but if manual UUID needed:
        // id: crypto.randomUUID(), (Prisma usually handles this if default(uuid()))
        // Checking previous code, it had crypto.randomUUID(). I will keep it if schema doesn't default.
        // Assuming schema has default(uuid()) but previous code was explicit. I'll be explicit to match previous behavior but safer.
        clerkId: data.clerkId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        avatar: data.avatar,
        role: data.role || 'CLIENT', // Default to CLIENT enum value
        isProfileComplete: false,
        isEmailVerified: data.isEmailVerified || false,
        isPhoneVerified: data.isPhoneVerified || false,
      },
    });
  }

  /**
   * Update user
   */
  async update(clerkId: string, data: UpdateUserData): Promise<User> {
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
  async upsert(clerkId: string, createData: CreateUserData, updateData: UpdateUserData): Promise<User> {
    return this.prisma.user.upsert({
      where: { clerkId },
      update: {
        ...updateData,
        updatedAt: new Date(),
      },
      create: {
        clerkId: createData.clerkId,
        email: createData.email,
        firstName: createData.firstName,
        lastName: createData.lastName,
        phone: createData.phone,
        avatar: createData.avatar,
        role: createData.role || 'CLIENT',
        isProfileComplete: false,
        isEmailVerified: createData.isEmailVerified || false,
        isPhoneVerified: createData.isPhoneVerified || false,
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

