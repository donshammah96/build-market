"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UserCheck,
  Store,
  Building2,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "react-toastify";
import {
  verifyEntity,
  batchVerifyEntities,
  getVerificationUpdates,
  type VerificationQueueItem,
  type VerificationFilterInput,
  type PaginationMeta,
  type EntityType,
} from "@/actions/admin";
import { createAdminIdempotencyKey } from "@/lib/security/idempotency-key";
import { RejectionReasonDialog } from "./RejectionReasonDialog";

interface VerificationQueueProps {
  items: VerificationQueueItem[];
  pagination: PaginationMeta;
  filters: VerificationFilterInput;
  canVerify: boolean;
}

const entityTypeConfig = {
  professional: {
    icon: UserCheck,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Professional",
  },
  store: {
    icon: Store,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    label: "Store",
  },
  property: {
    icon: Building2,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    label: "Property",
  },
};

const statusConfig = {
  UNVERIFIED: {
    label: "Unverified",
    variant: "secondary" as const,
    color: "text-zinc-500",
  },
  PENDING: {
    label: "Pending",
    variant: "default" as const,
    color: "text-amber-500",
  },
  VERIFIED: {
    label: "Verified",
    variant: "default" as const,
    color: "text-emerald-500",
  },
  REJECTED: {
    label: "Rejected",
    variant: "destructive" as const,
    color: "text-red-500",
  },
  NEEDS_CORRECTION: {
    label: "Needs Correction",
    variant: "default" as const,
    color: "text-orange-500",
  },
};

// Polling interval in ms
const POLLING_INTERVAL = 30000; // 30 seconds

