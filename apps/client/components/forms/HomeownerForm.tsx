'use client';

import React, { useState, useEffect } from 'react';
import { OnboardingData } from '@repo/types';
import { Combobox } from '../ui/combobox';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

const LOCATION_OPTIONS = [
  { value: "karen", label: "Karen" },
  { value: "runda", label: "Runda" },
  { value: "muthaiga", label: "Muthaiga" },
  { value: "kilimani", label: "Kilimani / Kileleshwa" },
  { value: "langata", label: "Lang'ata" },
  { value: "upperhill", label: "Upper Hill" },
  { value: "westlands", label: "Westlands" },
  { value: "lavington", label: "Lavington" },
  { value: "riverside", label: "Riverside" },
  { value: "gigiri", label: "Gigiri" },
  { value: "rosslyn", label: "Rosslyn" },
  { value: "thika_road", label: "Thika Road Environs" },
  { value: "limuru_road", label: "Limuru Road Environs" },
  { value: "ngong_road", label: "Ngong Road Environs" },
  { value: "mombasa_road", label: "Mombasa Road Environs" },
  { value: "syokimau", label: "Syokimau" },
  { value: "kitengela", label: "Kitengela" },
  { value: "ongata_rongai", label: "Ongata Rongai" },
  { value: "ruiru", label: "Ruiru" },
  { value: "kiambu", label: "Kiambu Environs" },
  { value: "kikuyu", label: "Kikuyu Environs" },
  { value: "other", label: "Other (Nairobi Environs)" },
];

// UI Components (mocked or imported from your UI library)
const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white/5 backdrop-blur-sm border border-white/20 ${className}`}>{children}</div>
);

const Button = ({ children, className, disabled, type, onClick, variant, size }: any) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className={`bg-emerald-600 text-white font-bold py-3 px-6 hover:bg-emerald-700 transition-colors shadow-lg ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
);

const Input = ({ placeholder, value, onChange }: any) => (
  <input
    type="text"
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    className="w-full bg-white/5 border border-white/30 p-3 text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors"
  />
);

const Select = ({ children, value, onChange, className }: any) => (
  <select
    value={value}
    onChange={onChange}
    className={`w-full bg-white/5 border border-white/30 p-3 text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors ${className}`}
  >
    {children}
  </select>
);

interface Props {
  onBack: () => void;
  onSubmit: (data: OnboardingData) => Promise<void>;
  onAuthSuccess: (response: any) => void;
  onSkip?: () => void; // Optional: allows skipping onboarding
}

const Toast = ({ type, message }: { type: 'success' | 'error' | 'info'; message: string }) => {
  const base = 'px-4 py-2 rounded-sm text-sm';
  const classes =
    type === 'success'
      ? 'bg-green-600 text-white'
      : type === 'error'
      ? 'bg-red-600 text-white'
      : 'bg-gray-800 text-white';
  return <div className={`${base} ${classes}`}>{message}</div>;
};

