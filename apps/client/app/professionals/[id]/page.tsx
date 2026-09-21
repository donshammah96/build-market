"use client";

import { useState, memo, useCallback } from "react";
import {
  Star,
  Briefcase,
  Mail,
  Phone,
  ExternalLink,
  Calendar,
  CheckCircle,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import { ImageWithFallback } from "@/app/lib/media/ImageWithFallback";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrustSealBadge } from "@build/ui/trust-seal-badge";
import { InsuredIndicator } from "@build/ui/insured-indicator";
import { BadgeRow } from "@build/ui/badge-row";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Navbar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import type { ProfessionalDetailResult } from "@/app/lib/domains/professionals";
import type { Portfolio, ProfessionalReview } from "@/types/professional";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  useShouldAnimate,
  useIntersectionObserver,
} from "@/lib/hooks/usePerformance";
import { useProfessional } from "@/hooks/useProfessionals";
import { useSubmitLead } from "@/hooks/usePublicLeads";

const contactSchema = z.object({
  clientName: z.string().min(1, "Name is required"),
  clientEmail: z.string().email("Invalid email address"),
  clientPhone: z.string().optional(),
  projectType: z.string().min(1, "Project type is required"),
  location: z.string().optional(),
  budget: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

// =============================================================================
// Loading and Error States (Memoized)
// =============================================================================

const LoadingState = memo(function LoadingState() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar variant="light" />
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading professional profile...</p>
        </div>
      </div>
      <Footer />
    </div>
  );
});

const ErrorState = memo(function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar variant="light" />
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600 mb-4">{message}</p>
            <Button onClick={() => window.history.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
});

// =============================================================================
// Profile Header Section (Memoized)
// =============================================================================

type ProfessionalDetailForDisplay = ProfessionalDetailResult & {
  licenseNumber?: string | null;
  _count?: {
    reviews: number;
    projects: number;
    stores: number;
    properties: number;
  };
};

interface ProfileHeaderProps {
  professional: ProfessionalDetailForDisplay;
  fullName: string;
  averageRating: string | null;
  onContactOpen: () => void;
}

