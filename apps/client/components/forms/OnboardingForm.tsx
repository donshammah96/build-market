"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function OnboardingForm() {
  const { user } = useUser();
  const router = useRouter();
  const [role, setRole] = useState<"client" | "professional">("client");
  const [formData, setFormData] = useState({}); // Role-specific data
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // API call to update user role and create profile
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId: user?.id, role, ...formData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to complete onboarding");
      }

      toast.success("Profile completed successfully!");

      // Redirect to role-specific dashboard
      if (role === "professional") {
        router.push("/professional-portal/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "An error occurred during onboarding",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "client" | "professional")}
        disabled={isSubmitting}
      >
        <option value="client">Client</option>
        <option value="professional">Professional</option>
      </select>
      {role === "client" && (
        // Client fields: address, etc.
        <input
          type="text"
          placeholder="Address"
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          disabled={isSubmitting}
        />
      )}
      {role === "professional" && (
        // Pro fields: company_name, etc.
        <input
          type="text"
          placeholder="Company Name"
          onChange={(e) =>
            setFormData({ ...formData, company_name: e.target.value })
          }
          disabled={isSubmitting}
        />
      )}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Completing Profile..." : "Complete Profile"}
      </button>
    </form>
  );
}
