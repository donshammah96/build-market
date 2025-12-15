/**
 * Profile Completion Utilities
 * 
 * Provides functions for calculating profile completion percentage
 * and identifying missing required fields for both client and professional profiles.
 */

import { 
  StructuredLogger, 
  CorrelationIdManager 
} from '@repo/resilience';

const logger = new StructuredLogger('profile-completion');

// Define required fields for each profile type
export const CLIENT_REQUIRED_FIELDS = {
  user: ['firstName', 'lastName', 'phone'] as const,
  profile: ['city'] as const,
};

export const CLIENT_OPTIONAL_FIELDS = {
  user: ['avatar'] as const,
  profile: ['address', 'county', 'zipCode'] as const,
};

export const PROFESSIONAL_REQUIRED_FIELDS = {
  user: ['firstName', 'lastName', 'phone'] as const,
  profile: ['companyName', 'servicesOffered', 'city', 'bio'] as const,
};

export const PROFESSIONAL_OPTIONAL_FIELDS = {
  user: ['avatar'] as const,
  profile: ['licenseNumber', 'yearsExperience', 'county', 'website', 'portfolioUrl'] as const,
};

// Field display names for UI
export const FIELD_LABELS: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  phone: 'Phone Number',
  avatar: 'Profile Photo',
  address: 'Address',
  city: 'City',
  county: 'County',
  zipCode: 'ZIP Code',
  companyName: 'Company Name',
  licenseNumber: 'License Number',
  yearsExperience: 'Years of Experience',
  servicesOffered: 'Services Offered',
  bio: 'Professional Bio',
  website: 'Website',
  portfolioUrl: 'Portfolio URL',
};

interface UserData {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  avatar?: string | null;
  role: 'client' | 'professional' | 'admin';
}

interface ClientProfileData {
  address?: string | null;
  city?: string | null;
  county?: string | null;
  zipCode?: string | null;
}

interface ProfessionalProfileData {
  companyName?: string | null;
  licenseNumber?: string | null;
  yearsExperience?: number | null;
  servicesOffered?: string[] | null;
  bio?: string | null;
  city?: string | null;
  county?: string | null;
  website?: string | null;
  portfolioUrl?: string | null;
}

export interface ProfileCompletionResult {
  percentage: number;
  requiredPercentage: number;
  optionalPercentage: number;
  isComplete: boolean;
  missingRequired: string[];
  missingOptional: string[];
  filledFields: string[];
  totalRequired: number;
  totalOptional: number;
  filledRequired: number;
  filledOptional: number;
}

/**
 * Check if a field has a valid value
 */
function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return true;
  return Boolean(value);
}

/**
 * Calculate profile completion for a client user
 */
export function calculateClientCompletion(
  user: UserData,
  profile: ClientProfileData | null
): ProfileCompletionResult {
  const correlationId = CorrelationIdManager.get() || 'unknown';
  
  const filledRequired: string[] = [];
  const missingRequired: string[] = [];
  const filledOptional: string[] = [];
  const missingOptional: string[] = [];

  // Check required user fields
  for (const field of CLIENT_REQUIRED_FIELDS.user) {
    if (hasValue(user[field])) {
      filledRequired.push(field);
    } else {
      missingRequired.push(field);
    }
  }

  // Check required profile fields
  for (const field of CLIENT_REQUIRED_FIELDS.profile) {
    if (profile && hasValue(profile[field as keyof ClientProfileData])) {
      filledRequired.push(field);
    } else {
      missingRequired.push(field);
    }
  }

  // Check optional user fields
  for (const field of CLIENT_OPTIONAL_FIELDS.user) {
    if (hasValue(user[field])) {
      filledOptional.push(field);
    } else {
      missingOptional.push(field);
    }
  }

  // Check optional profile fields
  for (const field of CLIENT_OPTIONAL_FIELDS.profile) {
    if (profile && hasValue(profile[field as keyof ClientProfileData])) {
      filledOptional.push(field);
    } else {
      missingOptional.push(field);
    }
  }

  const totalRequired = CLIENT_REQUIRED_FIELDS.user.length + CLIENT_REQUIRED_FIELDS.profile.length;
  const totalOptional = CLIENT_OPTIONAL_FIELDS.user.length + CLIENT_OPTIONAL_FIELDS.profile.length;
  
  // Required fields count for 80%, optional for 20%
  const requiredPercentage = Math.round((filledRequired.length / totalRequired) * 80);
  const optionalPercentage = Math.round((filledOptional.length / totalOptional) * 20);
  const percentage = requiredPercentage + optionalPercentage;
  
  const isComplete = missingRequired.length === 0;

  logger.debug('Client profile completion calculated', {
    correlationId,
    percentage,
    isComplete,
    filledRequired: filledRequired.length,
    totalRequired,
  });

  return {
    percentage,
    requiredPercentage,
    optionalPercentage,
    isComplete,
    missingRequired,
    missingOptional,
    filledFields: [...filledRequired, ...filledOptional],
    totalRequired,
    totalOptional,
    filledRequired: filledRequired.length,
    filledOptional: filledOptional.length,
  };
}

