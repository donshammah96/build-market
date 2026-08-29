"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Save,
} from "lucide-react";

import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileStatus, ClientProfileData } from "@/hooks/useProfileStatus";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  avatar: string;
  address: string;
  city: string;
  county: string;
  zipCode: string;
}

export default function CompleteClientProfilePage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const {
    user,
    profile,
    // completion,
    isLoading,
    updateProfile,
    isUpdating,
    refetch,
  } = useProfileStatus();

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    phone: "",
    avatar: "",
    address: "",
    city: "",
    county: "",
    zipCode: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Populate form with existing data
  useEffect(() => {
    if (user && profile) {
      const clientProfile = profile as ClientProfileData;
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
        avatar: user.avatar || "",
        address: clientProfile?.address || "",
        city: clientProfile?.city || "",
        county: clientProfile?.county || "",
        zipCode: clientProfile?.zipCode || "",
      });
    }
  }, [user, profile]);

  // Calculate local completion percentage for real-time updates
  const calculateLocalCompletion = () => {
    const requiredFields = ["firstName", "lastName", "phone", "city"];
    const optionalFields = ["avatar", "address", "county", "zipCode"];

    const filledRequired = requiredFields.filter(
      (f) => formData[f as keyof FormData]?.trim().length > 0,
    ).length;
    const filledOptional = optionalFields.filter(
      (f) => formData[f as keyof FormData]?.trim().length > 0,
    ).length;

    const requiredPercentage = Math.round(
      (filledRequired / requiredFields.length) * 80,
    );
    const optionalPercentage = Math.round(
      (filledOptional / optionalFields.length) * 20,
    );

    return requiredPercentage + optionalPercentage;
  };

  const localPercentage = calculateLocalCompletion();

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setSaveSuccess(false);
  };

  const validateForm = () => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }

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
        address: formData.address || null,
        city: formData.city || null,
        county: formData.county || null,
        zipCode: formData.zipCode || null,
      });

      setSaveSuccess(true);

      // If profile is now complete, redirect to dashboard after a short delay
      setTimeout(async () => {
        const result = await refetch();
        if (result.data?.completion?.isComplete) {
          router.push(ROUTES.userDashboard);
        }
      }, 1500);
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  if (!clerkLoaded || isLoading) {
    return <ProfileFormSkeleton />;
  }

  const getProgressColor = () => {
    if (localPercentage >= 80) return "bg-emerald-500";
    if (localPercentage >= 50) return "bg-amber-500";
    return "bg-orange-500";
  };

  return (
    <div className="min-h-screen bg-zinc-50/50">
      <ClientNavbar />

      <main className="container mx-auto px-4 md:px-8 py-8 pt-24 max-w-3xl">
        {/* Back button */}
        <Button
          variant="ghost"
          className="mb-6 -ml-2 text-zinc-600 hover:text-zinc-900"
          onClick={() => router.push(ROUTES.userDashboard)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Complete Your Profile
          </h1>
          <p className="text-zinc-500 mt-2">
            Fill in the required information to unlock all features and get
            personalized recommendations.
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
                  <p className="font-semibold text-zinc-900">
                    Profile Completion
                  </p>
                  <p className="text-sm text-zinc-500">
                    {localPercentage >= 80
                      ? "Almost there!"
                      : "Complete required fields to continue"}
                  </p>
                </div>
              </div>
              <span className="text-2xl font-bold text-zinc-900">
                {localPercentage}%
              </span>
            </div>
            <Progress
              value={localPercentage}
              className="h-3 bg-zinc-100"
              indicatorClassName={getProgressColor()}
            />
          </CardContent>
        </Card>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card className="border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <CardDescription>
                Fields marked with <span className="text-red-500">*</span> are
                required
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20 border-2 border-zinc-100">
                  <AvatarImage src={formData.avatar || clerkUser?.imageUrl} />
                  <AvatarFallback className="bg-zinc-100 text-zinc-500 text-xl">
                    {formData.firstName?.[0]}
                    {formData.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Label
                    htmlFor="avatar"
                    className="text-sm font-medium text-zinc-700"
                  >
                    Profile Photo URL
                  </Label>
                  <Input
                    id="avatar"
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    value={formData.avatar}
                    onChange={(e) => handleChange("avatar", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* First Name */}
                <div>
                  <Label
                    htmlFor="firstName"
                    className="text-sm font-medium text-zinc-700"
                  >
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    className={cn(
                      "mt-1.5",
                      errors.firstName && "border-red-500",
                    )}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.firstName}
                    </p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <Label
                    htmlFor="lastName"
                    className="text-sm font-medium text-zinc-700"
                  >
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    className={cn(
                      "mt-1.5",
                      errors.lastName && "border-red-500",
                    )}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.lastName}
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <Label
                    htmlFor="phone"
                    className="text-sm font-medium text-zinc-700"
                  >
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+254 700 000 000"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      className={cn("pl-10", errors.phone && "border-red-500")}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-sm text-red-500 mt-1">{errors.phone}</p>
                  )}
                </div>

                {/* City */}
                <div>
                  <Label
                    htmlFor="city"
                    className="text-sm font-medium text-zinc-700"
                  >
                    City <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      id="city"
                      placeholder="Nairobi"
                      value={formData.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      className={cn("pl-10", errors.city && "border-red-500")}
                    />
                  </div>
                  {errors.city && (
                    <p className="text-sm text-red-500 mt-1">{errors.city}</p>
                  )}
                </div>
              </div>

              {/* Optional Fields Divider */}
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-sm text-zinc-500">
                    Optional Information
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Address */}
                <div className="md:col-span-2">
                  <Label
                    htmlFor="address"
                    className="text-sm font-medium text-zinc-700"
                  >
                    Street Address
                  </Label>
                  <Input
                    id="address"
                    placeholder="123 Main Street"
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                {/* County */}
                <div>
                  <Label
                    htmlFor="county"
                    className="text-sm font-medium text-zinc-700"
                  >
                    County
                  </Label>
                  <Input
                    id="county"
                    placeholder="Nairobi County"
                    value={formData.county}
                    onChange={(e) => handleChange("county", e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                {/* ZIP Code */}
                <div>
                  <Label
                    htmlFor="zipCode"
                    className="text-sm font-medium text-zinc-700"
                  >
                    ZIP / Postal Code
                  </Label>
                  <Input
                    id="zipCode"
                    placeholder="00100"
                    value={formData.zipCode}
                    onChange={(e) => handleChange("zipCode", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex items-center justify-between mt-8">
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

      <Footer />
    </div>
  );
}

function ProfileFormSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50/50">
      <ClientNavbar />
      <div className="container mx-auto px-4 py-8 pt-24 max-w-3xl">
        <Skeleton className="h-10 w-48 mb-8" />
        <Skeleton className="h-32 w-full rounded-xl mb-8" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
