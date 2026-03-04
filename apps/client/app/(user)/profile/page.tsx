"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  User as UserIcon,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Edit2,
  Save,
  Camera,
} from "lucide-react";

import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/text-area";
import {
  useProfileStatus,
  type ClientProfileData,
} from "@/hooks/useProfileStatus";
import { useClientDashboard } from "@/hooks/useClientDashboard";

interface UserProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  county: string;
  bio: string;
}

export default function ProfilePage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const {
    user,
    profile,
    isLoading: profileLoading,
    updateProfile,
    isUpdating,
  } = useProfileStatus();
  const { data: dashboardData } = useClientDashboard();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserProfileData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    county: "",
    bio: "",
  });

  useEffect(() => {
    if (user || clerkUser) {
      const clientProfile = profile as ClientProfileData | null;
      setFormData({
        firstName: user?.firstName ?? clerkUser?.firstName ?? "",
        lastName: user?.lastName ?? clerkUser?.lastName ?? "",
        email:
          clerkUser?.emailAddresses?.[0]?.emailAddress ?? user?.email ?? "",
        phone: user?.phone ?? "",
        address: clientProfile?.address ?? "",
        city: clientProfile?.city ?? "",
        county: clientProfile?.county ?? "",
        bio: user?.bio ?? "",
      });
    }
  }, [user, profile, clerkUser]);

  const handleSave = async () => {
    try {
      await updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        county: formData.county || undefined,
        bio: formData.bio || undefined,
      });
      setIsEditing(false);
    } catch {
      // Error surfaced via updateError from hook if needed
    }
  };

  const stats = dashboardData?.stats;
  const activeProjects = stats?.activeProjects ?? 0;
  const ideaBooksCount = stats?.ideaBooks ?? 0;

  if (!clerkLoaded || profileLoading) return <ProfileSkeleton />;

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col">
      <ClientNavbar />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-8 pt-24 max-w-5xl">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Account Settings
          </h1>
          <p className="text-zinc-500 mt-1">
            Manage your personal information and preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* --- LEFT SIDE: Identity Card --- */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-zinc-200 shadow-sm overflow-hidden bg-white">
              <div className="h-32 bg-gradient-to-r from-emerald-600 to-teal-600 relative">
                {/* Banner Edit (Optional) */}
              </div>
              <div className="px-6 pb-6 relative">
                <div className="relative -mt-12 mb-4 inline-block">
                  <Avatar className="h-24 w-24 border-4 border-white shadow-md">
                    <AvatarImage
                      src={clerkUser?.imageUrl ?? user?.avatar ?? undefined}
                    />
                    <AvatarFallback className="bg-zinc-100 text-zinc-500 text-2xl font-bold">
                      {formData.firstName?.charAt(0) ??
                        clerkUser?.firstName?.charAt(0) ??
                        "?"}
                    </AvatarFallback>
                  </Avatar>
                  <button className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full border border-zinc-200 shadow-sm text-zinc-500 hover:text-emerald-600 transition-colors">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                    {(clerkUser?.fullName ??
                      `${formData.firstName} ${formData.lastName}`.trim()) ||
                      "Account"}
                    <Badge
                      variant="secondary"
                      className="bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0 h-5"
                    >
                      Client
                    </Badge>
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1">
                    {formData.city}, {formData.county}
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-zinc-600">
                    <Mail className="h-4 w-4 text-zinc-400" />
                    <span className="truncate">{formData.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-600">
                    <Phone className="h-4 w-4 text-zinc-400" />
                    <span>{formData.phone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-600">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">
                      Verified Account
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-zinc-200 shadow-sm bg-white p-4">
              <h3 className="font-semibold text-zinc-900 mb-4 text-sm uppercase tracking-wider">
                Account Stats
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-50 rounded-lg text-center border border-zinc-100">
                  <span className="block text-2xl font-bold text-zinc-900">
                    {activeProjects}
                  </span>
                  <span className="text-xs text-zinc-500 font-medium">
                    Active Projects
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 rounded-lg text-center border border-zinc-100">
                  <span className="block text-2xl font-bold text-zinc-900">
                    {ideaBooksCount}
                  </span>
                  <span className="text-xs text-zinc-500 font-medium">
                    Idea Books
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* --- RIGHT SIDE: Edit Form --- */}
          <div className="lg:col-span-8">
            <Card className="border-zinc-200 shadow-sm bg-white">
              <CardHeader className="border-b border-zinc-100 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-zinc-900">
                      Profile Details
                    </CardTitle>
                    <CardDescription>
                      Update your personal information and address.
                    </CardDescription>
                  </div>
                  {!isEditing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="mr-2 h-4 w-4" /> Edit Profile
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(false)}
                        disabled={isUpdating}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleSave}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          "Saving..."
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" /> Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Personal Info Group */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-zinc-900 flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-zinc-400" /> Personal
                    Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        disabled={!isEditing}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            firstName: e.target.value,
                          })
                        }
                        className="bg-zinc-50 border-zinc-200 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        disabled={!isEditing}
                        onChange={(e) =>
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        className="bg-zinc-50 border-zinc-200 focus:bg-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={formData.bio}
                      disabled={!isEditing}
                      onChange={(e) =>
                        setFormData({ ...formData, bio: e.target.value })
                      }
                      className="bg-zinc-50 border-zinc-200 focus:bg-white resize-none min-h-[80px]"
                    />
                  </div>
                </div>

                <Separator />

                {/* Contact Info Group */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-zinc-900 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-zinc-400" /> Location &
                    Contact
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        value={formData.email}
                        disabled={true} // Usually verified emails shouldn't be easily editable
                        className="bg-zinc-100 border-zinc-200 text-zinc-500 cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        disabled={!isEditing}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className="bg-zinc-50 border-zinc-200 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        disabled={!isEditing}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        className="bg-zinc-50 border-zinc-200 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        disabled={!isEditing}
                        onChange={(e) =>
                          setFormData({ ...formData, city: e.target.value })
                        }
                        className="bg-zinc-50 border-zinc-200 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="county">County</Label>
                      <Input
                        id="county"
                        value={formData.county}
                        disabled={!isEditing}
                        onChange={(e) =>
                          setFormData({ ...formData, county: e.target.value })
                        }
                        className="bg-zinc-50 border-zinc-200 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
      <div className="h-8 w-64 bg-zinc-200 rounded mb-8 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="h-96 bg-zinc-200 rounded-xl animate-pulse" />
        </div>
        <div className="lg:col-span-8">
          <div className="h-[600px] bg-zinc-200 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