/**
 * Calculate profile completion for a professional user
 */
export function calculateProfessionalCompletion(
  user: UserData,
  profile: ProfessionalProfileData | null
): ProfileCompletionResult {
  const correlationId = CorrelationIdManager.get() || 'unknown';
  
  const filledRequired: string[] = [];
  const missingRequired: string[] = [];
  const filledOptional: string[] = [];
  const missingOptional: string[] = [];

  // Check required user fields
  for (const field of PROFESSIONAL_REQUIRED_FIELDS.user) {
    if (hasValue(user[field])) {
      filledRequired.push(field);
    } else {
      missingRequired.push(field);
    }
  }

  // Check required profile fields
  for (const field of PROFESSIONAL_REQUIRED_FIELDS.profile) {
    if (profile && hasValue(profile[field as keyof ProfessionalProfileData])) {
      filledRequired.push(field);
    } else {
      missingRequired.push(field);
    }
  }

  // Check optional user fields
  for (const field of PROFESSIONAL_OPTIONAL_FIELDS.user) {
    if (hasValue(user[field])) {
      filledOptional.push(field);
    } else {
      missingOptional.push(field);
    }
  }

  // Check optional profile fields
  for (const field of PROFESSIONAL_OPTIONAL_FIELDS.profile) {
    if (profile && hasValue(profile[field as keyof ProfessionalProfileData])) {
      filledOptional.push(field);
    } else {
      missingOptional.push(field);
    }
  }

  const totalRequired = PROFESSIONAL_REQUIRED_FIELDS.user.length + PROFESSIONAL_REQUIRED_FIELDS.profile.length;
  const totalOptional = PROFESSIONAL_OPTIONAL_FIELDS.user.length + PROFESSIONAL_OPTIONAL_FIELDS.profile.length;
  
  // Required fields count for 80%, optional for 20%
  const requiredPercentage = Math.round((filledRequired.length / totalRequired) * 80);
  const optionalPercentage = Math.round((filledOptional.length / totalOptional) * 20);
  const percentage = requiredPercentage + optionalPercentage;
  
  const isComplete = missingRequired.length === 0;

  logger.debug('Professional profile completion calculated', {
    correlationId,
    percentage,
    isComplete,
    filledRequired: filledRequired.length,
    totalRequired,
  });

  return {
    percentage,
    requiredPercentage,
    optionalPercentage,
    isComplete,
    missingRequired,
    missingOptional,
    filledFields: [...filledRequired, ...filledOptional],
    totalRequired,
    totalOptional,
    filledRequired: filledRequired.length,
    filledOptional: filledOptional.length,
  };
}

/**
 * Calculate profile completion based on user role
 */
export function calculateProfileCompletion(
  user: UserData,
  profile: ClientProfileData | ProfessionalProfileData | null
): ProfileCompletionResult {
  if (user.role === 'professional') {
    return calculateProfessionalCompletion(user, profile as ProfessionalProfileData);
  }
  return calculateClientCompletion(user, profile as ClientProfileData);
}

/**
 * Get human-readable labels for missing fields
 */
export function getMissingFieldLabels(fields: string[]): string[] {
  return fields.map(field => FIELD_LABELS[field] || field);
}