export function VerificationQueue({
  items: initialItems,
  pagination,
  filters,
  canVerify,
}: VerificationQueueProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [items, setItems] = useState(initialItems);
  const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "single" | "batch";
    entityType?: EntityType;
    entityId?: string;
    action: "REJECT" | "REQUEST_CORRECTION";
  } | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date().toISOString());
  const [isPolling, setIsPolling] = useState(false);

  // Update items when props change
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Polling for updates
  const pollForUpdates = useCallback(async () => {
    if (isPolling) return;

    setIsPolling(true);
    try {
      const response = await getVerificationUpdates(
        lastUpdate,
        filters.entityType === "all" ? "all" : filters.entityType,
      );

      if (response.success && response.data?.hasUpdates) {
        // Refresh the page to get updated data
        router.refresh();
        setLastUpdate(response.data.timestamp);
        toast.info("Queue updated with new items");
      }
    } catch (error) {
      console.error("Polling error:", error);
    } finally {
      setIsPolling(false);
    }
  }, [lastUpdate, filters.entityType, router, isPolling]);

  // Set up polling interval
  useEffect(() => {
    const interval = setInterval(pollForUpdates, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [pollForUpdates]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(
        new Set(items.map((item) => `${item.entityType}:${item.entityId}`)),
      );
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (
    entityType: string,
    entityId: string,
    checked: boolean,
  ) => {
    const key = `${entityType}:${entityId}`;
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(key);
    } else {
      newSelected.delete(key);
    }
    setSelectedItems(newSelected);
  };

  const handleVerify = async (entityType: EntityType, entityId: string) => {
    if (!canVerify) {
      toast.error("You don't have permission to verify entities");
      return;
    }

    startTransition(async () => {
      const response = await verifyEntity(
        {
          entityType,
          entityId,
          action: "VERIFY",
        },
        createAdminIdempotencyKey(
          "verifyEntity",
          `${entityType}:${entityId}:VERIFY`,
        ),
      );

      if (response.success) {
        toast.success(response.data?.message || "Successfully verified");
        router.refresh();
      } else {
        toast.error(response.error || "Failed to verify");
      }
    });
  };

  const handleReject = (entityType: EntityType, entityId: string) => {
    if (!canVerify) {
      toast.error("You don't have permission to reject entities");
      return;
    }

    setPendingAction({
      type: "single",
      entityType,
      entityId,
      action: "REJECT",
    });
    setIsRejectionDialogOpen(true);
  };

  const handleRequestCorrection = (
    entityType: EntityType,
    entityId: string,
  ) => {
    if (!canVerify) {
      toast.error("You don't have permission to request corrections");
      return;
    }

    setPendingAction({
      type: "single",
      entityType,
      entityId,
      action: "REQUEST_CORRECTION",
    });
    setIsRejectionDialogOpen(true);
  };

  const handleRejectionSubmit = async (reason: string) => {
    if (!pendingAction) return;
    if (!canVerify) {
      toast.error("You don't have permission to perform this action");
      return;
    }

    startTransition(async () => {
      if (
        pendingAction.type === "single" &&
        pendingAction.entityType &&
        pendingAction.entityId
      ) {
        const response = await verifyEntity(
          {
            entityType: pendingAction.entityType,
            entityId: pendingAction.entityId,
            action: pendingAction.action,
            reason,
          },
          createAdminIdempotencyKey(
            "verifyEntity",
            `${pendingAction.entityType}:${pendingAction.entityId}:${pendingAction.action}`,
          ),
        );

        if (response.success) {
          toast.success(
            response.data?.message ||
              `Successfully ${pendingAction.action === "REJECT" ? "rejected" : "requested correction"}`,
          );
          router.refresh();
        } else {
          toast.error(response.error || "Action failed");
        }
      } else if (pendingAction.type === "batch") {
        const entities = Array.from(selectedItems)
          .map((key) => {
            const [entityType, entityId] = key.split(":");
            return { entityType: entityType as EntityType, entityId };
          })
          .filter(
            (e): e is { entityType: EntityType; entityId: string } =>
              e.entityId !== undefined && e.entityId !== "",
          );

        const response = await batchVerifyEntities(
          entities,
          pendingAction.action,
          createAdminIdempotencyKey(
            "batchVerifyEntities",
            `${pendingAction.action}:${entities
              .map((entity) => `${entity.entityType}:${entity.entityId}`)
              .sort()
              .join(",")}`,
          ),
          reason,
        );

        if (response.success) {
          toast.success(
            `Batch action completed: ${response.data?.summary.successful} successful, ${response.data?.summary.failed} failed`,
          );
          setSelectedItems(new Set());
          router.refresh();
        } else {
          toast.error(response.error || "Batch action failed");
        }
      }

      setIsRejectionDialogOpen(false);
      setPendingAction(null);
    });
  };

  const handleBatchVerify = async () => {
    if (!canVerify) {
      toast.error("You don't have permission to perform batch verification");
      return;
    }

    const entities = Array.from(selectedItems)
      .map((key) => {
        const [entityType, entityId] = key.split(":");
        return { entityType: entityType as EntityType, entityId };
      })
      .filter(
        (e): e is { entityType: EntityType; entityId: string } =>
          e.entityId !== undefined && e.entityId !== "",
      );

    startTransition(async () => {
      const response = await batchVerifyEntities(
        entities,
        "VERIFY",
        createAdminIdempotencyKey(
          "batchVerifyEntities",
          `VERIFY:${entities
            .map((entity) => `${entity.entityType}:${entity.entityId}`)
            .sort()
            .join(",")}`,
        ),
        undefined,
      );

      if (response.success) {
        toast.success(
          `Batch verification completed: ${response.data?.summary.successful} successful, ${response.data?.summary.failed} failed`,
        );
        setSelectedItems(new Set());
        router.refresh();
      } else {
        toast.error(response.error || "Batch verification failed");
      }
    });
  };

  const handleBatchReject = () => {
    if (!canVerify) {
      toast.error("You don't have permission to perform batch rejection");
      return;
    }

    setPendingAction({
      type: "batch",
      action: "REJECT",
    });
    setIsRejectionDialogOpen(true);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`/verifications?${params.toString()}`);
  };

  const allSelected = items.length > 0 && selectedItems.size === items.length;
  const someSelected =
    selectedItems.size > 0 && selectedItems.size < items.length;

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {canVerify && selectedItems.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedItems.size} item{selectedItems.size > 1 ? "s" : ""}{" "}
            selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={handleBatchVerify}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Verify All
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBatchReject}
              disabled={isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject All
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedItems(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Manual Refresh Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            router.refresh();
            toast.info("Queue refreshed");
          }}
          disabled={isPending}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isPolling ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  disabled={!canVerify}
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                  {...(someSelected && { "data-state": "indeterminate" })}
                />
              </TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8" />
                    <span>No items pending verification</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const typeConfig = entityTypeConfig[item.entityType];
                const status =
                  statusConfig[item.status as keyof typeof statusConfig];
                const itemKey = `${item.entityType}:${item.entityId}`;

                return (
                  <TableRow key={itemKey}>
                    <TableCell>
                      <Checkbox
                        disabled={!canVerify}
                        checked={selectedItems.has(itemKey)}
                        onCheckedChange={(checked) =>
                          handleSelectItem(
                            item.entityType,
                            item.entityId,
                            checked as boolean,
                          )
                        }
                        aria-label={`Select ${item.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${typeConfig.bgColor}`}>
                          <typeConfig.icon
                            className={`h-4 w-4 ${typeConfig.color}`}
                          />
                        </div>
                        <div>
                          <Link
                            href={`/verifications/${item.entityType}/${item.entityId}`}
                            className="font-medium hover:underline"
                          >
                            {item.name}
                          </Link>
                          {item.location && (
                            <p className="text-xs text-muted-foreground">
                              {item.location}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeConfig.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">
                          {item.owner?.firstName} {item.owner?.lastName}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {item.owner?.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status?.variant || "secondary"}>
                        {status?.label || item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.submittedAt ? (
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(item.submittedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {item.documentCount !== undefined && (
                          <p>{item.documentCount} documents</p>
                        )}
                        {item.certificateCount !== undefined && (
                          <p>{item.certificateCount} certificates</p>
                        )}
                        {item.productCount !== undefined && (
                          <p>{item.productCount} products</p>
                        )}
                        {item.attachmentCount !== undefined && (
                          <p>{item.attachmentCount} attachments</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/verifications/${item.entityType}/${item.entityId}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              handleVerify(item.entityType, item.entityId)
                            }
                            disabled={isPending || !canVerify}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
                            Verify
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleRequestCorrection(
                                item.entityType,
                                item.entityId,
                              )
                            }
                            disabled={isPending || !canVerify}
                          >
                            <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
                            Request Correction
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleReject(item.entityType, item.entityId)
                            }
                            disabled={isPending || !canVerify}
                            className="text-red-500"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isPending}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Rejection Dialog */}
      <RejectionReasonDialog
        open={isRejectionDialogOpen}
        onOpenChange={setIsRejectionDialogOpen}
        onSubmit={handleRejectionSubmit}
        action={pendingAction?.action || "REJECT"}
        isLoading={isPending}
      />
    </div>
  );
}
