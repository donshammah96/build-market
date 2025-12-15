'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Phone, 
  MapPin, 
  Globe,
  Briefcase,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Save,
  Plus,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfileStatus, ProfessionalProfileData } from '@/hooks/useProfileStatus';
import { cn } from '@/lib/utils';

// Professional services options
const SERVICE_OPTIONS = [
  'General Contractor',
  'Architect',
  'Interior Designer',
  'Plumber',
  'Electrician',
  'Carpenter',
  'Mason',
  'Painter',
  'Roofer',
  'Landscaper',
  'HVAC Specialist',
  'Structural Engineer',
  'Civil Engineer',
  'Project Manager',
];

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  avatar: string;
  companyName: string;
  licenseNumber: string;
  yearsExperience: string;
  servicesOffered: string[];
  bio: string;
  city: string;
  county: string;
  website: string;
  portfolioUrl: string;
}

export default function CompleteProfessionalProfilePage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { 
    user, 
    profile, 
    completion, 
    isLoading, 
    updateProfile,
    isUpdating,
    refetch,
  } = useProfileStatus();

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    phone: '',
    avatar: '',
    companyName: '',
    licenseNumber: '',
    yearsExperience: '',
    servicesOffered: [],
    bio: '',
    city: '',
    county: '',
    website: '',
    portfolioUrl: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [customService, setCustomService] = useState('');

  // Populate form with existing data
  useEffect(() => {
    if (user && profile) {
      const proProfile = profile as ProfessionalProfileData;
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        avatar: user.avatar || '',
        companyName: proProfile?.companyName || '',
        licenseNumber: proProfile?.licenseNumber || '',
        yearsExperience: proProfile?.yearsExperience?.toString() || '',
        servicesOffered: proProfile?.servicesOffered || [],
        bio: proProfile?.bio || '',
        city: proProfile?.city || '',
        county: proProfile?.county || '',
        website: proProfile?.website || '',
        portfolioUrl: proProfile?.portfolioUrl || '',
      });
    }
  }, [user, profile]);

  // Calculate local completion percentage
  const calculateLocalCompletion = () => {
    const requiredFields = ['firstName', 'lastName', 'phone', 'companyName', 'city', 'bio'];
    const requiredArrays = ['servicesOffered'];
    const optionalFields = ['avatar', 'licenseNumber', 'yearsExperience', 'county', 'website', 'portfolioUrl'];
    
    let filledRequired = requiredFields.filter(f => 
      formData[f as keyof FormData]?.toString().trim().length > 0
    ).length;
    
    // Check servicesOffered array
    if (formData.servicesOffered.length > 0) {
      filledRequired += 1;
    }
    
    const filledOptional = optionalFields.filter(f => 
      formData[f as keyof FormData]?.toString().trim().length > 0
    ).length;
    
    const totalRequired = requiredFields.length + requiredArrays.length;
    const totalOptional = optionalFields.length;
    
    const requiredPercentage = Math.round((filledRequired / totalRequired) * 80);
    const optionalPercentage = Math.round((filledOptional / totalOptional) * 20);
    
    return requiredPercentage + optionalPercentage;
  };

  const localPercentage = calculateLocalCompletion();

  const handleChange = (field: keyof FormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    setSaveSuccess(false);
  };

  const handleServiceToggle = (service: string) => {
    const current = formData.servicesOffered;
    if (current.includes(service)) {
      handleChange('servicesOffered', current.filter(s => s !== service));
    } else {
      handleChange('servicesOffered', [...current, service]);
    }
  };

  const handleAddCustomService = () => {
    if (customService.trim() && !formData.servicesOffered.includes(customService.trim())) {
      handleChange('servicesOffered', [...formData.servicesOffered, customService.trim()]);
      setCustomService('');
    }
  };

  const validateForm = () => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.bio.trim()) newErrors.bio = 'Professional bio is required';
    if (formData.servicesOffered.length === 0) newErrors.servicesOffered = 'Select at least one service';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      await updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        avatar: formData.avatar || null,
        companyName: formData.companyName || null,
        licenseNumber: formData.licenseNumber || null,
        yearsExperience: formData.yearsExperience ? parseInt(formData.yearsExperience) : null,
        servicesOffered: formData.servicesOffered,
        bio: formData.bio || null,
        city: formData.city || null,
        county: formData.county || null,
        website: formData.website || null,
        portfolioUrl: formData.portfolioUrl || null,
      });
      
      setSaveSuccess(true);
      
      // If profile is now complete, redirect to dashboard
      setTimeout(async () => {
        const result = await refetch();
        if (result.data?.completion?.isComplete) {
          router.push('/professional-portal/dashboard');
        }
      }, 1500);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  if (!clerkLoaded || isLoading) {
    return <ProfileFormSkeleton />;
  }

  const getProgressColor = () => {
    if (localPercentage >= 80) return 'bg-emerald-500';
    if (localPercentage >= 50) return 'bg-amber-500';
    return 'bg-orange-500';
  };

  return (
    <div className="min-h-screen bg-zinc-50/50">
      <main className="container mx-auto px-4 md:px-8 py-8 max-w-4xl">
        
        {/* Back button */}
        <Button
          variant="ghost"
          className="mb-6 -ml-2 text-zinc-600 hover:text-zinc-900"
          onClick={() => router.push('/professional-portal/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Complete Your Professional Profile
          </h1>
          <p className="text-zinc-500 mt-2">
            A complete profile helps clients find and trust you. Fill in the required details to start receiving leads.
          </p>
        </div>

        {/* Progress Card */}
        <Card className="mb-8 border-zinc-200 shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {localPercentage >= 80 ? (
                  <div className="p-2 rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                ) : (
                  <div className="p-2 rounded-full bg-amber-100">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-zinc-900">Profile Completion</p>
                  <p className="text-sm text-zinc-500">
                    {localPercentage >= 80 ? 'Almost there! Your profile looks great.' : 'Complete required fields to boost visibility'}
                  </p>
                </div>
              </div>
              <span className="text-2xl font-bold text-zinc-900">{localPercentage}%</span>
            </div>
            <Progress 
              value={localPercentage} 
              className="h-3 bg-zinc-100" 
              indicatorClassName={getProgressColor()} 
            />
          </CardContent>
        </Card>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Personal Information */}
          <Card className="border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-zinc-400" />
                Personal & Company Information
              </CardTitle>
              <CardDescription>
                Fields marked with <span className="text-red-500">*</span> are required
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20 border-2 border-zinc-100">
                  <AvatarImage src={formData.avatar || clerkUser?.imageUrl} />
                  <AvatarFallback className="bg-zinc-100 text-zinc-500 text-xl">
                    {formData.firstName?.[0]}{formData.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Label htmlFor="avatar" className="text-sm font-medium text-zinc-700">
                    Profile Photo URL
                  </Label>
                  <Input
                    id="avatar"
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    value={formData.avatar}
                    onChange={(e) => handleChange('avatar', e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* First Name */}
                <div>
                  <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className={cn('mt-1.5', errors.firstName && 'border-red-500')}
                  />
                  {errors.firstName && <p className="text-sm text-red-500 mt-1">{errors.firstName}</p>}
                </div>

                {/* Last Name */}
                <div>
                  <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className={cn('mt-1.5', errors.lastName && 'border-red-500')}
                  />
                  {errors.lastName && <p className="text-sm text-red-500 mt-1">{errors.lastName}</p>}
                </div>

                {/* Phone */}
                <div>
                  <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+254 700 000 000"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className={cn('pl-10', errors.phone && 'border-red-500')}
                    />
                  </div>
                  {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
                </div>

                {/* Company Name */}
                <div>
                  <Label htmlFor="companyName">Company Name <span className="text-red-500">*</span></Label>
                  <div className="relative mt-1.5">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      id="companyName"
                      placeholder="ABC Construction Ltd"
                      value={formData.companyName}
                      onChange={(e) => handleChange('companyName', e.target.value)}
                      className={cn('pl-10', errors.companyName && 'border-red-500')}
                    />
                  </div>
                  {errors.companyName && <p className="text-sm text-red-500 mt-1">{errors.companyName}</p>}
                </div>

                {/* City */}
                <div>
                  <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      id="city"
                      placeholder="Nairobi"
                      value={formData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      className={cn('pl-10', errors.city && 'border-red-500')}
                    />
                  </div>
                  {errors.city && <p className="text-sm text-red-500 mt-1">{errors.city}</p>}
                </div>

                {/* County */}
                <div>
                  <Label htmlFor="county">County</Label>
                  <Input
                    id="county"
                    placeholder="Nairobi County"
                    value={formData.county}
                    onChange={(e) => handleChange('county', e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <Label htmlFor="bio">Professional Bio <span className="text-red-500">*</span></Label>
                <Textarea
                  id="bio"
                  placeholder="Tell clients about your experience, specialties, and what makes your work stand out..."
                  value={formData.bio}
                  onChange={(e) => handleChange('bio', e.target.value)}
                  className={cn('mt-1.5 min-h-[120px]', errors.bio && 'border-red-500')}
                />
                {errors.bio && <p className="text-sm text-red-500 mt-1">{errors.bio}</p>}
                <p className="text-xs text-zinc-400 mt-1">{formData.bio.length}/500 characters recommended</p>
              </div>
            </CardContent>
          </Card>

          {/* Services Offered */}
          <Card className="border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-zinc-400" />
                Services Offered <span className="text-red-500">*</span>
              </CardTitle>
              <CardDescription>
                Select the services you provide (at least one required)
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {SERVICE_OPTIONS.map((service) => (
                  <Badge
                    key={service}
                    variant={formData.servicesOffered.includes(service) ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer transition-all',
                      formData.servicesOffered.includes(service)
                        ? 'bg-zinc-900 hover:bg-zinc-800 text-white'
                        : 'hover:bg-zinc-50'
                    )}
                    onClick={() => handleServiceToggle(service)}
                  >
                    {formData.servicesOffered.includes(service) && (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    )}
                    {service}
                  </Badge>
                ))}
              </div>
              
              {/* Custom service input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom service..."
                  value={customService}
                  onChange={(e) => setCustomService(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomService())}
                />
                <Button type="button" variant="outline" onClick={handleAddCustomService}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Selected services */}
              {formData.servicesOffered.filter(s => !SERVICE_OPTIONS.includes(s)).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {formData.servicesOffered.filter(s => !SERVICE_OPTIONS.includes(s)).map((service) => (
                    <Badge key={service} variant="secondary" className="gap-1">
                      {service}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => handleServiceToggle(service)} 
                      />
                    </Badge>
                  ))}
                </div>
              )}
              
              {errors.servicesOffered && (
                <p className="text-sm text-red-500 mt-2">{errors.servicesOffered}</p>
              )}
            </CardContent>
          </Card>

          {/* Professional Details */}
          <Card className="border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-zinc-400" />
                Professional Details
              </CardTitle>
              <CardDescription>Optional but recommended for credibility</CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* License Number */}
                <div>
                  <Label htmlFor="licenseNumber">License/Registration Number</Label>
                  <Input
                    id="licenseNumber"
                    placeholder="NCA/2024/12345"
                    value={formData.licenseNumber}
                    onChange={(e) => handleChange('licenseNumber', e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                {/* Years Experience */}
                <div>
                  <Label htmlFor="yearsExperience">Years of Experience</Label>
                  <Input
                    id="yearsExperience"
                    type="number"
                    min="0"
                    placeholder="10"
                    value={formData.yearsExperience}
                    onChange={(e) => handleChange('yearsExperience', e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                {/* Website */}
                <div>
                  <Label htmlFor="website">Website</Label>
                  <div className="relative mt-1.5">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://yourcompany.com"
                      value={formData.website}
                      onChange={(e) => handleChange('website', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Portfolio URL */}
                <div>
                  <Label htmlFor="portfolioUrl">Portfolio URL</Label>
                  <div className="relative mt-1.5">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      id="portfolioUrl"
                      type="url"
                      placeholder="https://portfolio.example.com"
                      value={formData.portfolioUrl}
                      onChange={(e) => handleChange('portfolioUrl', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex items-center justify-between">
            <div>
              {saveSuccess && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-emerald-600 flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Profile saved successfully!
                </motion.p>
              )}
            </div>
            <Button
              type="submit"
              size="lg"
              className="bg-zinc-900 hover:bg-zinc-800 text-white shadow-md"
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function ProfileFormSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50/50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-10 w-48 mb-8" />
        <Skeleton className="h-32 w-full rounded-xl mb-8" />
        <Skeleton className="h-96 w-full rounded-xl mb-8" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}
