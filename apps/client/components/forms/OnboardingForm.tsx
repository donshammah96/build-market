'use client';
import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function OnboardingForm() {
  const { user } = useUser();
  const router = useRouter();
  const [role, setRole] = useState<'client' | 'professional'>('client');
  const [formData, setFormData] = useState({});  // Role-specific data

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // API call to update user role and create profile
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clerkId: user?.id, role, ...formData }),
    });
    
    // Redirect to role-specific dashboard
    if (role === 'professional') {
      router.push('/professional-portal/dashboard');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <select value={role} onChange={(e) => setRole(e.target.value as any)}>
        <option value="client">Client</option>
        <option value="professional">Professional</option>
      </select>
      {role === 'client' && (
        // Client fields: address, etc.
        <input type="text" placeholder="Address" onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
      )}
      {role === 'professional' && (
        // Pro fields: company_name, etc.
        <input type="text" placeholder="Company Name" onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
      )}
      <button type="submit">Complete Profile</button>
    </form>
  );
}