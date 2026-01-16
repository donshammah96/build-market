"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserCheck } from "lucide-react";
import { UpdateStatusDialog } from "./UpdateStatusDialog";

interface UpdateStatusButtonProps {
  leadId: string;
  currentStatus: string;
}

export function UpdateStatusButton({
  leadId,
  currentStatus,
}: UpdateStatusButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="default" onClick={() => setOpen(true)}>
        <UserCheck className="h-4 w-4 mr-2" />
        Update Status
      </Button>
      <UpdateStatusDialog
        open={open}
        onOpenChange={setOpen}
        leadId={leadId}
        currentStatus={currentStatus}
      />
    </>
  );
}
