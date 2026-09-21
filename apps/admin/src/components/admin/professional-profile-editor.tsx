"use client";

import { useState } from "react";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateProfessionalProfile } from "@/actions/admin";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";

// Define schema validation
// Define schema validation
const profileSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  licenseNumber: z.string().optional(),
  yearsExperience: z.coerce.number().min(0).optional(),
  bio: z.string().optional(),
  website: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
});

type FormValues = z.infer<typeof profileSchema>;

interface ProfessionalProfileEditorProps {
  userId: string;
  initialData: {
    companyName: string;
    licenseNumber?: string | null | undefined;
    yearsExperience?: number | null | undefined;
    bio?: string | null | undefined;
    website?: string | null | undefined;
    city?: string | null | undefined;
    county?: string | null | undefined;
  };
  canEdit?: boolean;
}

export function ProfessionalProfileEditor({
  userId,
  initialData,
  canEdit = false,
}: ProfessionalProfileEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(profileSchema) as Resolver<FormValues>,
    defaultValues: {
      companyName: initialData.companyName,
      licenseNumber: initialData.licenseNumber || undefined,
      yearsExperience: initialData.yearsExperience || undefined,
      bio: initialData.bio || undefined,
      website: initialData.website || undefined,
      city: initialData.city || undefined,
      county: initialData.county || undefined,
    },
  });

  async function onSubmit(data: FormValues) {
    setIsSaving(true);
    try {
      const result = await updateProfessionalProfile(userId, data);
      if (result.success) {
        toast.success("Profile updated successfully");
        setIsEditing(false);
      } else {
        toast.error(result.error || "Failed to update profile");
      }
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    if (!canEdit) return null;

    return (
      <Button variant="outline" onClick={() => setIsEditing(true)}>
        Edit Profile
      </Button>
    );
  }

  return (
    <div className="border p-4 rounded-lg bg-card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Edit Profile</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
          Cancel
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="licenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Number</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Years Experience</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea {...field} />
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
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
