"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { 
  Star, 
  Award, 
  Briefcase, 
  Mail, 
  Phone, 
  ExternalLink,
  Calendar,
  CheckCircle,
  MessageSquare
} from "lucide-react";
import { useParams } from "next/navigation";
import { ImageWithFallback } from "../../../app/lib/ImageWithFallback";
import { Button, buttonVariants } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { cn } from "../../../lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Separator } from "../../../components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Navbar } from "../../../components/layout/NavBar";
import { Footer } from "../../../components/layout/Footer";
import { ProfessionalProfile } from "../../../types/professional";

export default function ProfessionalProfilePage() {
  const params = useParams();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  const [professional, setProfessional] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfessional = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/professionals/${params.id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Professional not found');
          }
          throw new Error('Failed to fetch professional');
        }

        const data = await response.json();
        setProfessional(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchProfessional();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading professional profile...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => window.history.back()}>Go Back</Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center">
              <p className="text-slate-600 mb-4">Professional not found</p>
              <Button onClick={() => window.history.back()}>Go Back</Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const fullName = `${professional.user.firstName || ''} ${professional.user.lastName || ''}`.trim() || professional.companyName;
  const averageRating = professional.reviews && professional.reviews.length > 0
    ? (professional.reviews.reduce((sum, review) => sum + review.rating, 0) / professional.reviews.length).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Profile Image */}
                <div className="flex-shrink-0">
                  <Avatar className="h-32 w-32 rounded-lg">
                    <AvatarImage src={professional.portfolios?.[0]?.images[0]} alt={fullName} />
                    <AvatarFallback className="rounded-lg text-3xl">
                      {professional.user.firstName?.[0]}{professional.user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Profile Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-slate-900">{fullName}</h1>
                        {professional.verified && (
                          <div className="bg-blue-600 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm font-medium">
                            <Award className="h-4 w-4" />
                            Verified
                          </div>
                        )}
                      </div>
                      <p className="text-xl text-slate-600 font-medium mb-2">
                        {professional.companyName}
                      </p>
                      {professional.licenseNumber && (
                        <p className="text-sm text-slate-500">
                          License: {professional.licenseNumber}
                        </p>
                      )}
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
                        <p className="font-semibold">{professional.yearsExperience}+ years</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-600">Projects</p>
                        <p className="font-semibold">{professional._count?.projects || 0} completed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-600">Rating</p>
                        <p className="font-semibold">{averageRating || 'N/A'} / 5.0</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    <Button size="lg" className="gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Contact Professional
                    </Button>
                    <Button size="lg" variant="outline" className="gap-2">
                      <Calendar className="h-4 w-4" />
                      Schedule Consultation
                    </Button>
                    {professional.portfolioUrl && professional.portfolioUrl.trim() !== '' && (
                      <a 
                        href={professional.portfolioUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2")}
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
        </motion.div>

        {/* Content Tabs */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Tabs defaultValue="about" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
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
                    <p className="text-slate-600 leading-relaxed">{professional.bio}</p>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Services Offered</h3>
                    <div className="flex flex-wrap gap-2">
                      {professional.servicesOffered.map((service, index) => (
                        <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
                    <div className="space-y-3">
                      {professional.user.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-slate-400" />
                          <span className="text-slate-600">{professional.user.email}</span>
                        </div>
                      )}
                      {professional.user.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-slate-400" />
                          <span className="text-slate-600">{professional.user.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Portfolio Tab */}
            <TabsContent value="portfolio" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {professional.portfolios && professional.portfolios.length > 0 ? (
                  professional.portfolios.map((portfolio, index) => (
                    <motion.div
                      key={portfolio.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
                        <div className="aspect-video overflow-hidden bg-slate-200">
                          <ImageWithFallback
                            src={portfolio.images[0]}
                            alt={portfolio.title}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
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
                                "{portfolio.clientTestimonial}"
                              </p>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    </motion.div>
                  ))
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
                    See what clients have to say about working with {professional.user.firstName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {professional.reviews && professional.reviews.length > 0 ? (
                    professional.reviews.map((review, index) => (
                      <motion.div
                        key={review.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                      >
                        <div className="flex gap-4">
                          <Avatar>
                            <AvatarFallback>
                              {review.reviewer.firstName?.[0]}{review.reviewer.lastName?.[0]}
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
                            {review.comment && (
                              <p className="text-slate-600">{review.comment}</p>
                            )}
                          </div>
                        </div>
                        {index < professional.reviews!.length - 1 && (
                          <Separator className="mt-6" />
                        )}
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-center text-slate-600 py-8">
                      No reviews available yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}

