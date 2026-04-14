import {
  AvailabilityStatus,
  ClientType,
  County,
  DocumentCategory,
  LicenseAuthority,
  Profession,
} from "@prisma/client";
import { z } from "zod";

/**
 * ADR-005 observable operationName inventory (profile-complete adapters):
 * - route_profile_complete (PATCH /api/user/profile/complete)
 * - update_client_profile_complete (PATCH /api/user/profile/complete/client)
 * - update_professional_profile_complete (PATCH /api/user/profile/complete/professional)
 * - update_client_profile_complete_routed (internal routed execution)
 * - update_professional_profile_complete_routed (internal routed execution)
 */

const LicenseSchema = z.object({
  licenseNumber: z.string().min(1, "License number is required"),
  authority: z.nativeEnum(LicenseAuthority),
  category: z.string().optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  fileUrl: z.string().url().optional().nullable(),
});

const DocumentSchema = z.object({
  id: z.string().optional(),
  category: z.nativeEnum(DocumentCategory),
  title: z.string().min(1, "Title is required"),
  issuer: z.string().optional().nullable(),
  issueDate: z.string().datetime().optional().nullable(),
  expiryDate: z.string().datetime().optional().nullable(),
  fileUrl: z.string().url(),
});

export const ClientProfileCompleteSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  phone: z.string().min(1, "Phone is required").optional(),
  avatar: z.string().url().optional().nullable(),
  bio: z.string().max(5000).optional().nullable(),
  emailMarketingConsent: z.boolean().optional(),
  smsMarketingConsent: z.boolean().optional(),
  analyticsConsent: z.boolean().optional(),
  type: z.nativeEnum(ClientType).optional(),
  companyName: z.string().optional().nullable(),
  companyRegistration: z.string().optional().nullable(),
  kraPin: z.string().optional().nullable(),
  vatRegistered: z.boolean().optional(),
  website: z.string().url().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  county: z.nativeEnum(County).optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  landmark: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  budgetRangeMin: z.number().min(0).optional().nullable(),
  budgetRangeMax: z.number().min(0).optional().nullable(),
  interests: z.array(z.string()).optional().nullable(),
  preferences: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const ProfessionalProfileCompleteSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  phone: z.string().min(1, "Phone is required").optional(),
  avatar: z.string().url().optional().nullable(),
  bio: z.string().max(5000).optional().nullable(),
  emailMarketingConsent: z.boolean().optional(),
  smsMarketingConsent: z.boolean().optional(),
  analyticsConsent: z.boolean().optional(),
  companyName: z.string().min(1).optional(),
  profession: z.nativeEnum(Profession).optional().nullable(),
  portfolioUrl: z.string().url().optional().nullable(),
  businessEmail: z.string().email().optional().nullable(),
  businessPhone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  socials: z.record(z.string(), z.string()).optional().nullable(),
  city: z.string().optional().nullable(),
  county: z.nativeEnum(County).optional().nullable(),
  country: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  serviceRadiusKm: z.number().int().min(0).max(500).optional().nullable(),
  availability: z.nativeEnum(AvailabilityStatus).optional(),
  operatingHours: z.record(z.string(), z.unknown()).optional().nullable(),
  kraPin: z.string().optional().nullable(),
  isInsured: z.boolean().optional(),
  insuranceExpiry: z.date().optional().nullable(),
  insuranceProvider: z.string().optional().nullable(),
  insurancePolicyNumber: z.string().optional().nullable(),
  yearsExperience: z.number().int().min(0).max(100).optional().nullable(),
  minProjectBudget: z.number().min(0).optional().nullable(),
  hourlyRate: z.number().min(0).optional().nullable(),
  acceptedPayments: z.array(z.string()).optional(),
  licenses: z.array(LicenseSchema).max(10).optional(),
  documents: z.array(DocumentSchema).max(20).optional(),
  deleteLicenseIds: z.array(z.string()).optional(),
  deleteDocumentIds: z.array(z.string()).optional(),
});

export type ClientProfileCompleteInput = z.infer<
  typeof ClientProfileCompleteSchema
>;

export type ProfessionalProfileCompleteInput = z.infer<
  typeof ProfessionalProfileCompleteSchema
>;
