'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { ShieldCheck, CheckCircle2, Loader2, Award, Sparkles, AlertCircle } from 'lucide-react';
import { ProfessionalOnboardingData } from '@repo/types';
import { Combobox, ComboboxOption } from '../ui/combobox';
import { cn } from '@/lib/utils';
import { professionalOnboardingSchema, type ProfessionalOnboardingData as FormData } from '@/lib/schemas/onboarding';

// ============================================================================
// CONSTANTS
// ============================================================================

const PROFESSION_OPTIONS: ComboboxOption[] = [
  // Architecture & Design
  { value: "architect", label: "Architect" },
  { value: "interior_designer", label: "Interior Designer" },
  { value: "landscape_architect", label: "Landscape Architect" },
  { value: "urban_planner", label: "Urban Planner" },
  { value: "draftsman", label: "Draftsman / CAD Technician" },
  
  // Engineering
  { value: "structural_engineer", label: "Structural Engineer" },
  { value: "civil_engineer", label: "Civil Engineer" },
  { value: "mechanical_engineer", label: "Mechanical Engineer (HVAC)" },
  { value: "electrical_engineer", label: "Electrical Engineer" },
  { value: "geotechnical_engineer", label: "Geotechnical Engineer" },
  { value: "environmental_engineer", label: "Environmental Engineer" },
  { value: "water_engineer", label: "Water & Sanitation Engineer" },
  
  // Construction Management
  { value: "construction_manager", label: "Construction Manager" },
  { value: "project_manager", label: "Project Manager" },
  { value: "site_supervisor", label: "Site Supervisor / Foreman" },
  { value: "quantity_surveyor", label: "Quantity Surveyor" },
  { value: "estimator", label: "Construction Estimator" },
  { value: "clerk_of_works", label: "Clerk of Works" },
  
  // Contractors
  { value: "general_contractor", label: "General Contractor" },
  { value: "building_contractor", label: "Building Contractor" },
  { value: "roofing_contractor", label: "Roofing Contractor" },
  { value: "flooring_contractor", label: "Flooring Contractor" },
  { value: "painting_contractor", label: "Painting Contractor" },
  { value: "demolition_contractor", label: "Demolition Contractor" },
  
  // Specialized Trades
  { value: "plumber", label: "Plumber" },
  { value: "electrician", label: "Electrician" },
  { value: "hvac_technician", label: "HVAC Technician" },
  { value: "mason", label: "Mason / Bricklayer" },
  { value: "carpenter", label: "Carpenter" },
  { value: "welder", label: "Welder / Fabricator" },
  { value: "glazier", label: "Glazier (Glass Work)" },
  { value: "tiler", label: "Tiler" },
  { value: "plasterer", label: "Plasterer" },
  { value: "waterproofing_specialist", label: "Waterproofing Specialist" },
  
  // Real Estate
  { value: "real_estate_agent", label: "Real Estate Agent" },
  { value: "realtor", label: "Realtor" },
  { value: "realty_company", label: "Realty Company" },
  { value: "property_developer", label: "Property Developer" },
  { value: "land_surveyor", label: "Land Surveyor" },
  { value: "property_valuator", label: "Property Valuator" },
  
  // Specialists
  { value: "solar_installer", label: "Solar Panel Installer" },
  { value: "pool_builder", label: "Pool Builder" },
  { value: "landscaper", label: "Landscaper" },
  { value: "security_systems", label: "Security Systems Installer" },
  { value: "smart_home_specialist", label: "Smart Home Specialist" },
  { value: "fire_safety_specialist", label: "Fire Safety Specialist" },
  { value: "acoustic_consultant", label: "Acoustic Consultant" },
  
  // Suppliers
  { value: "building_materials_supplier", label: "Building Materials Supplier" },
  { value: "hardware_supplier", label: "Hardware Supplier" },
  { value: "sanitary_supplier", label: "Sanitary Ware Supplier" },
  
  // Other
  { value: "other", label: "Other" },
];

// ============================================================================
// TYPES
// ============================================================================

