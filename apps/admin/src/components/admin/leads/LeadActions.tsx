"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, MessageSquare, Phone, XCircle } from "lucide-react";
import { updateLead } from "@/actions/admin";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

interface LeadActionsProps {
  leadId: string;
  clientEmail: string | null;
  clientPhone: string | null;
}

export function LeadActions({
  leadId,
  clientEmail,
  clientPhone,
}: LeadActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [markLostOpen, setMarkLostOpen] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");

  const handleMarkAsLost = () => {
    startTransition(async () => {
      const result = await updateLead(leadId, {
        status: "LOST",
      });

      if (result.success) {
        toast.success("Lead marked as lost");
        router.refresh();
        setMarkLostOpen(false);
      } else {
        toast.error(result.error || "Failed to mark lead as lost");
      }
    });
  };

  const handleSendEmail = () => {
    if (!clientEmail) {
      toast.error("No email address available for this client");
      return;
    }

    const subject = encodeURIComponent("Regarding Your Project Inquiry");
    const body = encodeURIComponent(
      emailMessage ||
        "Hello,\n\nThank you for your interest. We'll be in touch soon.\n\nBest regards"
    );
    window.location.href = `mailto:${clientEmail}?subject=${subject}&body=${body}`;
    setSendEmailOpen(false);
    setEmailMessage("");
  };

  const handleLogCall = () => {
    if (!clientPhone) {
      toast.error("No phone number available for this client");
      return;
    }
    window.location.href = `tel:${clientPhone}`;
  };

  return (
    <>
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setSendEmailOpen(true)}
          disabled={!clientEmail}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Send Email
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleLogCall}
          disabled={!clientPhone}
        >
          <Phone className="h-4 w-4 mr-2" />
          Log Call
        </Button>
        <Separator className="my-2" />
        <Button
          variant="destructive"
          className="w-full justify-start"
          onClick={() => setMarkLostOpen(true)}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Mark as Lost
        </Button>
      </div>

      {/* Mark as Lost Dialog */}
      <Dialog open={markLostOpen} onOpenChange={setMarkLostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Lead as Lost</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this lead as lost? This action can
              be reversed later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMarkLostOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleMarkAsLost}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark as Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={sendEmailOpen} onOpenChange={setSendEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Email to Client</DialogTitle>
            <DialogDescription>
              Compose a message to send to {clientEmail}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-message">Message</Label>
              <Textarea
                id="email-message"
                placeholder="Enter your message here..."
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendEmailOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail}>Open Email Client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
