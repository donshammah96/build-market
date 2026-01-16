"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { updateLead } from "@/actions/admin";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

interface UpdateStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  currentStatus: string;
}

const statusOptions = [
  { value: "NEW", label: "New Lead" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "PROPOSAL", label: "Proposal Sent" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
] as const;

export function UpdateStatusDialog({
  open,
  onOpenChange,
  leadId,
  currentStatus,
}: UpdateStatusDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>(currentStatus);
  const [notes, setNotes] = useState<string>("");

  const handleSubmit = () => {
    if (!status || status === currentStatus) {
      onOpenChange(false);
      return;
    }

    startTransition(async () => {
      const result = await updateLead(leadId, {
        status: status as "NEW" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST",
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast.success("Lead status updated successfully");
        router.refresh();
        onOpenChange(false);
        setNotes("");
      } else {
        toast.error(result.error || "Failed to update lead status");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Lead Status</DialogTitle>
          <DialogDescription>
            Change the status of this lead and optionally add notes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes about this status change..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || status === currentStatus}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
