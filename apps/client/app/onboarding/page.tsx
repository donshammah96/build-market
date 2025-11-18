"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ROUTES } from "@/app/lib/links";

type Role = "client" | "professional" | null;

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  // Client fields
  address?: string;
  city?: string;
  county?: string;
  zipCode?: string;
  // Professional fields
  companyName?: string;
  licenseNumber?: string;
  yearsExperience?: number;
  servicesOffered?: string[];
  bio?: string;
  country?: string;
}

const SERVICES_OPTIONS = [
  "General Contracting",
  "Architecture",
  "Interior Design",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Carpentry",
  "Painting",
  "Landscaping",
  "Roofing",
  "Flooring",
  "Masonry",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const [step, setStep] = useState<"role" | "details">("role");
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  
  const [formData, setFormData] = useState<FormData>({
    firstName: clerkUser?.firstName || "",
    lastName: clerkUser?.lastName || "",
    phone: clerkUser?.primaryPhoneNumber?.phoneNumber || "",
    servicesOffered: [],
  });

  // Check if profile is already complete
  useEffect(() => {
    const checkProfileStatus = async () => {
      try {
        const response = await fetch("/api/profile/complete");
        if (response.ok) {
          const data = await response.json();
          if (data.isProfileComplete) {
            router.push(ROUTES.userDashboard);
          }
        }
      } catch (err) {
        console.error("Failed to check profile status:", err);
      }
    };

    if (clerkUser) {
      checkProfileStatus();
    }
  }, [clerkUser, router]);

  const handleServiceToggle = (service: string) => {
    setFormData((prev) => {
      const services = prev.servicesOffered || [];
      if (services.includes(service)) {
        return {
          ...prev,
          servicesOffered: services.filter((s) => s !== service),
        };
      } else {
        return {
          ...prev,
          servicesOffered: [...services, service],
        };
      }
    });
  };

  const handleRoleSelect = (selectedRole: Role) => {
    setRole(selectedRole);
    setStep("details");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Retry logic for handling webhook race conditions
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await fetch("/api/profile/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            ...formData,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          // Success! Redirect to dashboard
          router.push(ROUTES.userDashboard);
          return;
        }

        // If 404 and we have retries left, wait and retry
        if (response.status === 404 && attempt < maxRetries - 1) {
          console.log(`User not found, retrying (attempt ${attempt + 1}/${maxRetries})...`);
          setError(`Setting up your account... (${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          attempt++;
          continue;
        }

        // Other errors or final retry failed
        throw new Error(data.error || data.details || "Failed to complete profile");
      } catch (err: any) {
        if (attempt === maxRetries - 1) {
          // Final attempt failed
          setError(err.message || "Something went wrong. Please try again.");
          setLoading(false);
          return;
        }
        
        // Network error, retry
        console.error(`Error on attempt ${attempt + 1}:`, err);
        attempt++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setLoading(false);
  };

  const renderRoleSelection = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto"
    >
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Welcome to Build Market!</h1>
        <p className="text-gray-600 text-lg">
          Let's get you started. What brings you here?
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleRoleSelect("client")}
          className="bg-white border-2 border-gray-200 rounded-xl p-8 hover:border-emerald-500 hover:shadow-lg transition-all text-left"
        >
          <div className="text-5xl mb-4">🏠</div>
          <h2 className="text-2xl font-bold mb-2">I'm a Homeowner</h2>
          <p className="text-gray-600">
            Looking for professionals, products, and inspiration for my project
          </p>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleRoleSelect("professional")}
          className="bg-white border-2 border-gray-200 rounded-xl p-8 hover:border-emerald-500 hover:shadow-lg transition-all text-left"
        >
          <div className="text-5xl mb-4">👷</div>
          <h2 className="text-2xl font-bold mb-2">I'm a Professional</h2>
          <p className="text-gray-600">
            Ready to showcase my work and connect with clients
          </p>
        </motion.button>
      </div>
    </motion.div>
  );

  const renderClientForm = () => (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8"
    >
      <h2 className="text-3xl font-bold mb-6">Complete Your Profile</h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Address</label>
          <input
            type="text"
            value={formData.address || ""}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">City</label>
            <input
              type="text"
              value={formData.city || ""}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">County</label>
            <input
              type="text"
              value={formData.county || ""}
              onChange={(e) =>
                setFormData({ ...formData, county: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Zip Code</label>
            <input
              type="text"
              value={formData.zipCode || ""}
              onChange={(e) =>
                setFormData({ ...formData, zipCode: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 mt-8">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep("role")}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-emerald-500 hover:bg-emerald-600"
        >
          {loading ? "Saving..." : "Complete Profile"}
        </Button>
      </div>
    </motion.form>
  );

  const renderProfessionalForm = () => (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8"
    >
      <h2 className="text-3xl font-bold mb-6">Professional Profile</h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.companyName || ""}
            onChange={(e) =>
              setFormData({ ...formData, companyName: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              License Number
            </label>
            <input
              type="text"
              value={formData.licenseNumber || ""}
              onChange={(e) =>
                setFormData({ ...formData, licenseNumber: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Years of Experience
            </label>
            <input
              type="number"
              min="0"
              value={formData.yearsExperience || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  yearsExperience: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Services Offered <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {SERVICES_OPTIONS.map((service) => (
              <label
                key={service}
                className="flex items-center space-x-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={formData.servicesOffered?.includes(service)}
                  onChange={() => handleServiceToggle(service)}
                  className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm">{service}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Bio</label>
          <textarea
            value={formData.bio || ""}
            onChange={(e) =>
              setFormData({ ...formData, bio: e.target.value })
            }
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="Tell clients about your experience and expertise..."
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">City</label>
            <input
              type="text"
              value={formData.city || ""}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">County</label>
            <input
              type="text"
              value={formData.county || ""}
              onChange={(e) =>
                setFormData({ ...formData, county: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Country</label>
            <input
              type="text"
              value={formData.country || ""}
              onChange={(e) =>
                setFormData({ ...formData, country: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 mt-8">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep("role")}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-emerald-500 hover:bg-emerald-600"
        >
          {loading ? "Saving..." : "Complete Profile"}
        </Button>
      </div>
    </motion.form>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 py-12 px-4">
      <AnimatePresence mode="wait">
        {step === "role" && renderRoleSelection()}
        {step === "details" && role === "client" && renderClientForm()}
        {step === "details" && role === "professional" && renderProfessionalForm()}
      </AnimatePresence>
    </div>
  );
}

