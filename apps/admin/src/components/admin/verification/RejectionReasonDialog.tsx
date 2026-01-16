"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, XCircle, AlertTriangle } from "lucide-react";

interface RejectionReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
  action: "REJECT" | "REQUEST_CORRECTION";
  isLoading?: boolean;
}

const predefinedReasons = {
  REJECT: [
    "Fraudulent or fake documents submitted",
    "Business license expired or invalid",
    "Identity verification failed",
    "Incomplete or missing required documents",
    "Information does not match official records",
    "Repeated failed verification attempts",
    "Violation of platform terms of service",
  ],
  REQUEST_CORRECTION: [
    "Documents are unclear or unreadable",
    "Missing required certifications",
    "Business registration needs updating",
    "Contact information needs verification",
    "Profile information incomplete",
    "Additional documentation required",
    "Photos do not meet requirements",
  ],
};

export function RejectionReasonDialog({
  open,
  onOpenChange,
  onSubmit,
  action,
  isLoading = false,
}: RejectionReasonDialogProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const isRejection = action === "REJECT";
  const reasons = predefinedReasons[action];

  const handleSubmit = () => {
    const reason = selectedReason === "custom" ? customReason : selectedReason;
    if (reason.trim()) {
      onSubmit(reason.trim());
      // Reset form
      setSelectedReason("");
      setCustomReason("");
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedReason("");
      setCustomReason("");
    }
    onOpenChange(open);
  };

  const isValid =
    (selectedReason && selectedReason !== "custom") ||
    (selectedReason === "custom" && customReason.trim().length > 10);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRejection ? (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                Reject Verification
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Request Correction
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isRejection
              ? "Please provide a reason for rejecting this verification request. The applicant will be notified."
              : "Please specify what corrections are needed. The applicant will be notified and can resubmit."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Select a reason</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a reason..." />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Other (specify below)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedReason === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="customReason">Custom reason</Label>
              <Textarea
                id="customReason"
                placeholder={
                  isRejection
                    ? "Explain why this verification is being rejected..."
                    : "Explain what corrections are needed..."
                }
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 10 characters required. Be specific and professional.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={isRejection ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isRejection ? "Reject" : "Request Correction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
