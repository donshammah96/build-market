// Type definitions aligned with ProfessionalProfile schema

// Certificate data for display
export interface CertificateData {
  id: string;
  name: string;
  issuer: string;
  issueDate?: Date | string;
  expiryDate?: Date | string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date | string;
}

export interface ProfessionalProfile {
  userId: string;
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    phone?: string | null;
  };
  companyName: string;
  licenseNumber?: string | null;
  yearsExperience?: number | null;
  servicesOffered: string[];
  portfolioUrl?: string | null;
  profileUrl?: string | null;
  bio?: string | null;
  verified: boolean;
  certificates?: CertificateData[];
  createdAt: Date;
  updatedAt: Date;
  portfolios?: Portfolio[];
  reviews?: Review[];
  _count?: {
    reviews: number;
    projects: number;
  };
}

export interface Portfolio {
  id: string;
  professionalId: string;
  title: string;
  description?: string | null;
  images: string[];
  projectType: string;
  clientTestimonial?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Review {
  id: string;
  reviewerId: string;
  reviewer: {
    firstName?: string | null;
    lastName?: string | null;
  };
  rating: number;
  comment?: string | null;
  approved: boolean;
  createdAt: Date;
}


// For display purposes in cards/lists
export interface ProfessionalCardData {
  id: string;
  name: string;
  companyName: string;
  title: string; // main service/specialty
  bio?: string;
  servicesOffered: string[];
  yearsExperience?: number;
  verified: boolean;
  rating?: number;
  reviewCount?: number;
  portfolioImage?: string;
  profileImage?: string;
  city?: string;
  county?: string;
  country?: string;
  location?: string; // Formatted location string
  certificates?: CertificateData[];
  portfolioUrl?: string;
  profileUrl?: string;
}

export interface Location {
  city: string;
  county: string;
  zipCode: string;
}
