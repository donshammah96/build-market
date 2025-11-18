import z from "zod";
export interface CustomJwtSessionClaims {
    metadata?: {
        role?: "user" | "admin";
    };
}
export declare const UserFormSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    username: z.ZodString;
    emailAddress: z.ZodArray<z.ZodString>;
    password: z.ZodString;
}, z.core.$strip>;
export type UserRole = 'client' | 'professional' | 'admin';
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    clerkId: z.ZodString;
    email: z.ZodString;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    role: z.ZodEnum<{
        admin: "admin";
        client: "client";
        professional: "professional";
    }>;
    isProfileComplete: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type User = z.infer<typeof UserSchema>;
export declare const ClientProfileSchema: z.ZodObject<{
    userId: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    zipCode: z.ZodOptional<z.ZodString>;
    preferences: z.ZodOptional<z.ZodAny>;
    createdAt: z.ZodOptional<z.ZodDate>;
    updatedAt: z.ZodOptional<z.ZodDate>;
}, z.core.$strip>;
export type ClientProfile = z.infer<typeof ClientProfileSchema>;
export declare const ProfessionalProfileSchema: z.ZodObject<{
    userId: z.ZodString;
    companyName: z.ZodString;
    licenseNumber: z.ZodOptional<z.ZodString>;
    yearsExperience: z.ZodOptional<z.ZodNumber>;
    servicesOffered: z.ZodOptional<z.ZodArray<z.ZodString>>;
    portfolioUrl: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    verified: z.ZodBoolean;
    createdAt: z.ZodOptional<z.ZodDate>;
    updatedAt: z.ZodOptional<z.ZodDate>;
}, z.core.$strip>;
export type ProfessionalProfile = z.infer<typeof ProfessionalProfileSchema>;
//# sourceMappingURL=auth.d.ts.map