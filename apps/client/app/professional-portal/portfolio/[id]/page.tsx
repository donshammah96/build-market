"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Loader2,
  Edit,
  Trash2,
  AlertCircle,
  Clock,
  Building2,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/text-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageWithFallback } from "@/app/lib/media/ImageWithFallback";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { portfolioClient, type PortfolioDetail } from "@/lib/portfolio-client";
import { ProjectTypeSchema } from "@/lib/validation/portfolio-validation";

// Schema for updating portfolio
const updatePortfolioSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  projectType: ProjectTypeSchema,
  clientTestimonial: z.string().optional(),
  completedAt: z.string().optional().nullable(),
});

type UpdatePortfolioFormValues = z.infer<typeof updatePortfolioSchema>;

export default function PortfolioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Fetch Portfolio
  const {
    data: portfolio,
    isLoading,
    error,
  } = useQuery<PortfolioDetail>({
    queryKey: ["portfolio", id],
    queryFn: async () => {
      const res = await portfolioClient.getPortfolioDetail(id);
      if (!res.success || res.data === undefined) {
        throw new Error(res.error || "Failed to fetch portfolio");
      }
      return res.data;
    },
    enabled: !!id,
    retry: 2,
    staleTime: 30000,
  });

  // Update Portfolio Mutation
  const updatePortfolioMutation = useMutation({
    mutationFn: async (data: UpdatePortfolioFormValues) => {
      const res = await portfolioClient.updatePortfolio({
        portfolioId: id,
        data: {
          ...data,
          completionDate: data.completedAt
            ? new Date(data.completedAt).toISOString()
            : null,
        },
      });
      if (!res.success) {
        throw new Error(res.error || "Failed to update portfolio");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", id] });
      queryClient.invalidateQueries({ queryKey: ["professional-portfolio"] });
      setIsEditOpen(false);
      toast.success("Portfolio updated successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update portfolio",
      );
    },
  });

  // Delete Portfolio Mutation
  const deletePortfolioMutation = useMutation({
    mutationFn: async () => {
      const res = await portfolioClient.deletePortfolio({
        portfolioId: id,
      });
      if (!res.success) {
        throw new Error(res.error || "Failed to delete portfolio");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professional-portfolio"] });
      toast.success("Portfolio deleted successfully");
      router.push("/professional-portal/portfolio");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete portfolio",
      );
    },
  });

  const form = useForm<UpdatePortfolioFormValues>({
    resolver: zodResolver(updatePortfolioSchema),
    defaultValues: {
      title: portfolio?.title || "",
      description: portfolio?.description || "",
      projectType: (portfolio?.projectType ??
        "OTHER") as UpdatePortfolioFormValues["projectType"],
      clientTestimonial: portfolio?.clientTestimonial || "",
      completedAt: portfolio?.completedAt
        ? new Date(portfolio.completedAt).toISOString().split("T")[0]
        : "",
    },
  });

  const formControl =
    form.control as unknown as Control<UpdatePortfolioFormValues>;

  // Update form when portfolio data loads
  if (portfolio && form.getValues().title === "") {
    form.reset({
      title: portfolio.title,
      description: portfolio.description || "",
      projectType:
        portfolio.projectType as UpdatePortfolioFormValues["projectType"],
      clientTestimonial: portfolio.clientTestimonial || "",
      completedAt: portfolio.completedAt
        ? new Date(portfolio.completedAt).toISOString().split("T")[0]
        : "",
    });
  }

  function onSubmit(data: UpdatePortfolioFormValues) {
    updatePortfolioMutation.mutate(data);
  }

  const handleDelete = () => {
    deletePortfolioMutation.mutate();
  };

  // Get sorted images
  const images = useMemo(() => {
    if (!portfolio?.images) return [];
    return [...portfolio.images].sort((a, b) => {
      if (a.isMain && !b.isMain) return -1;
      if (!a.isMain && b.isMain) return 1;
      return a.sortOrder - b.sortOrder;
    });
  }, [portfolio?.images]);

  const mainImage = images.find((img) => img.isMain) || images[0];
  const beforeImages = images.filter((img) => img.isBefore);
  const afterImages = images.filter((img) => img.isAfter);

  // Image navigation
  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-400 mx-auto">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-zinc-200 animate-pulse rounded" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-zinc-200 animate-pulse rounded" />
            <div className="h-4 w-32 bg-zinc-200 animate-pulse rounded" />
          </div>
        </div>
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <span className="ml-3 text-zinc-500">Loading portfolio...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="space-y-6 max-w-400 mx-auto">
        <Button variant="ghost" asChild>
          <Link href="/professional-portal/portfolio">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Portfolio
          </Link>
        </Button>
        <Card className="p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Portfolio Not Found
            </h2>
            <p className="text-zinc-500 mb-4">
              {error instanceof Error
                ? error.message
                : "The portfolio item you're looking for doesn't exist."}
            </p>
            <Button asChild>
              <Link href="/professional-portal/portfolio">
                Back to Portfolio
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-400 mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start border-b border-zinc-100 pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/professional-portal/portfolio">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
                {portfolio.title}
              </h1>
              <Badge
                variant="outline"
                className="bg-zinc-100 text-zinc-700 border-zinc-200"
              >
                {portfolio.projectType}
              </Badge>
            </div>
            <p className="text-zinc-500 mt-1">
              Portfolio #{portfolio.id.substring(0, 8).toUpperCase()} • Created{" "}
              {new Date(portfolio.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            className="border-zinc-200"
          >
            <Edit className="mr-2 h-4 w-4" /> Edit Portfolio
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsDeleteOpen(true)}
            disabled={deletePortfolioMutation.isPending}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            {deletePortfolioMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Image */}
          {mainImage && (
            <Card className="border border-zinc-200 shadow-sm bg-white overflow-hidden">
              <AspectRatio ratio={16 / 9} className="bg-zinc-100">
                <ImageWithFallback
                  src={mainImage.url}
                  alt={portfolio.title}
                  className="object-cover w-full h-full cursor-pointer"
                  onClick={() => {
                    setSelectedImageIndex(0);
                    setIsLightboxOpen(true);
                  }}
                />
              </AspectRatio>
              {mainImage.caption && (
                <div className="p-4 border-t border-zinc-100">
                  <p className="text-sm text-zinc-600">{mainImage.caption}</p>
                </div>
              )}
            </Card>
          )}

          {/* Image Gallery */}
          {images.length > 1 && (
            <Card className="border border-zinc-200 shadow-sm bg-white">
              <div className="p-6 border-b border-zinc-100">
                <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Gallery ({images.length} images)
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className="relative group cursor-pointer"
                      onClick={() => {
                        setSelectedImageIndex(index);
                        setIsLightboxOpen(true);
                      }}
                    >
                      <AspectRatio
                        ratio={1}
                        className="bg-zinc-100 rounded-lg overflow-hidden"
                      >
                        <ImageWithFallback
                          src={image.url}
                          alt={
                            image.caption ||
                            `${portfolio.title} - Image ${index + 1}`
                          }
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform"
                        />
                      </AspectRatio>
                      {image.isMain && (
                        <Badge className="absolute top-2 left-2 text-xs">
                          Main
                        </Badge>
                      )}
                      {image.isBefore && (
                        <Badge
                          variant="outline"
                          className="absolute top-2 right-2 text-xs bg-blue-50"
                        >
                          Before
                        </Badge>
                      )}
                      {image.isAfter && (
                        <Badge
                          variant="outline"
                          className="absolute top-2 right-2 text-xs bg-emerald-50"
                        >
                          After
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Before/After Comparison */}
          {(beforeImages.length > 0 || afterImages.length > 0) && (
            <Card className="border border-zinc-200 shadow-sm bg-white">
              <div className="p-6 border-b border-zinc-100">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Before & After
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {beforeImages.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-zinc-500 mb-3">
                        Before
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {beforeImages.slice(0, 4).map((image) => (
                          <AspectRatio
                            key={image.id}
                            ratio={1}
                            className="bg-zinc-100 rounded-lg overflow-hidden"
                          >
                            <ImageWithFallback
                              src={image.url}
                              alt="Before"
                              className="object-cover w-full h-full"
                            />
                          </AspectRatio>
                        ))}
                      </div>
                    </div>
                  )}
                  {afterImages.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-zinc-500 mb-3">
                        After
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {afterImages.slice(0, 4).map((image) => (
                          <AspectRatio
                            key={image.id}
                            ratio={1}
                            className="bg-zinc-100 rounded-lg overflow-hidden"
                          >
                            <ImageWithFallback
                              src={image.url}
                              alt="After"
                              className="object-cover w-full h-full"
                            />
                          </AspectRatio>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Description */}
          {portfolio.description && (
            <Card className="border border-zinc-200 shadow-sm bg-white">
              <div className="p-6 border-b border-zinc-100">
                <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Project Description
                </h2>
              </div>
              <div className="p-6">
                <p className="text-zinc-900 whitespace-pre-wrap">
                  {portfolio.description}
                </p>
              </div>
            </Card>
          )}

          {/* Client Testimonial */}
          {portfolio.clientTestimonial && (
            <Card className="border border-emerald-200 shadow-sm bg-emerald-50/30">
              <div className="p-6 border-b border-emerald-100">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Client Testimonial
                </h2>
              </div>
              <div className="p-6">
                <blockquote className="text-zinc-900 italic">
                  &ldquo;{portfolio.clientTestimonial}&rdquo;
                </blockquote>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Project Details */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Project Details
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-500 mb-1 block">
                  Project Type
                </label>
                <p className="text-zinc-900 font-medium">
                  {portfolio.projectType}
                </p>
              </div>
              {portfolio.completedAt && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Completed Date
                    </label>
                    <p className="text-zinc-900">
                      {new Date(portfolio.completedAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </p>
                  </div>
                </>
              )}
              <Separator />
              <div>
                <label className="text-sm font-medium text-zinc-500 mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Created
                </label>
                <p className="text-zinc-900">
                  {new Date(portfolio.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium text-zinc-500 mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Last Updated
                </label>
                <p className="text-zinc-900">
                  {new Date(portfolio.updatedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </Card>

          {/* Professional Info */}
          {portfolio.professional && (
            <Card className="border border-zinc-200 shadow-sm bg-white">
              <div className="p-6 border-b border-zinc-100">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Professional
                </h2>
              </div>
              <div className="p-6 space-y-2">
                <p className="font-semibold text-zinc-900">
                  {portfolio.professional.companyName}
                </p>
                {(portfolio.professional.city ||
                  portfolio.professional.county) && (
                  <p className="text-sm text-zinc-500">
                    {[
                      portfolio.professional.city,
                      portfolio.professional.county,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && images.length > 0 && (
        <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
          <DialogContent className="max-w-7xl p-0 bg-black/95 border-none">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={() => setIsLightboxOpen(false)}
              >
                <X className="h-6 w-6" />
              </Button>
              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                </>
              )}
              <div className="relative w-full h-[80vh] flex items-center justify-center">
                <ImageWithFallback
                  src={images[selectedImageIndex]?.url}
                  alt={
                    images[selectedImageIndex]?.caption ||
                    `${portfolio.title} - Image ${selectedImageIndex + 1}`
                  }
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              {images[selectedImageIndex]?.caption && (
                <div className="p-4 bg-black/50 text-white text-center">
                  <p>{images[selectedImageIndex].caption}</p>
                </div>
              )}
              {images.length > 1 && (
                <div className="p-4 bg-black/50 text-white text-center text-sm">
                  Image {selectedImageIndex + 1} of {images.length}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-150 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Portfolio</DialogTitle>
            <DialogDescription>
              Update the portfolio project details.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={formControl}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Modern Kitchen Renovation"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="projectType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Residential">Residential</SelectItem>
                        <SelectItem value="Commercial">Commercial</SelectItem>
                        <SelectItem value="Renovation">Renovation</SelectItem>
                        <SelectItem value="Landscaping">Landscaping</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formControl}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the project..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientTestimonial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Testimonial (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What did the client say?"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formControl}
                name="completedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Completion Date (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  type="submit"
                  disabled={updatePortfolioMutation.isPending}
                >
                  {updatePortfolioMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>Delete Portfolio</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this portfolio item? This action
              cannot be undone. All images associated with this portfolio will
              also be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletePortfolioMutation.isPending}
            >
              {deletePortfolioMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Portfolio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
