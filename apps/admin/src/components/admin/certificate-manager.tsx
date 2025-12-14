"use client";

import { useState } from "react";
import { deleteCertificate } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface CertificateManagerProps {
  certificates: {
    id: string;
    name: string;
    fileUrl: string;
  }[];
}

export function CertificateManager({ certificates }: CertificateManagerProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this certificate?")) return;
    
    setDeletingId(id);
    try {
      const result = await deleteCertificate(id);
      if (result.success) {
        toast.success("Certificate deleted");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete");
      }
    } catch (error) {
      toast.error("Error deleting certificate");
    } finally {
      setDeletingId(null);
    }
  }

  // Note: Add functionality would typically involve a file uploader component
  // For now we just implement Delete

  return (
    <div className="space-y-2">
        {certificates.map(cert => (
            <div key={cert.id} className="flex items-center justify-between p-2 border rounded bg-background">
                <span className="text-sm truncate max-w-[200px]">{cert.name}</span>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(cert.id)}
                    disabled={deletingId === cert.id}
                >
                    {deletingId === cert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
            </div>
        ))}
    </div>
  );
}
