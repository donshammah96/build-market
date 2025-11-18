// Type definitions aligned with Store schema
export interface Store {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  categories: string[];
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  products?: Product[];
  reviews?: StoreReview[];
  _count?: {
    products: number;
    reviews: number;
    orders: number;
  };
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  category: string;
  inStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreReview {
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
export interface VendorCardData {
  id: string;
  name: string;
  description?: string;
  categories: string[];
  verified: boolean;
  rating?: number;
  reviewCount?: number;
  productCount?: number;
  imageUrl?: string;
  location?: string; // Formatted: "City, State" or full address
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}
