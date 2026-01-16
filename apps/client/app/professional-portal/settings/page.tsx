"use client";

import { useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MapPin, Store, Home } from "lucide-react";
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

// --- Schema Definition ---
const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().min(1, "Company name is required"),
  bio: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  portfolioUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  yearsExperience: z.number().int().min(0).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();

  // --- Fetch Data ---
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["professional-profile"],
    queryFn: async () => {
      const res = await fetch("/api/professional-portal/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });

  // --- Fetch Service Categories ---
  const { data: servicesData, isLoading: isLoadingServices } = useQuery<{
    data: ServiceCategory[];
  }>({
    queryKey: ["service-categories"],
    queryFn: async () => {
      const res = await fetch("/api/services?limit=100");
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
  });

  const isLoading = isLoadingProfile || isLoadingServices;
  const serviceCategories = servicesData?.data || [];

  // --- Form Setup ---
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
      bio: "",
      city: "",
      county: "",
      website: "",
      portfolioUrl: "",
      yearsExperience: undefined,
      serviceIds: [],
    },
  });

  // --- Update Form Defaults on Data Load ---
  useEffect(() => {
    if (profile) {
      form.reset({
        firstName: profile.user?.firstName || "",
        lastName: profile.user?.lastName || "",
        companyName: profile.companyName || "",
        bio: profile.bio || "",
        city: profile.city || "",
        county: profile.county || "",
        website: profile.website || "",
        portfolioUrl: profile.portfolioUrl || "",
        yearsExperience: profile.yearsExperience || undefined,
        serviceIds: profile.services?.map((s: ServiceCategory) => s.id) || [],
      });
    }
  }, [profile, form]);

  // --- Mutation ---
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await fetch("/api/professional-portal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update profile");
      }
      return res.json();
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
      <div className="flex items-center justify-center min-h-[400px]">
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
                            <Input placeholder="https://..." {...field} />
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
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(
                                  value === "" ? undefined : parseInt(value, 10)
                                );
                              }}
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
                          <Input placeholder="https://..." {...field} />
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
                    Select the service categories you want to be listed under.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingServices ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                    </div>
                  ) : serviceCategories.length === 0 ? (
                    <p className="text-sm text-zinc-500 py-4">
                      No service categories available.
                    </p>
                  ) : (
                    <FormField
                      control={form.control}
                      name="serviceIds"
                      render={() => (
                        <FormItem>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {serviceCategories.map((service) => (
                              <FormField
                                key={service.id}
                                control={form.control}
                                name="serviceIds"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={service.id}
                                      className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(
                                            service.id
                                          )}
                                          onCheckedChange={(checked) => {
                                            const currentValue =
                                              field.value || [];
                                            return checked
                                              ? field.onChange([
                                                  ...currentValue,
                                                  service.id,
                                                ])
                                              : field.onChange(
                                                  currentValue.filter(
                                                    (id) => id !== service.id
                                                  )
                                                );
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal cursor-pointer">
                                        {service.name}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
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
