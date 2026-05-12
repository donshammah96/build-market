"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MapPin, Store, Home, FileCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/text-area";
import Link from "next/link";
import { profileClient } from "@/lib/facades/profile-client";
import { UpdateProfileSchema } from "@/app/lib/validation/profile-validation";
import { ServiceSelector } from "@/components/forms/ServiceSelector";

type ProfileFormValues = z.infer<typeof UpdateProfileSchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();

  // --- Fetch Data ---
  const { data: profileResult, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["professional-profile"],
    queryFn: async () => {
      const res = await profileClient.getProfile();
      if (!res.success) throw new Error(res.error || "Failed to fetch profile");
      return res.data;
    },
  });

  // --- Fetch Service Categories ---
  const { data: serviceGroupsResult, isLoading: isLoadingServices } = useQuery({
    queryKey: ["service-groups"],
    queryFn: async () => {
      const res = await profileClient.getServiceGroups();
      if (!res.success)
        throw new Error(res.error || "Failed to fetch services");
      return res.data || [];
    },
  });

  const isLoading = isLoadingProfile || isLoadingServices;
  const profile = profileResult;
  const serviceGroups = serviceGroupsResult || [];

  // --- Form Setup ---
  // Using `values` prop to auto-sync form with profile data (avoids useEffect pitfalls)
  const formValues = profile
    ? {
        firstName: profile.user.firstName || "",
        lastName: profile.user.lastName || "",
        companyName: profile.companyName || "",
        bio: profile.bio || "",
        city: profile.city || "",
        county: (profile.county as ProfileFormValues["county"]) || undefined,
        website: profile.website || "",
        portfolioUrl: profile.portfolioUrl || "",
        yearsExperience: profile.yearsExperience || undefined,
        serviceIds: profile.services.map((s) => s.id),
      }
    : undefined;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
      bio: "",
      city: "",
      county: undefined,
      website: "",
      portfolioUrl: "",
      yearsExperience: undefined,
      serviceIds: [],
    },
    values: formValues,
  });

  // --- Mutation ---
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await profileClient.updateProfile(data);
      if (!res.success) {
        throw new Error(res.error || "Failed to update profile");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professional-profile"] });
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function onSubmit(data: ProfileFormValues) {
    updateProfileMutation.mutate(data);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div className="border-b border-zinc-100 pb-6">
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
          Settings
        </h1>
        <p className="text-zinc-500 mt-1">
          Manage your public profile and account preferences.
        </p>
      </div>

      {/* Quick Links to Other Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-1">
                  Property Listings
                </h3>
                <p className="text-sm text-zinc-600 mb-4">
                  Manage your property listings and verification documents
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/professional-portal/settings/properties">
                    <Home className="mr-2 h-4 w-4" />
                    Manage Properties
                  </Link>
                </Button>
              </div>
              <Home className="h-8 w-8 text-zinc-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-1">
                  Store Management
                </h3>
                <p className="text-sm text-zinc-600 mb-4">
                  Manage your stores, products, and store verification
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/professional-portal/settings/stores">
                    <Store className="mr-2 h-4 w-4" />
                    Manage Stores
                  </Link>
                </Button>
              </div>
              <Store className="h-8 w-8 text-zinc-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-1">
                  Credentials & Verification
                </h3>
                <p className="text-sm text-zinc-600 mb-4">
                  Manage your documents, certificates, and professional licenses
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/professional-portal/settings/credentials">
                    <FileCheck className="mr-2 h-4 w-4" />
                    Manage Credentials
                  </Link>
                </Button>
              </div>
              <FileCheck className="h-8 w-8 text-zinc-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="bg-zinc-100 p-1 mb-8">
              <TabsTrigger value="profile">Public Profile</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
            </TabsList>

            {/* --- Profile Tab --- */}
            <TabsContent value="profile" className="space-y-6">
              <Card className="border border-zinc-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>
                    This is how clients will see you on Build Market.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Branding (Static for now) */}
                  <div className="flex items-center gap-6">
                    <Avatar className="h-24 w-24 border-2 border-zinc-100">
                      <AvatarImage
                        src={
                          profile?.user?.avatar ||
                          "https://i.pravatar.cc/150?u=1"
                        }
                      />
                      <AvatarFallback>
                        {profile?.user?.firstName?.[0]}
                        {profile?.user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled
                      >
                        Change Logo (Coming Soon)
                      </Button>
                      <p className="text-xs text-zinc-400">
                        JPG, GIF or PNG. Max size 2MB.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2">
                      <Label>License Number (NCA)</Label>
                      <Input
                        value={profile?.licenseNumber || "N/A"}
                        disabled
                        className="bg-zinc-50"
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bio / About Us</FormLabel>
                        <FormControl>
                          <Textarea className="min-h-[120px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                            <FormControl>
                              <Input
                                className="pl-9"
                                placeholder="e.g., Nairobi"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="county"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>County</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Nairobi County"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://..."
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="yearsExperience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Years of Experience</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="e.g., 5"
                              {...field}
                              value={
                                field.value !== undefined ? field.value : ""
                              }
                              onChange={(e) =>
                                field.onChange(
                                  e.target.valueAsNumber || undefined,
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="portfolioUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>External Portfolio URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://..."
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- Services Tab --- */}
            <TabsContent value="services">
              <Card className="border border-zinc-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Services Offered</CardTitle>
                  <CardDescription>
                    Select the specific services you offer.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="serviceIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <ServiceSelector
                            serviceGroups={serviceGroups}
                            initialSelectedIds={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-4 sticky bottom-6">
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
