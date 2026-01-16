"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  Plus,
  MoreVertical,
  Image as ImageIcon,
  Eye,
  Edit,
  Trash2,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { ImageWithFallback } from "@/app/lib/ImageWithFallback";

// Portfolio item interface
interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  projectType: string;
  images: string[] | string;
}

const createProjectSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  projectType: z.string().min(1, "Project type is required"),
  // Image URL is optional in schema - we validate file separately
  imageUrl: z.string().optional(),
  clientTestimonial: z.string().optional(),
});

type CreateProjectFormValues = z.infer<typeof createProjectSchema>;

/**
 * PortfolioPage Component
 *
 * Enterprise-level portfolio management interface with:
 * - Image upload with drag & drop
 * - CRUD operations
 * - Responsive grid layout
 * - Error handling and validation
 */
export default function PortfolioPage() {
  const queryClient = useQueryClient();

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- File Upload Helper ---
  const uploadFiles = async (
    files: File[],
    fieldName: string
  ): Promise<string[]> => {
    const form = new FormData();
    files.forEach((f) => form.append(fieldName, f));

    const res = await fetch("/api/uploads", { method: "POST", body: form });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `Upload failed with ${res.status}`);
    }

    const json = await res.json();
    return (
      json.data?.uploaded?.[fieldName]?.map((i: { url: string }) => i.url) || []
    );
  };

  // --- File Selection Handler ---
  const handleFileSelect = useCallback((file: File | null) => {
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be less than 10MB");
        return;
      }
      setSelectedFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      setImagePreview(null);
    }
  }, []);

  // --- Drag & Drop Handlers ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  // --- Fetch Portfolio ---
  const {
    data: portfolioData,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ["professional-portfolio"],
    queryFn: async () => {
      const response = await fetch("/api/professional-portal/portfolio");
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch portfolio");
      }
      const result = await response.json();
      // Handle both direct array response and paginated response
      if (Array.isArray(result)) {
        return result;
      }
      if (result.data && Array.isArray(result.data)) {
        return result.data;
      }
      return [];
    },
    retry: 2,
    staleTime: 30000, // 30 seconds
  });

  // Ensure portfolioItems is always an array
  const portfolioItems = useMemo(() => {
    if (!portfolioData) return [];
    if (Array.isArray(portfolioData)) return portfolioData;
    if (portfolioData.data && Array.isArray(portfolioData.data)) {
      return portfolioData.data;
    }
    return [];
  }, [portfolioData]);

  // --- Create Mutation ---
  const createMutation = useMutation({
    mutationFn: async (data: CreateProjectFormValues) => {
      // Validate image is selected
      if (!selectedFile) {
        throw new Error("Please select an image for your project");
      }

      // Upload file first
      setIsUploading(true);
      let imageUrls: string[];
      try {
        imageUrls = await uploadFiles([selectedFile], "images");
      } catch {
        throw new Error("Failed to upload image. Please try again.");
      } finally {
        setIsUploading(false);
      }

      if (!imageUrls.length) {
        throw new Error("No image was uploaded. Please try again.");
      }

      // Create portfolio item with uploaded image URL
      // Convert relative URLs to absolute URLs (portfolio API validates for full URLs)
      const absoluteUrls = imageUrls.map((url) =>
        url.startsWith("/") ? `${window.location.origin}${url}` : url
      );

      const payload = {
        ...data,
        images: absoluteUrls,
      };

      const res = await fetch("/api/professional-portal/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create project");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professional-portfolio"] });
      setIsCreateOpen(false);
      toast.success("Project added successfully");
      form.reset();
      // Reset file state
      setSelectedFile(null);
      setImagePreview(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: "",
      description: "",
      projectType: "",
      imageUrl: "",
      clientTestimonial: "",
    },
  });

  function onSubmit(data: CreateProjectFormValues) {
    createMutation.mutate(data);
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      {/* --- Header --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Portfolio
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">
            Showcase your best work to attract more clients.
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-zinc-900 hover:bg-zinc-800 text-white shadow-md">
              <Plus className="mr-2 h-4 w-4" /> Add Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Project</DialogTitle>
              <DialogDescription>
                Share details about a completed project.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <SelectItem value="Residential">
                              Residential
                            </SelectItem>
                            <SelectItem value="Commercial">
                              Commercial
                            </SelectItem>
                            <SelectItem value="Renovation">
                              Renovation
                            </SelectItem>
                            <SelectItem value="Landscaping">
                              Landscaping
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* File Upload Area */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Project Image <span className="text-red-500">*</span>
                  </label>
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer
                      ${isDragging ? "border-zinc-900 bg-zinc-50" : "border-zinc-300 hover:border-zinc-400"}
                      ${imagePreview ? "bg-zinc-50" : ""}
                    `}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                    />

                    {imagePreview ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-40 object-cover rounded-md"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileSelect(null);
                          }}
                          className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-zinc-100"
                        >
                          <X className="h-4 w-4 text-zinc-600" />
                        </button>
                        <p className="text-xs text-zinc-500 mt-2 text-center truncate">
                          {selectedFile?.name}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-zinc-500">
                        <Upload className="h-8 w-8" />
                        <p className="text-sm font-medium">
                          Click or drag to upload
                        </p>
                        <p className="text-xs">PNG, JPG, WebP up to 10MB</p>
                      </div>
                    )}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the project..."
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
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || isUploading}
                  >
                    {(createMutation.isPending || isUploading) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isUploading
                      ? "Uploading..."
                      : createMutation.isPending
                        ? "Creating..."
                        : "Create Project"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* --- Portfolio Grid --- */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[300px] bg-zinc-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : fetchError ? (
        <Card className="p-8">
          <div className="text-center">
            <p className="text-red-500 mb-4">
              {fetchError instanceof Error
                ? fetchError.message
                : "Failed to load portfolio"}
            </p>
            <Button
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["professional-portfolio"],
                })
              }
            >
              Retry
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Upload Placeholder */}
          <Card
            className="border-2 border-dashed border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-300 transition-all cursor-pointer group flex flex-col items-center justify-center h-full min-h-[300px]"
            onClick={() => setIsCreateOpen(true)}
          >
            <div className="h-12 w-12 rounded-full bg-white border border-zinc-200 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
              <Plus className="h-6 w-6 text-zinc-400 group-hover:text-zinc-900" />
            </div>
            <h3 className="font-semibold text-zinc-900">Create New Project</h3>
            <p className="text-sm text-zinc-500 mt-1">
              Upload photos & details
            </p>
          </Card>

          {portfolioItems.length === 0 ? (
            <div className="col-span-full">
              <Card className="p-12 text-center">
                <ImageIcon className="h-16 w-16 mx-auto mb-4 text-zinc-300" />
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                  No portfolio items yet
                </h3>
                <p className="text-zinc-500 mb-4">
                  Start building your portfolio by adding your first project.
                </p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add First Project
                </Button>
              </Card>
            </div>
          ) : (
            portfolioItems.map((item: PortfolioItem) => (
              <PortfolioItemCard key={item.id} item={item} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PortfolioItemCard({ item }: { item: PortfolioItem }) {
  const queryClient = useQueryClient();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Safe image handling: item.images might be string[] or JSON
  const mainImage = useMemo(() => {
    if (Array.isArray(item.images)) {
      return item.images[0];
    }
    if (typeof item.images === "string") {
      return item.images;
    }
    return null;
  }, [item.images]);

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/professional-portal/portfolio/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete portfolio");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professional-portfolio"] });
      setIsDeleteOpen(false);
      toast.success("Portfolio deleted successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete portfolio"
      );
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <>
      <Card className="border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-300 bg-white group overflow-hidden cursor-pointer">
        <Link href={`/professional-portal/portfolio/${item.id}`}>
          <div className="relative">
            <AspectRatio ratio={4 / 3} className="bg-zinc-100">
              {mainImage ? (
                <ImageWithFallback
                  src={mainImage}
                  alt={item.title}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 text-zinc-300">
                  <ImageIcon className="h-10 w-10" />
                </div>
              )}

              {/* Overlay Actions */}
              <div
                className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-start justify-end p-2 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.preventDefault()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 bg-white/90 hover:bg-white shadow-sm backdrop-blur-sm"
                    >
                      <MoreVertical className="h-4 w-4 text-zinc-700" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/professional-portal/portfolio/${item.id}`}>
                        <Eye className="mr-2 h-4 w-4" /> View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/professional-portal/portfolio/${item.id}`}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {/* Project Type Badge */}
              <div className="absolute top-2 left-2">
                <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 border-0 shadow-sm">
                  {item.projectType}
                </Badge>
              </div>
            </AspectRatio>
          </div>

          <CardContent className="p-4">
            <h3 className="font-bold text-zinc-900 truncate">{item.title}</h3>
            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
              {item.description || "No description"}
            </p>
          </CardContent>
        </Link>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Portfolio</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{item.title}&rdquo;? This
              action cannot be undone. All images associated with this portfolio
              will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Portfolio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
