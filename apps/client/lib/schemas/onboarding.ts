import { z } from 'zod';

// =============================================================================
// Homeowner Onboarding Schema
// =============================================================================

export const homeownerOnboardingSchema = z.object({
  projectType: z
    .string()
    .min(1, 'Please select a project type'),
  
  customProjectType: z
    .string()
    .optional(),
  
  projectLocation: z
    .string()
    .optional(),
  
  estimatedBudget: z
    .string()
    .optional(),
  
  description: z
    .string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional(),
}).refine(
  (data) => {
    // If projectType is 'other', customProjectType is required
    if (data.projectType === 'other') {
      return !!data.customProjectType && data.customProjectType.length > 0;
    }
    return true;
  },
  {
    message: 'Please describe your project type',
    path: ['customProjectType'],
  }
);

export type HomeownerOnboardingData = z.infer<typeof homeownerOnboardingSchema>;

// =============================================================================
// Professional Onboarding Schema
// =============================================================================

export const professionalOnboardingSchema = z.object({
  profession: z
    .string()
    .min(1, 'Please select your profession'),
  
  companyName: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name must be less than 100 characters'),
  
  licenseNumber: z
    .string()
    .min(1, 'License number is required for verification'),
  
  // File arrays are validated separately since they're File objects
  // These represent the uploaded file URLs after upload
  certificatesUrls: z
    .array(z.string().url())
    .optional(),
  
  idDocumentsUrls: z
    .array(z.string().url())
    .optional(),
});

export type ProfessionalOnboardingData = z.infer<typeof professionalOnboardingSchema>;

// =============================================================================
// Combined Onboarding Schema (matches API expectations)
// =============================================================================

export const clientOnboardingPayload = z.object({
  role: z.literal('client'),
  projectType: z.string().min(1),
  projectLocation: z.string().optional(),
  estimatedBudget: z.string().optional(),
  description: z.string().optional(),
});

export const professionalOnboardingPayload = z.object({
  role: z.literal('professional'),
  profession: z.string().min(1),
  companyName: z.string().min(2),
  licenseNumber: z.string().min(1),
  yearsExperience: z.number().optional(),
  portfolio: z.string().optional(),
  website: z.string().optional(),
  bio: z.string().optional(),
  certificatesUrls: z.array(z.string()).optional(),
  idDocumentsUrls: z.array(z.string()).optional(),
});

export type ClientOnboardingPayload = z.infer<typeof clientOnboardingPayload>;
export type ProfessionalOnboardingPayload = z.infer<typeof professionalOnboardingPayload>;
