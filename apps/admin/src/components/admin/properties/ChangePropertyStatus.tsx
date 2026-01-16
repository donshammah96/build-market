"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { changePropertyStatus } from "@/actions/admin";
import { toast } from "react-toastify";

interface ChangePropertyStatusProps {
  propertyId: string;
  currentStatus: string;
}

const statusOptions = [
  { value: "AVAILABLE", label: "Available" },
  { value: "SOLD", label: "Sold" },
  { value: "RENTED", label: "Rented" },
  { value: "UNDER_OFFER", label: "Under Offer" },
] as const;

export function ChangePropertyStatus({
  propertyId,
  currentStatus,
}: ChangePropertyStatusProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedStatus, setSelectedStatus] = useState<string>(currentStatus);

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === currentStatus) return;

    startTransition(async () => {
      const result = await changePropertyStatus(
        propertyId,
        newStatus as "AVAILABLE" | "SOLD" | "RENTED" | "UNDER_OFFER"
      );

      if (result.success) {
        toast.success("Property status updated successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update property status");
        setSelectedStatus(currentStatus); // Revert on error
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedStatus}
        onValueChange={(value) => {
          setSelectedStatus(value);
          handleStatusChange(value);
        }}
        disabled={isPending}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
