"use client";

import { CheckCircle, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type VerificationStatus =
  | "VERIFIED"
  | "PENDING"
  | "REJECTED"
  | "NEEDS_CORRECTION"
  | "UNVERIFIED"
  | null
  | undefined;

interface VerificationBadgeProps {
  status: VerificationStatus;
}

export function VerificationBadge({ status }: VerificationBadgeProps) {
  switch (status) {
    case "VERIFIED":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
          <CheckCircle className="mr-1 h-3 w-3" />
          Verified
        </Badge>
      );
    case "PENDING":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
          <Clock className="mr-1 h-3 w-3" />
          Pending Review
        </Badge>
      );
    case "REJECTED":
    case "NEEDS_CORRECTION":
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200">
          <XCircle className="mr-1 h-3 w-3" />
          {status === "REJECTED" ? "Rejected" : "Needs Correction"}
        </Badge>
      );
    default:
      return <Badge variant="outline">Unverified</Badge>;
  }
}