interface Props {
  onBack: () => void;
  onSubmit: (data: ProfessionalOnboardingData) => Promise<void>;
  onAuthSuccess: (response: ProfessionalOnboardingData) => void;
}

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  type: ToastType;
  message: string;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const Toast: React.FC<ToastState> = ({ type, message }) => {
  const baseClasses = 'px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-2 duration-300';
  const typeClasses: Record<ToastType, string> = {
    success: 'bg-emerald-600/90 text-white border border-emerald-500/50',
    error: 'bg-red-600/90 text-white border border-red-500/50',
    info: 'bg-zinc-800/90 text-white border border-zinc-700/50',
  };
  
  return (
    <div className={cn(baseClasses, typeClasses[type])}>
      {type === 'info' && <Loader2 className="h-4 w-4 animate-spin" />}
      {type === 'success' && <CheckCircle2 className="h-4 w-4" />}
      {message}
    </div>
  );
};

const FormField: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
  error?: string;
}> = ({ label, children, hint, required, error }) => (
  <div className="space-y-2">
    <label className="flex items-center justify-between text-emerald-400 text-xs uppercase tracking-widest font-semibold">
      <span className="flex items-center gap-2">
        {label}
        {required && <span className="text-amber-500">*</span>}
      </span>
      {hint}
    </label>
    {children}
    {error && (
      <p className="text-xs text-red-400 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    )}
  </div>
);

const FileListItem: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => (
  <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-lg text-sm text-white border border-white/20">
    <div className="truncate pr-2 flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-emerald-500" />
      {file.name}
    </div>
    <button 
      type="button" 
      onClick={onRemove} 
      className="text-xs text-slate-400 hover:text-red-400 ml-2 transition-colors"
    >
      Remove
    </button>
  </div>
);

const GoldHeader: React.FC = () => (
  <div className="text-center mb-8 relative">
    {/* Decorative glow effect */}
    <div className="absolute inset-0 -top-4 flex items-center justify-center pointer-events-none">
      <div className="w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
    </div>
    
    {/* Gold decorative line with icon */}
    <div className="relative inline-flex items-center justify-center gap-4 mb-4">
      <div className="h-px w-16 bg-gradient-to-r from-transparent via-amber-500/50 to-amber-500" />
      <div className="relative">
        <div className="absolute inset-0 animate-pulse">
          <Award className="h-10 w-10 text-amber-500/30" />
        </div>
        <Award className="h-10 w-10 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]" />
      </div>
      <div className="h-px w-16 bg-gradient-to-l from-transparent via-amber-500/50 to-amber-500" />
    </div>
    
    {/* Main heading with gradient */}
    <h2 className="relative text-3xl md:text-4xl font-bold mb-3">
      <span className="bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-lg">
        Join the Gold Standard
      </span>
      <Sparkles className="absolute -top-1 -right-6 h-5 w-5 text-amber-400 animate-pulse" />
    </h2>
    
    {/* Subtitle */}
    <p className="text-slate-300 text-sm max-w-sm mx-auto">
      Verification is mandatory. Please have your{' '}
      <span className="text-amber-400 font-medium">NCA</span> or{' '}
      <span className="text-amber-400 font-medium">board registration</span> ready.
    </p>
    
    {/* Trust indicators */}
    <div className="flex items-center justify-center gap-6 mt-4 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        Verified Only
      </span>
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        Quality Leads
      </span>
    </div>
  </div>
);

const SuccessCard: React.FC<{ 
  onEdit: () => void; 
  onGoDashboard: () => void;
  isNavigating?: boolean;
}> = ({ onEdit, onGoDashboard, isNavigating }) => (
  <div className="bg-white/5 backdrop-blur-sm border border-white/20 p-8 max-w-md mx-auto text-center rounded-xl">
    <div className="mb-4 text-amber-500">
      <Award className="w-12 h-12 inline-block drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
    </div>
    <h3 className="font-playfair text-2xl text-white mb-2 drop-shadow-lg">
      Thanks — application received
    </h3>
    <p className="text-slate-200 mb-6">
      Our team will review your documents and contact you within 3 business days for verification.
    </p>
    <div className="flex gap-4 justify-center">
      <button 
        onClick={onGoDashboard}
        disabled={isNavigating}
        className="text-sm border-b border-emerald-400/50 pb-1 text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {isNavigating && <Loader2 className="h-3 w-3 animate-spin" />}
        Go to Dashboard
      </button>
      <button 
        onClick={onEdit} 
        disabled={isNavigating}
        className="text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
      >
        Edit application
      </button>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ProfessionalForm: React.FC<Props> = ({ onBack, onSubmit, onAuthSuccess }) => {
  // React Hook Form with Zod validation
  const {
    register,
    control,
    handleSubmit: rhfHandleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(professionalOnboardingSchema),
    defaultValues: {
      profession: '',
      companyName: '',
      licenseNumber: '',
    },
  });

  // File state (kept separate as files are complex objects)
  const [certificates, setCertificates] = useState<File[] | null>(null);
  const [idDocuments, setIdDocuments] = useState<File[] | null>(null);

  // UI state
  const [toast, setToast] = useState<ToastState | null>(null);
  const [success, setSuccess] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Handle navigation to dashboard with hard refresh
  const handleGoDashboard = useCallback(async () => {
    setNavigating(true);
    await new Promise(resolve => setTimeout(resolve, 4000));
    window.location.href = '/professional-portal/dashboard';
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
  }, []);

  // File handlers
  const onCertificatesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setCertificates(files.length ? files : null);
  };

  const onIdDocumentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setIdDocuments(files.length ? files : null);
  };

  const removeCertificate = (index: number) => {
    if (!certificates) return;
    const next = certificates.filter((_, i) => i !== index);
    setCertificates(next.length ? next : null);
  };

  const removeIdDocument = (index: number) => {
    if (!idDocuments) return;
    const next = idDocuments.filter((_, i) => i !== index);
    setIdDocuments(next.length ? next : null);
  };

  // Upload helper
  const uploadFiles = async (files: File[] | null, fieldName: string): Promise<string[]> => {
    if (!files || files.length === 0) return [];
    
    const form = new FormData();
    files.forEach((f) => form.append(fieldName, f));
    
    const res = await fetch('/api/onboarding/uploads', { method: 'POST', body: form });
    
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || `Upload failed with ${res.status}`);
    }
    
    const json = await res.json();
    const uploaded = (json.uploaded && json.uploaded[fieldName]) 
      ? json.uploaded[fieldName].map((i: { url: string }) => i.url) 
      : [];
    return uploaded;
  };

  // Form submission handler
  const onFormSubmit = async (formData: FormData) => {
    try {
      showToast('info', 'Uploading documents and submitting your application…');

      // Upload files
      let certificatesUrls: string[] = [];
      let idDocumentsUrls: string[] = [];

      if (certificates?.length) {
        certificatesUrls = await uploadFiles(certificates, 'certificates');
      }
      if (idDocuments?.length) {
        idDocumentsUrls = await uploadFiles(idDocuments, 'idDocuments');
      }

      // Construct payload
      const payload: ProfessionalOnboardingData = {
        role: 'professional',
        profession: formData.profession,
        companyName: formData.companyName,
        licenseNumber: formData.licenseNumber,
        yearsExperience: 0,
        portfolio: '',
        website: '',
        bio: '',
        certificatesUrls,
        idDocumentsUrls,
      };

      await onSubmit(payload);
      
      setSuccess(true);
      showToast('success', 'Application received. You will be contacted for verification.');
      onAuthSuccess(payload);

    } catch (err) {
      console.error('Professional submit error', err);
      const message = err instanceof Error ? err.message : 'Failed to submit. Please try again.';
      showToast('error', message);
    }
  };

  if (success) {
    return (
      <SuccessCard 
        onEdit={() => setSuccess(false)} 
        onGoDashboard={handleGoDashboard}
        isNavigating={navigating}
      />
    );
  }

  return (
    <form onSubmit={rhfHandleSubmit(onFormSubmit)} className="max-w-md mx-auto">
      {/* Toast notification */}
      {toast && (
        <div className="mb-4">
          <Toast type={toast.type} message={toast.message} />
        </div>
      )}

      {/* Gold themed header */}
      <GoldHeader />

      {/* Form fields */}
      <div className="space-y-6">
        {/* Profession */}
        <FormField label="Profession" required error={errors.profession?.message}>
          <Controller
            name="profession"
            control={control}
            render={({ field }) => (
              <Combobox
                options={PROFESSION_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                placeholder="Search or select profession..."
                searchPlaceholder="Type to search professions..."
                emptyMessage="No matching profession found."
                className={cn(
                  "w-full bg-white/5 border text-white hover:bg-white/10",
                  errors.profession ? "border-red-500/50" : "border-white/30"
                )}
              />
            )}
          />
        </FormField>

        {/* Company Name */}
        <FormField label="Company Name" required error={errors.companyName?.message}>
          <input
            type="text"
            placeholder="Your Firm's Legal Name"
            {...register('companyName')}
            className={cn(
              "w-full bg-white/5 p-3 text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors rounded-md border",
              errors.companyName ? "border-red-500/50" : "border-white/30"
            )}
          />
        </FormField>

        {/* License Number */}
        <FormField 
          label="NCA / Board License #" 
          required
          error={errors.licenseNumber?.message}
          hint={
            <span className="text-[10px] text-amber-400 flex items-center gap-1 font-normal normal-case tracking-normal">
              <ShieldCheck className="h-3 w-3" />
              Required for Verification
            </span>
          }
        >
          <input
            type="text"
            placeholder="e.g. NCA/1234/5678"
            {...register('licenseNumber')}
            className={cn(
              "w-full bg-white/5 p-3 text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors rounded-md border",
              errors.licenseNumber ? "border-red-500/50" : "border-white/30"
            )}
          />
        </FormField>

        {/* Certificates upload */}
        <FormField label="Certificates (NCA / Board) — optional">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={onCertificatesChange}
            className="block w-full text-sm text-white bg-white/5 p-2 rounded-md border border-white/30 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 file:cursor-pointer file:transition-colors"
          />
          <div className="mt-2 space-y-2">
            {certificates?.length ? (
              certificates.map((f, i) => (
                <FileListItem key={`${f.name}-${i}`} file={f} onRemove={() => removeCertificate(i)} />
              ))
            ) : (
              <div className="text-xs text-slate-500 italic">
                No certificates uploaded — you can submit and upload later.
              </div>
            )}
          </div>
        </FormField>

        {/* ID documents upload */}
        <FormField label="ID / Registration Documents — optional">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={onIdDocumentsChange}
            className="block w-full text-sm text-white bg-white/5 p-2 rounded-md border border-white/30 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 file:cursor-pointer file:transition-colors"
          />
          <div className="mt-2 space-y-2">
            {idDocuments?.length ? (
              idDocuments.map((f, i) => (
                <FileListItem key={`${f.name}-${i}`} file={f} onRemove={() => removeIdDocument(i)} />
              ))
            ) : (
              <div className="text-xs text-slate-500 italic">
                No ID documents uploaded — you can submit and upload later.
              </div>
            )}
          </div>
        </FormField>

        {/* Actions */}
        <div className="pt-4 space-y-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full font-bold py-3.5 px-6 rounded-lg text-white",
              "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600",
              "hover:from-amber-400 hover:via-yellow-400 hover:to-amber-500",
              "transition-all duration-200 shadow-lg",
              "hover:shadow-amber-500/30 hover:scale-[1.02]",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Apply for Verification
              </span>
            )}
          </button>
          
          <button 
            type="button" 
            onClick={onBack} 
            className="w-full text-center text-slate-400 text-xs hover:text-white transition-colors py-2"
          >
            ← Go Back
          </button>
        </div>
      </div>
    </form>
  );
};

export default ProfessionalForm;