const ProfileHeader = memo(function ProfileHeader({
  professional,
  fullName,
  averageRating,
  onContactOpen,
}: ProfileHeaderProps) {
  const shouldAnimate = useShouldAnimate();
  const [ref, isInView] = useIntersectionObserver();
  const user = professional.user;

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={cn(isInView && shouldAnimate && "animate-fade-in-up")}
    >
      <Card className="mb-8">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Profile Image */}
            <div className="shrink-0">
              <Avatar className="h-32 w-32 rounded-lg">
                <AvatarImage
                  src={
                    professional.profileImage ??
                    (professional.portfolios as Portfolio[])?.[0]?.images?.[0]
                      ?.url ??
                    ""
                  }
                  alt={fullName}
                />
                <AvatarFallback className="rounded-lg text-3xl">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center flex-wrap gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-slate-900">
                      {fullName}
                    </h1>
                    <TrustSealBadge
                      tier={
                        ((professional as any).trustTier as any) ||
                        (professional.verified
                          ? "SKILLS_VERIFIED"
                          : "UNVERIFIED")
                      }
                      authority={
                        (professional as any).licenses?.[0]?.authority ||
                        (professional.verified ? "NCA" : undefined)
                      }
                      licenseNumber={professional.licenseNumber || undefined}
                      size="sm"
                    />
                    {(professional as any).isInsured && (
                      <InsuredIndicator isInsured={true} size="sm" />
                    )}
                  </div>
                  <p className="text-xl text-slate-600 font-medium mb-2">
                    {professional.companyName}
                  </p>
                  {professional.licenseNumber && (
                    <p className="text-sm text-slate-500 font-mono">
                      Regulator License: {professional.licenseNumber}
                    </p>
                  )}

                  {/* Badge Row (Schema BadgeTypes) */}
                  <div className="mt-3">
                    <BadgeRow
                      earnedBadges={((professional as any).badges || []).map(
                        (b: any) => b.type || b,
                      )}
                      showLocked={false}
                      size="sm"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {averageRating && (
                    <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg">
                      <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                      <span className="text-lg font-bold">{averageRating}</span>
                      <span className="text-sm text-slate-600">
                        ({professional._count?.reviews || 0} reviews)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-600">Experience</p>
                    <p className="font-semibold">
                      {professional.yearsExperience}+ years
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-600">Projects</p>
                    <p className="font-semibold">
                      {professional._count?.projects || 0} completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-600">Rating</p>
                    <p className="font-semibold">
                      {averageRating || "N/A"} / 5.0
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="gap-2" onClick={onContactOpen}>
                  <MessageSquare className="h-4 w-4" />
                  Contact Professional
                </Button>

                <Button size="lg" variant="outline" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule Consultation
                </Button>
                {professional.portfolioUrl &&
                  professional.portfolioUrl.trim() !== "" && (
                    <a
                      href={professional.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "lg" }),
                        "gap-2",
                      )}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Portfolio
                    </a>
                  )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

// =============================================================================
// Portfolio Card (Memoized)
// =============================================================================

interface PortfolioCardProps {
  portfolio: Portfolio;
  index: number;
  shouldAnimate: boolean;
  isInView: boolean;
}

const PortfolioCard = memo(function PortfolioCard({
  portfolio,
  index,
  shouldAnimate,
  isInView,
}: PortfolioCardProps) {
  return (
    <div
      className={cn(isInView && shouldAnimate && "animate-fade-in-up")}
      style={{
        animationDelay: isInView && shouldAnimate ? `${index * 100}ms` : "0ms",
      }}
    >
      <Card className="overflow-hidden hover-lift h-full">
        <div className="aspect-video overflow-hidden bg-slate-200">
          <ImageWithFallback
            src={portfolio.images?.[0]?.url ?? ""}
            alt={portfolio.title ?? "Portfolio image"}
            className="w-full h-full object-cover img-zoom transition-transform duration-300"
          />
        </div>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-xl">{portfolio.title}</CardTitle>
            <Badge variant="outline">{portfolio.projectType}</Badge>
          </div>
          {portfolio.description && (
            <CardDescription>{portfolio.description}</CardDescription>
          )}
        </CardHeader>
        {portfolio.clientTestimonial && (
          <CardContent>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600 italic">
                &quot;{portfolio.clientTestimonial}&quot;
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
});

// =============================================================================
// Review Card (Memoized)
// =============================================================================

interface ReviewCardProps {
  review: ProfessionalReview;
  index: number;
  isLast: boolean;
  shouldAnimate: boolean;
  isInView: boolean;
}

const ReviewCard = memo(function ReviewCard({
  review,
  index,
  isLast,
  shouldAnimate,
  isInView,
}: ReviewCardProps) {
  return (
    <div
      className={cn(isInView && shouldAnimate && "animate-fade-in-up")}
      style={{
        animationDelay: isInView && shouldAnimate ? `${index * 100}ms` : "0ms",
      }}
    >
      <div className="flex gap-4">
        <Avatar>
          <AvatarFallback>
            {review.reviewer.firstName?.[0]}
            {review.reviewer.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-semibold">
                {review.reviewer.firstName} {review.reviewer.lastName}
              </p>
              <p className="text-sm text-slate-500">
                {new Date(review.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < review.rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-300"
                  }`}
                />
              ))}
            </div>
          </div>
          {review.comment && <p className="text-slate-600">{review.comment}</p>}
        </div>
      </div>
      {!isLast && <Separator className="mt-6" />}
    </div>
  );
});

// =============================================================================
// Contact Dialog (Memoized)
// =============================================================================

interface ContactDialogProps {
  professional: ProfessionalDetailForDisplay;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROJECT_TYPE_MAP: Record<string, string> = {
  "Residential Construction": "RESIDENTIAL",
  "Commercial Construction": "COMMERCIAL",
  Renovation: "RENOVATION",
  "Interior Design": "INTERIOR_DESIGN",
  Landscaping: "LANDSCAPING",
  Other: "OTHER",
};

function parseBudget(value: string): number | undefined {
  if (!value?.trim()) return undefined;
  const cleaned = value.replace(/[,\s]/g, "").toLowerCase();
  const match = cleaned.match(/^([\d.]+)(k|m)?$/);
  if (!match?.[1]) return undefined;
  let num = parseFloat(match[1]);
  if (match[2] === "k") num *= 1000;
  if (match[2] === "m") num *= 1_000_000;
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

const ContactDialog = memo(function ContactDialog({
  professional,
  open,
  onOpenChange,
}: ContactDialogProps) {
  const submitLead = useSubmitLead();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      projectType: "",
      location: "",
      budget: "",
      message: "",
    },
  });

  const onSubmit = (data: ContactFormValues) => {
    if (!professional) return;

    const projectType = PROJECT_TYPE_MAP[data.projectType] ?? "RESIDENTIAL";
    const budget = parseBudget(data.budget ?? "");

    submitLead.mutate(
      {
        professionalId: professional.userId,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone || undefined,
        title: data.message.substring(0, 200) || "Project inquiry",
        projectType: projectType as
          | "RESIDENTIAL"
          | "COMMERCIAL"
          | "RENOVATION"
          | "INTERIOR_DESIGN"
          | "LANDSCAPING"
          | "OTHER",
        message: data.message,
        location: data.location || undefined,
        budget,
        source: "PROFILE_VIEW",
      },
      {
        onSuccess: () => {
          toast.success("Message sent successfully!");
          onOpenChange(false);
          form.reset();
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to send message",
          );
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact {professional.companyName}</DialogTitle>
          <DialogDescription>
            Send a message to discuss your project.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="don@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="+254..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value="Residential Construction">
                          Residential Construction
                        </SelectItem>
                        <SelectItem value="Commercial Construction">
                          Commercial Construction
                        </SelectItem>
                        <SelectItem value="Renovation">Renovation</SelectItem>
                        <SelectItem value="Interior Design">
                          Interior Design
                        </SelectItem>
                        <SelectItem value="Landscaping">Landscaping</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 500k - 1M" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Location (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Nairobi, Westlands" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your project..."
                      className="min-h-25"
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
                disabled={submitLead.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {submitLead.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Message
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
});

// =============================================================================
// Profile Tabs (Memoized)
// =============================================================================

interface ProfileTabsProps {
  professional: ProfessionalDetailForDisplay;
}

const ProfileTabs = memo(function ProfileTabs({
  professional,
}: ProfileTabsProps) {
  const shouldAnimate = useShouldAnimate();
  const [tabsRef, tabsInView] = useIntersectionObserver();
  const [portfolioRef, portfolioInView] = useIntersectionObserver();
  const [reviewsRef, reviewsInView] = useIntersectionObserver();
  const user = professional.user;

  return (
    <div
      ref={tabsRef as React.RefObject<HTMLDivElement>}
      className={cn(tabsInView && shouldAnimate && "animate-fade-in-up")}
      style={{ animationDelay: "200ms" }}
    >
      <Tabs defaultValue="about" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-100">
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        {/* About Tab */}
        <TabsContent value="about" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Professional Bio</h3>
                <p className="text-slate-600 leading-relaxed">
                  {professional.bio}
                </p>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Services Offered</h3>
                <div className="flex flex-wrap gap-2">
                  {professional.services && professional.services.length > 0 ? (
                    professional.services.map((service, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-sm px-3 py-1"
                      >
                        {service.name ?? ""}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-slate-500">No services listed.</p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Contact Information
                </h3>
                <div className="space-y-3">
                  {user?.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-slate-400" />
                      <span className="text-slate-600">{user.email}</span>
                    </div>
                  )}
                  {user?.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-slate-400" />
                      <span className="text-slate-600">{user.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Portfolio Tab */}
        <TabsContent value="portfolio" className="space-y-6">
          <div
            ref={portfolioRef as React.RefObject<HTMLDivElement>}
            className="grid md:grid-cols-2 gap-6"
          >
            {professional.portfolios && professional.portfolios.length > 0 ? (
              (professional.portfolios as Portfolio[]).map(
                (portfolio, index) => (
                  <PortfolioCard
                    key={portfolio.id}
                    portfolio={portfolio}
                    index={index}
                    shouldAnimate={shouldAnimate}
                    isInView={portfolioInView}
                  />
                ),
              )
            ) : (
              <p className="col-span-full text-center text-slate-600 py-8">
                No portfolio items available yet.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Reviews</CardTitle>
              <CardDescription>
                See what clients have to say about working with{" "}
                {user?.firstName || professional.companyName}
              </CardDescription>
            </CardHeader>
            <CardContent
              ref={reviewsRef as React.RefObject<HTMLDivElement>}
              className="space-y-6"
            >
              {professional.reviews && professional.reviews.length > 0 ? (
                (professional.reviews as ProfessionalReview[]).map(
                  (review, index) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      index={index}
                      isLast={index === professional.reviews!.length - 1}
                      shouldAnimate={shouldAnimate}
                      isInView={reviewsInView}
                    />
                  ),
                )
              ) : (
                <p className="text-center text-slate-600 py-8">
                  No reviews available yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export default function ProfessionalProfilePage() {
  const params = useParams();
  const [isContactOpen, setIsContactOpen] = useState(false);

  const {
    data: professional,
    isLoading: loading,
    error: queryError,
  } = useProfessional(params.id as string);
  const error = queryError?.message ?? null;

  const handleContactOpen = useCallback(() => {
    setIsContactOpen(true);
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!professional) {
    return <ErrorState message="Professional not found" />;
  }

  // Safely access user properties with fallbacks
  const user = professional.user;
  const fullName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      professional.companyName
    : professional.companyName;
  const averageRating =
    professional.reviews && professional.reviews.length > 0
      ? (
          (professional.reviews as { rating?: number }[]).reduce(
            (sum, review) => sum + Number(review.rating ?? 0),
            0,
          ) / professional.reviews.length
        ).toFixed(1)
      : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar variant="light" />

      <main className="max-w-7xl mx-auto px-4 py-12 pt-28">
        {/* Header Section */}
        <ProfileHeader
          professional={professional}
          fullName={fullName ?? ""}
          averageRating={averageRating}
          onContactOpen={handleContactOpen}
        />

        {/* Content Tabs */}
        <ProfileTabs professional={professional} />
      </main>

      {/* Contact Dialog */}
      <ContactDialog
        professional={professional}
        open={isContactOpen}
        onOpenChange={setIsContactOpen}
      />

      <Footer />
    </div>
  );
}
