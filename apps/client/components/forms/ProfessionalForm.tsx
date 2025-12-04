'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ProfessionalOnboardingData } from '@repo/types';

// UI Components (mocked or imported from your UI library)
// Assuming these exist or using simple HTML elements if not available in the context
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
  onSubmit: (data: ProfessionalOnboardingData) => Promise<void>;
  onAuthSuccess: (response: any) => void;
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

const FileListItem = ({ file, onRemove }: { file: File; onRemove: () => void }) => (
  <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-sm text-sm text-white border border-white/20">
    <div className="truncate pr-2">{file.name}</div>
    <button type="button" onClick={onRemove} className="text-xs text-slate-400 hover:text-white ml-2 transition-colors">Remove</button>
  </div>
);

const ProfessionalForm = ({ onBack, onSubmit, onAuthSuccess }: Props) => {
  const [profession, setProfession] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  const [certificates, setCertificates] = useState<File[] | null>(null);
  const [idDocuments, setIdDocuments] = useState<File[] | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

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

  // Upload helper: uploads files under fieldName to /api/uploads and returns array of URLs
  const uploadFiles = async (files: File[] | null, fieldName: string): Promise<string[]> => {
    if (!files || files.length === 0) return [];
    const form = new FormData();
    files.forEach((f) => form.append(fieldName, f));
    const res = await fetch('/api/uploads', { method: 'POST', body: form });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || `Upload failed with ${res.status}`);
    }
    const json = await res.json();
    // json.uploaded[fieldName] => array of { originalName, url }
    const uploaded = (json.uploaded && json.uploaded[fieldName]) ? json.uploaded[fieldName].map((i: any) => i.url) : [];
    return uploaded;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profession || !companyName || !licenseNumber) {
      setToast({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }

    try {
      setSubmitting(true);
      setToast({ type: 'info', message: 'Uploading documents (if any) and submitting your application…' });

      // 1) Upload certificates and id docs separately (if present)
      let certificatesUrls: string[] = [];
      let idDocumentsUrls: string[] = [];

      if (certificates && certificates.length) {
        certificatesUrls = await uploadFiles(certificates, 'certificates');
      }
      if (idDocuments && idDocuments.length) {
        idDocumentsUrls = await uploadFiles(idDocuments, 'idDocuments');
      }

      // 2) Construct payload matching ProfessionalOnboardingData
      const payload: ProfessionalOnboardingData = {
        role: 'professional',
        profession,
        companyName,
        licenseNumber,
        yearsExperience: 0, // Defaulting as it's not in the form yet
        portfolio: '', // Defaulting
        website: '', // Defaulting
        bio: '',
        certificatesUrls,
        idDocumentsUrls,
      };

      await onSubmit(payload);
      
      // Success handling is done in parent, but we can update local state if needed
      setSuccess(true);
      setToast({ type: 'success', message: 'Application received. You will be contacted for verification.' });

      // Notify parent of success
      if (onAuthSuccess) onAuthSuccess(payload);

    } catch (err: any) {
      console.error('Professional submit error', err);
      setToast({ type: 'error', message: err?.message || 'Failed to submit. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <div className="mb-4 text-emerald-400"><ShieldCheck size={36} /></div>
        <h3 className="font-playfair text-2xl text-white mb-2 drop-shadow-lg">Thanks — application received</h3>
        <p className="text-slate-200 mb-6">Our team will review your documents and contact you within 3 business days for verification.</p>
        <div className="flex gap-4 justify-center">
          <a href="/professional-portal/dashboard" className="text-sm border-b border-emerald-400/50 pb-1 text-emerald-400 hover:text-emerald-300 transition-colors">Go to Dashboard</a>
          <button onClick={() => setSuccess(false)} className="text-sm text-slate-400 hover:text-white transition-colors">Edit application</button>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <div className="mb-4">{toast && <Toast type={toast.type} message={toast.message} />}</div>

      <h2 className="font-playfair text-3xl text-white mb-2 drop-shadow-lg">Join the Gold Standard.</h2>
      <p className="text-slate-200 mb-8 text-sm">Verification is mandatory. Please have your NCA or board registration ready.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-emerald-400 text-xs uppercase tracking-widest mb-2 font-semibold">Profession</label>
          <Select className="w-full" value={profession} onChange={(e: any) => setProfession(e.target.value)}>
            <option value="" className="bg-slate-800 text-white">Select Profession...</option>
            <option value="architect" className="bg-slate-800 text-white">Architect</option>
            <option value="contractor" className="bg-slate-800 text-white">General Contractor</option>
            <option value="interior" className="bg-slate-800 text-white">Interior Designer</option>
            <option value="engineer" className="bg-slate-800 text-white">Structural Engineer</option>
          </Select>
        </div>

        <div>
          <label className="block text-emerald-400 text-xs uppercase tracking-widest mb-2 font-semibold">Company Name</label>
          <Input placeholder="Your Firm's Legal Name" value={companyName} onChange={(e: any) => setCompanyName(e.target.value)} />
        </div>

        <div>
          <label className="flex text-emerald-400 text-xs uppercase tracking-widest mb-2 flex items-center justify-between font-semibold">
            <span>NCA / Board License #</span>
            <span className="text-[10px] text-emerald-300 flex items-center gap-1"><ShieldCheck size={10} /> Required for Verification</span>
          </label>
          <Input placeholder="e.g. NCA/1234/5678" value={licenseNumber} onChange={(e: any) => setLicenseNumber(e.target.value)} />
        </div>

        {/* Certificates upload */}
        <div>
          <label className="block text-emerald-400 text-xs uppercase tracking-widest mb-2 font-semibold">Certificates (NCA / Board) — optional</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={onCertificatesChange}
            className="block w-full text-sm text-white bg-white/5 p-2 rounded-none border border-white/30 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 file:cursor-pointer"
          />
          <div className="mt-2 space-y-2">
            {certificates && certificates.length > 0 ? (
              certificates.map((f, i) => <FileListItem key={f.name + i} file={f} onRemove={() => removeCertificate(i)} />)
            ) : (
              <div className="text-xs text-slate-400">No certificates uploaded — you can submit and mark them as pending.</div>
            )}
          </div>
        </div>

        {/* ID documents upload */}
        <div>
          <label className="block text-emerald-400 text-xs uppercase tracking-widest mb-2 font-semibold">ID / Registration Documents — optional</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={onIdDocumentsChange}
            className="block w-full text-sm text-white bg-white/5 p-2 rounded-none border border-white/30 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 file:cursor-pointer"
          />
          <div className="mt-2 space-y-2">
            {idDocuments && idDocuments.length > 0 ? (
              idDocuments.map((f, i) => <FileListItem key={f.name + i} file={f} onRemove={() => removeIdDocument(i)} />)
            ) : (
              <div className="text-xs text-slate-400">No ID documents uploaded — you can submit and mark them as pending.</div>
            )}
          </div>
        </div>

        <div className="pt-4">
          <Button variant="default" className="w-full" size="lg" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Apply for Verification'}
          </Button>
          <button type="button" onClick={onBack} className="w-full text-center text-slate-400 text-xs mt-4 hover:text-white transition-colors">
            Go Back
          </button>
        </div>
      </div>
    </form>
  );
};

export default ProfessionalForm;