const HomeownerForm = ({ onBack, onSubmit, onAuthSuccess, onSkip }: Props) => {
  const { user } = useUser();
  const router = useRouter();

  const [projectType, setProjectType] = useState('');
  const [customProjectType, setCustomProjectType] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [role, setRole] = useState<'client'>('client');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Construct data matching ClientOnboardingData
    const data: OnboardingData = { 
      role, 
      projectType: projectType === 'Other' ? customProjectType : projectType, 
      projectLocation, 
      estimatedBudget, 
      description 
    };

    try {
      setSubmitting(true);
      setToast({ type: 'info', message: 'Submitting your details…' });

      // Parent handles API call
      await onSubmit(data);

      setToast({ type: 'success', message: 'Profile completed successfully!' });
      setSuccess(true);
      
      // Notify parent of success
      if (onAuthSuccess) onAuthSuccess(data);
      
    } catch (err: any) {
      console.error('Homeowner submit error', err);
      setToast({ type: 'error', message: err?.message || 'Failed to submit. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <div className="mb-4 text-emerald-400"><svg className="w-12 h-12 inline-block" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
        <h3 className="font-playfair text-2xl text-white mb-2 drop-shadow-lg">You're all set</h3>
        <p className="text-slate-200 mb-6">We've sent a confirmation email with instructions to complete your account. You can now sign in and begin connecting with vetted professionals.</p>
        <div className="flex gap-4 justify-center">
          <a href="/dashboard" className="text-sm border-b border-emerald-400/50 pb-1 text-emerald-400 hover:text-emerald-300 transition-colors">Proceed to Dashboard</a>
          <button onClick={() => { setSuccess(false); }} className="text-sm text-slate-400 hover:text-white transition-colors">Edit details</button>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <div className="mb-4">{toast && <Toast type={toast.type} message={toast.message} />}</div>

      <h2 className="font-playfair text-3xl text-white mb-2 drop-shadow-lg">Tell us about your vision.</h2>
      <p className="text-slate-200 mb-8 text-sm">We'll match you with professionals who specialize in your needs.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-emerald-400 text-xs uppercase tracking-widest mb-2 font-semibold">Project Type</label>
          <Select className="w-full bg-white/5 border border-white/30 text-white hover:bg-white/10" value={projectType} onChange={(e: any) => setProjectType(e.target.value)}>
            <option className="bg-slate-800 text-white">New Residential Build</option>
            <option className="bg-slate-800 text-white">Residential Renovation</option>
            <option className="bg-slate-800 text-white">Residential Development</option>
            <option className="bg-slate-800 text-white">Commercial Development</option>
            <option className="bg-slate-800 text-white">Commercial Renovation</option>
            <option className="bg-slate-800 text-white">Interior Design</option>
            <option className="bg-slate-800 text-white">Other</option>
          </Select>
          {projectType === 'Other' && (
            <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Input 
                placeholder="Please specify your project type" 
                value={customProjectType} 
                onChange={(e: any) => setCustomProjectType(e.target.value)} 
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-emerald-400 text-xs uppercase tracking-widest mb-2 font-semibold">Project Location</label>
          <Combobox
            options={LOCATION_OPTIONS}
            value={projectLocation}
            onChange={setProjectLocation}
            placeholder="Select a Location..."
            searchPlaceholder="Search location..."
            className="w-full bg-white/5 border border-white/30 text-white hover:bg-white/10"
          />
        </div>

        <div>
          <label className="block text-emerald-400 text-xs uppercase tracking-widest mb-2 font-semibold">Estimated Budget (KES)</label>
          <Input placeholder="e.g. 5,000,000 - 15,000,000" value={estimatedBudget} onChange={(e: any) => setEstimatedBudget(e.target.value)} />
        </div>

        <div>
          <label className="block text-emerald-400 text-xs uppercase tracking-widest mb-2 font-semibold">Project Description</label>
          <textarea
            className="flex min-h-[100px] w-full rounded-none border border-white/30 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 focus:border-emerald-400 transition-colors"
            placeholder="Describe your project vision, requirements, and any specific details..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="pt-4">
          <Button variant="default" className="w-full" size="lg" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Create Account'}
          </Button>
          
          {/* Skip option for homeowners */}
          {onSkip && (
            <div className="mt-4 text-center">
              <p className="text-zinc-400 text-xs mb-2">
                Not ready to fill this out? No problem.
              </p>
              <button 
                type="button" 
                onClick={onSkip} 
                disabled={submitting}
                className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Skip for now →
              </button>
              <p className="text-zinc-500 text-[10px] mt-1">
                You can complete your profile anytime from your dashboard
              </p>
            </div>
          )}
          
          <button type="button" onClick={onBack} className="w-full text-center text-slate-400 text-xs mt-4 hover:text-white transition-colors">
            Go Back
          </button>
        </div>
      </div>
    </form>
  );
};

export default HomeownerForm;
