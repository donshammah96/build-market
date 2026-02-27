"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Loader2,
  AlertCircle,
  Edit,
  Eye,
  Trash2,
  Store,
  DollarSign,
  Package,
  ShoppingCart,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  VerificationBadge,
  type VerificationStatus,
} from "@/components/ui/VerificationBadge";
import { StatCard } from "@/components/ui/StatCard";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import StoreForm from "@/components/forms/StoreForm";
import { useMyStores, useCreateStore, useDeleteStore } from "@/hooks/useStores";
import type { StoreData, CreateStoreClientInput } from "@/lib/stores-client";

export default function StoresSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreData | null>(null);
  const [activeTab, setActiveTab] = useState<"stores" | "verification">(
    "stores",
  );

  const { data: stores = [], isLoading, error, refetch } = useMyStores();
  const createStoreMutation = useCreateStore({
    onSuccess: () => {
      setIsCreateOpen(false);
      toast.success("Store created successfully");
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to create store",
      );
    },
  });
  const deleteStoreMutation = useDeleteStore({
    onSuccess: () => {
      toast.success("Store deleted successfully");
      setIsDeleteOpen(false);
      setSelectedStore(null);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete store",
      );
    },
  });

  // Check URL params for status and redirect to verification tab if needed
  useEffect(() => {
    const status = searchParams.get("status");
    const tab = searchParams.get("tab");
    if (
      tab === "verification" ||
      status === "rejected" ||
      status === "needs_correction"
    ) {
      setActiveTab("verification");
    }
  }, [searchParams]);

  // Check for stores with pending/rejected verification
  const hasPendingIssues = stores.some(
    (s) =>
      s.verificationStatus === "REJECTED" ||
      s.verificationStatus === "NEEDS_CORRECTION" ||
      s.verificationStatus === "PENDING",
  );

  const handleDelete = (store: StoreData) => {
    setSelectedStore(store);
    setIsDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (selectedStore) {
      deleteStoreMutation.mutate({
        id: selectedStore.id,
        version: selectedStore.version ?? 0,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <Card className="p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Error Loading Stores
            </h2>
            <p className="text-zinc-500 mb-4">
              {error instanceof Error
                ? error.message
                : "Unable to load your stores. Please try again."}
            </p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Store Management
          </h1>
          <p className="text-zinc-500 mt-1">
            Manage your stores, verification status, and product inventory
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Store
        </Button>
      </div>

      {/* Alert for pending/rejected items */}
      {hasPendingIssues && activeTab === "stores" && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Verification Issues</AlertTitle>
          <AlertDescription>
            Some stores have pending verification or have been rejected.{" "}
            <Button
              variant="link"
              className="p-0 h-auto text-amber-700 underline"
              onClick={() => setActiveTab("verification")}
            >
              Review verification status
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      >
        <TabsList className="bg-zinc-100">
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="verification">
            Verification
            {hasPendingIssues && (
              <Badge className="ml-2 bg-amber-500 text-white">!</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Stores Tab */}
        <TabsContent value="stores" className="space-y-6 mt-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Total Stores" value={stores.length} icon={Store} />
            <StatCard
              label="Total Products"
              value={stores.reduce((sum, s) => sum + s.totalProducts, 0)}
              icon={Package}
              valueClassName="text-emerald-600"
              iconClassName="text-emerald-400"
            />
            <StatCard
              label="Total Orders"
              value={stores.reduce((sum, s) => sum + s.totalOrders, 0)}
              icon={ShoppingCart}
              valueClassName="text-blue-600"
              iconClassName="text-blue-400"
            />
            <StatCard
              label="Total Revenue"
              value={new Intl.NumberFormat("en-KE", {
                style: "currency",
                currency: "KES",
                minimumFractionDigits: 0,
              }).format(stores.reduce((sum, s) => sum + s.totalRevenue, 0))}
              icon={DollarSign}
            />
          </div>

          {/* Stores List */}
          <Card className="border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>My Stores</CardTitle>
            </CardHeader>
            <CardContent>
              {stores.length === 0 ? (
                <div className="text-center py-12">
                  <Store className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                    No Stores Found
                  </h3>
                  <p className="text-zinc-500 mb-4">
                    Get started by creating your first store.
                  </p>
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Store
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {stores.map((store) => (
                    <div
                      key={store.id}
                      className="flex flex-col md:flex-row gap-4 p-4 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                    >
                      {/* Store Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-zinc-900">
                                {store.name}
                              </h3>
                              <VerificationBadge
                                status={
                                  store.verificationStatus as VerificationStatus
                                }
                              />
                            </div>
                            {store.description && (
                              <p className="text-sm text-zinc-600 mt-1">
                                {store.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {store.slug}
                              </Badge>
                            </div>
                            {store.rejectionReason && (
                              <Alert className="mt-3 border-red-200 bg-red-50">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertTitle className="text-red-900">
                                  Rejection Reason
                                </AlertTitle>
                                <AlertDescription className="text-red-700">
                                  {store.rejectionReason}
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-zinc-600">
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4" />
                            <span>{store.totalProducts} products</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ShoppingCart className="h-4 w-4" />
                            <span>{store.totalOrders} orders</span>
                          </div>
                          {store.pendingOrders > 0 && (
                            <div className="flex items-center gap-1 text-amber-600">
                              <Clock className="h-4 w-4" />
                              <span>{store.pendingOrders} pending</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            <span className="font-semibold">
                              {new Intl.NumberFormat("en-KE", {
                                style: "currency",
                                currency: "KES",
                                minimumFractionDigits: 0,
                              }).format(store.totalRevenue)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/stores/${store.slug}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/stores/${store.id}/edit`)
                          }
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(store)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Verification Tab */}
        <TabsContent value="verification" className="space-y-6 mt-6">
          <Card className="border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>Store Verification Status</CardTitle>
            </CardHeader>
            <CardContent>
              {stores.length > 0 ? (
                <div className="space-y-4">
                  {stores.map((store) => {
                    const verificationStatus =
                      store.verificationStatus || "UNVERIFIED";
                    const isRejected =
                      verificationStatus === "REJECTED" ||
                      verificationStatus === "NEEDS_CORRECTION";
                    const isPending = verificationStatus === "PENDING";
                    const isVerified = verificationStatus === "VERIFIED";

                    return (
                      <div
                        key={store.id}
                        className="border border-zinc-200 rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-zinc-900">
                                {store.name}
                              </h3>
                              <VerificationBadge
                                status={
                                  store.verificationStatus as VerificationStatus
                                }
                              />
                            </div>
                            <p className="text-sm text-zinc-600">
                              {store.description || "No description"}
                            </p>
                            {store.rejectionReason && (
                              <Alert className="mt-3 border-red-200 bg-red-50">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertTitle className="text-red-900">
                                  Rejection Reason
                                </AlertTitle>
                                <AlertDescription className="text-red-700">
                                  {store.rejectionReason}
                                </AlertDescription>
                              </Alert>
                            )}
                            {isVerified && (
                              <p className="text-sm text-emerald-600 mt-2">
                                ✓ Your store has been verified and is live on
                                the platform.
                              </p>
                            )}
                            {isPending && (
                              <p className="text-sm text-amber-600 mt-2">
                                ⏳ Your store verification is under review.
                                We&apos;ll notify you once it&apos;s complete.
                              </p>
                            )}
                            {isRejected && (
                              <p className="text-sm text-red-600 mt-2">
                                ⚠️ Please review the rejection reason above and
                                resubmit your store for verification.
                              </p>
                            )}
                            {verificationStatus === "UNVERIFIED" && (
                              <p className="text-sm text-zinc-600 mt-2">
                                Your store needs to be verified before it can be
                                published. Please ensure all required
                                information is complete.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Store className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
                  <p className="text-zinc-500">No stores found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Store Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Store</DialogTitle>
            <DialogDescription>
              Create a new store to start selling building materials and
              products.
            </DialogDescription>
          </DialogHeader>
          <StoreForm
            onSubmit={async (data) => {
              const payload = {
                ...data,
                categories: data.categories.map((c) =>
                  c.toUpperCase(),
                ) as CreateStoreClientInput["categories"],
                storeType:
                  data.storeType.toUpperCase() as CreateStoreClientInput["storeType"],
                acceptsCard: false,
                acceptsCash: true,
                images:
                  data.images?.map((assetId, i) => ({
                    assetId,
                    category: "INTERIOR" as const,
                    isMain: i === 0,
                  })) ?? [],
              } satisfies CreateStoreClientInput;
              await createStoreMutation.mutateAsync(payload);
            }}
            hideSubmitButton={false}
            variant="light"
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) setSelectedStore(null);
        }}
        title="Delete Store"
        entityName={selectedStore?.name ?? ""}
        description={`Are you sure you want to delete \u201c${selectedStore?.name}\u201d? This action cannot be undone. All products and orders associated with this store will also be removed.`}
        onConfirm={confirmDelete}
        isPending={deleteStoreMutation.isPending}
      />
    </div>
  );
}
