// This file contains type definitions for your data.
// It describes the shape of the data, and what data type each property should accept.
// For simplicity of teaching, we're manually defining these types.
// However, these types are generated automatically if you're using an ORM such as Prisma.
export type User = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: string;
  phone: string;
  avatar_url: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  image_url: string;
};


export type CustomersTableType = {
  id: string;
  name: string;
  email: string;
  image_url: string;
  total_invoices: number;
  total_pending: number;
  total_paid: number;
};

export type FormattedCustomersTable = {
  id: string;
  name: string;
  email: string;
  image_url: string;
  total_invoices: number;
  total_pending: string;
  total_paid: string;
};

export type CustomerField = {
  id: string;
  name: string;
};

export type ClientsTableType = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  image_url: string;
  user_id: string;
  default_address_street: string;
  default_address_city: string;
  default_address_county: string;
  default_address_zip: string;
  default_address_country: string;
  default_address_latitude: number;
  default_address_longitude: number;
  contact_preference: string;
  project_budget_preference_min: number;
  project_budget_preference_max: number;
  project_budget_preference_currency: string;
  project_budget_preference_currency_symbol: string;
  project_budget_preference_currency_symbol_position: string;
  created_at: string;
  updated_at: string;
  last_login_at: string;
  total_invoices: number;
  total_pending: number;
  total_paid: number;
};

export type ClientField = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  image_url: string;
  total_invoices: number;
  total_pending: number;
  total_paid: number;
};

export type ClientForm = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  image_url: string;
  default_address_street: string;
  default_address_city: string;
  default_address_county: string;
  default_address_zip: string;
  default_address_country: string;
  default_address_latitude: number;
  default_address_longitude: number;
  contact_preference: string;
  project_budget_preference_min: number;
  project_budget_preference_max: number;
  project_budget_preference_currency: string;
  project_budget_preference_currency_symbol: string;
  project_budget_preference_currency_symbol_position: string;
};

export type ProfessionalField = {
  id: string;
  business_name: string;
  business_email: string;
  business_description: string;
};

export type ProfessionalForm = {
  id: string;
  user_id: string;
  business_name: string;
  business_email: string;
  business_description: string;
  image_url: string;
  years_of_experience: number;
  business_license_number: string;
  license_issuing_county: string;
  status: 'pending' | 'verified';
  business_address_street: string;
  business_address_city: string;
  business_address_county: string;
  business_address_zip: string;
  business_address_country: string;
  business_address_latitude: number;
  business_address_longitude: number;
  service_radius_kilometers: number;
  serves_remote: boolean;
  accepts_credit_cards: boolean;
  accepts_cash: boolean;
  accepts_mpesa: boolean;
  accepts_apple_pay: boolean;
  accepts_google_pay: boolean;
  accepts_bank_transfer: boolean;
  subscription_tier: string;
};

export type ProfessionalsTableType = {
  id: string;
  user_id: string;
  business_name: string;
  business_email: string;
  business_description: string;
  image_url: string;
  years_of_experience: number;
  business_license_number: string;
  license_issuing_county: string;
  status: 'pending' | 'verified';
  verified_at: string;
  verified_by: string;
  business_address_street: string;
  business_address_city: string;
  business_address_county: string;
  business_address_zip: string;
  business_address_country: string;
  business_address_latitude: number;
  business_address_longitude: number;
  service_radius_kilometers: number;
  serves_remote: boolean;
  accepts_credit_cards: boolean;
  accepts_cash: boolean;
  accepts_mpesa: boolean;
  accepts_apple_pay: boolean;
  accepts_google_pay: boolean;
  accepts_bank_transfer: boolean;
  average_rating: number;
  total_reviews: number;
  completed_projects: number;
  completed_projects_value: number;
  completed_projects_value_currency: string;
  completed_projects_value_currency_symbol: string;
  completed_projects_value_currency_symbol_position: string;
  subscription_tier: string;
  subscription_tier_expiration_date: string;
  is_profile_complete: boolean;
  profile_completed_at: string;
  created_at: string;
  updated_at: string;
  last_login_at: string;
};

export type Revenue = {
  month: string;
  revenue: number;
};

export type Invoice = {
  id: string;
  customer_id: string;
  amount: number;
  date: string;
  status: 'pending' | 'paid';
};

export type InvoiceForm = {
  id: string;
  customer_id: string;
  amount: number;
  status: 'pending' | 'paid';
};

export type LatestInvoice = {
  id: string;
  name: string;
  image_url: string;
  email: string;
  amount: string;
};

export type InvoicesTable = {
  id: string;
  customer_id: string;
  name: string;
  email: string;
  image_url: string;
  date: string;
  amount: number;
  status: 'pending' | 'paid';
};

export type ClientInvoice = {
  id: string;
  client_id: string;
  amount: number;
  date: string;
  status: 'pending' | 'paid';
};

export type ProfessionalInvoice = {
  id: string;
  professional_id: string;
  amount: number;
  date: string;
  status: 'pending' | 'paid';
};


export type ClientInvoiceRaw = Omit<ClientInvoice, 'amount'> & {
  amount: number;
};

export type ProfessionalInvoiceRaw = Omit<ProfessionalInvoice, 'amount'> & {
  amount: number;
};

// The database returns a number for amount, but we later format it to a string with the formatCurrency function
export type LatestInvoiceRaw = Omit<LatestInvoice, 'amount'> & {
  amount: number;
};

// Remove duplicate types - use ClientInvoice and ProfessionalInvoice instead
export type ClientInvoiceTable = ClientInvoice;
export type ProfessionalInvoiceTable = ProfessionalInvoice;

