"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  Star,
  MessageSquare,
  Settings,
  User,
  TrendingUp,
  Calendar,
  Plus,
  DollarSign,
  Eye,
  CheckCircle,
  Clock,
  Users,
  Award,
  BarChart3,
  FileText,
} from "lucide-react";
import { Navbar } from "../../components/layout/NavBar";
import { Footer } from "../../components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Progress } from "../../components/ui/progress";
import Link from "next/link";

// Mock data for demonstration
const mockProfessionalData = {
  user: {
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@example.com",
    phone: "+1 (555) 123-4567",
  },
  profile: {
    companyName: "Smith Structural Engineering",
    licenseNumber: "SE-12345",
    yearsExperience: 10,
    verified: true,
    servicesOffered: [
      "Structural Engineering",
      "Civil Engineering",
      "Building Design",
      "Structural Analysis",
    ],
    bio: "Licensed structural engineer with 10 years of experience in residential, commercial, and industrial building projects.",
  },
  projects: [
    {
      id: "1",
      title: "Downtown Office Complex",
      client: "ABC Corporation",
      status: "in_progress",
      progress: 65,
      budget: 150000,
      earnings: 97500,
      startDate: "2024-08-15",
      deadline: "2024-12-30",
      nextMilestone: "Structural drawings approval",
    },
    {
      id: "2",
      title: "Residential Home Addition",
      client: "Jane Doe",
      status: "in_progress",
      progress: 40,
      budget: 45000,
      earnings: 18000,
      startDate: "2024-10-01",
      deadline: "2025-01-15",
      nextMilestone: "Foundation inspection",
    },
    {
      id: "3",
      title: "Warehouse Retrofit",
      client: "XYZ Logistics",
      status: "completed",
      progress: 100,
      budget: 85000,
      earnings: 85000,
      startDate: "2024-05-10",
      deadline: "2024-09-20",
      nextMilestone: null,
    },
    {
      id: "4",
      title: "School Building Assessment",
      client: "City School District",
      status: "planning",
      progress: 15,
      budget: 65000,
      earnings: 0,
      startDate: "2024-11-15",
      deadline: "2025-03-30",
      nextMilestone: "Site survey scheduled",
    },
  ],
  inquiries: [
    {
      id: "1",
      clientName: "Michael Brown",
      projectType: "Commercial Building",
      message: "Need structural engineering for a 3-story office building...",
      budget: "$80,000 - $120,000",
      date: "2024-10-28",
      status: "new",
    },
    {
      id: "2",
      clientName: "Sarah Wilson",
      projectType: "Residential",
      message: "Looking for help with home foundation issues...",
      budget: "$20,000 - $35,000",
      date: "2024-10-27",
      status: "responded",
    },
    {
      id: "3",
      clientName: "Tech Startup Inc",
      projectType: "Office Renovation",
      message: "Need structural assessment for office space renovation...",
      budget: "$50,000 - $75,000",
      date: "2024-10-25",
      status: "new",
    },
  ],
  reviews: [
    {
      id: "1",
      clientName: "Jane Doe",
      rating: 5,
      comment: "Excellent work! John was professional, thorough, and delivered ahead of schedule.",
      date: "2024-10-15",
      project: "Kitchen Renovation",
    },
    {
      id: "2",
      clientName: "Robert Johnson",
      rating: 5,
      comment: "Very knowledgeable and great communication throughout the project.",
      date: "2024-09-28",
      project: "Warehouse Retrofit",
    },
    {
      id: "3",
      clientName: "Amy Chen",
      rating: 4,
      comment: "Good work overall. Would have appreciated more frequent updates.",
      date: "2024-09-10",
      project: "Home Addition",
    },
  ],
  stats: {
    activeProjects: 2,
    completedProjects: 15,
    totalEarnings: 487500,
    averageRating: 4.8,
    totalReviews: 24,
    profileViews: 342,
    newInquiries: 3,
    responseRate: 95,
  },
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "planning":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4" />;
    case "in_progress":
      return <TrendingUp className="h-4 w-4" />;
    case "planning":
      return <Clock className="h-4 w-4" />;
    default:
      return null;
  }
};

const getInquiryStatusColor = (status: string) => {
  switch (status) {
    case "new":
      return "bg-blue-100 text-blue-800";
    case "responded":
      return "bg-green-100 text-green-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
};

export default function ProfessionalDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const professional = mockProfessionalData;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">
                Welcome back, {professional.user.firstName}!
              </h1>
              <p className="text-lg text-slate-600">
                {professional.profile.companyName}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/professional/profile">
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Profile
                </Link>
              </Button>
              <Button asChild>
                <Link href="/professional/portfolio">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Portfolio
                </Link>
              </Button>
            </div>
          </div>

          {/* Verification Badge */}
          {professional.profile.verified && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium"
            >
              <Award className="h-4 w-4" />
              Verified Professional
            </motion.div>
          )}
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Active Projects</p>
                  <p className="text-3xl font-bold">{professional.stats.activeProjects}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {professional.stats.completedProjects} completed
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Earnings</p>
                  <p className="text-3xl font-bold">
                    ${(professional.stats.totalEarnings / 1000).toFixed(0)}k
                  </p>
                  <p className="text-xs text-green-600 mt-1">+12% this month</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Average Rating</p>
                  <p className="text-3xl font-bold">{professional.stats.averageRating}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {professional.stats.totalReviews} reviews
                  </p>
                </div>
                <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <Star className="h-6 w-6 text-amber-600 fill-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">New Inquiries</p>
                  <p className="text-3xl font-bold">{professional.stats.newInquiries}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {professional.stats.profileViews} profile views
                  </p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Active Projects */}
                <Card>
                  <CardHeader>
                    <CardTitle>Active Projects</CardTitle>
                    <CardDescription>Projects currently in progress</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {professional.projects
                      .filter((p) => p.status === "in_progress")
                      .map((project) => (
                        <motion.div
                          key={project.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold">{project.title}</h4>
                              <p className="text-sm text-slate-600">{project.client}</p>
                            </div>
                            <Badge className={getStatusColor(project.status)}>
                              {getStatusIcon(project.status)}
                              <span className="ml-1 capitalize">
                                {project.status.replace("_", " ")}
                              </span>
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Progress</span>
                              <span className="font-medium">{project.progress}%</span>
                            </div>
                            <Progress value={project.progress} className="h-2" />
                          </div>
                          {project.nextMilestone && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Calendar className="h-4 w-4" />
                              <span>Next: {project.nextMilestone}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm pt-2 border-t">
                            <span className="text-slate-600">Earnings</span>
                            <span className="font-semibold text-green-600">
                              ${project.earnings.toLocaleString()}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    <Button variant="outline" className="w-full">
                      View All Projects
                    </Button>
                  </CardContent>
                </Card>

                {/* Recent Inquiries */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Inquiries</CardTitle>
                    <CardDescription>New client requests</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {professional.inquiries.slice(0, 3).map((inquiry, index) => (
                      <motion.div
                        key={inquiry.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>
                                {inquiry.clientName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="font-semibold">{inquiry.clientName}</h4>
                              <p className="text-sm text-slate-600">{inquiry.projectType}</p>
                            </div>
                          </div>
                          <Badge className={getInquiryStatusColor(inquiry.status)}>
                            {inquiry.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {inquiry.message}
                        </p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{inquiry.budget}</span>
                          <span className="text-xs text-slate-500">{inquiry.date}</span>
                        </div>
                        {inquiry.status === "new" && (
                          <Button size="sm" className="w-full">
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Respond
                          </Button>
                        )}
                      </motion.div>
                    ))}
                    <Button variant="outline" className="w-full">
                      View All Inquiries
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>Your professional statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Eye className="h-4 w-4" />
                        <span className="text-sm">Profile Views</span>
                      </div>
                      <p className="text-2xl font-bold">{professional.stats.profileViews}</p>
                      <Progress value={68} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-600">
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-sm">Response Rate</span>
                      </div>
                      <p className="text-2xl font-bold">{professional.stats.responseRate}%</p>
                      <Progress value={professional.stats.responseRate} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Star className="h-4 w-4" />
                        <span className="text-sm">Avg Rating</span>
                      </div>
                      <p className="text-2xl font-bold">{professional.stats.averageRating}</p>
                      <Progress value={(professional.stats.averageRating / 5) * 100} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Completion Rate</span>
                      </div>
                      <p className="text-2xl font-bold">98%</p>
                      <Progress value={98} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Projects Tab */}
            <TabsContent value="projects" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>All Projects</CardTitle>
                      <CardDescription>Manage your project portfolio</CardDescription>
                    </div>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New Project
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {professional.projects.map((project, index) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="border rounded-lg p-6 space-y-4 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold">{project.title}</h3>
                            <Badge className={getStatusColor(project.status)}>
                              {getStatusIcon(project.status)}
                              <span className="ml-1 capitalize">
                                {project.status.replace("_", " ")}
                              </span>
                            </Badge>
                          </div>
                          <p className="text-slate-600">Client: {project.client}</p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Budget</p>
                          <p className="font-semibold">${project.budget.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Earnings</p>
                          <p className="font-semibold text-green-600">
                            ${project.earnings.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Start Date</p>
                          <p className="font-semibold">
                            {new Date(project.startDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Deadline</p>
                          <p className="font-semibold">
                            {new Date(project.deadline).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Progress</span>
                          <span className="font-medium">{project.progress}%</span>
                        </div>
                        <Progress value={project.progress} className="h-2" />
                      </div>

                      {project.nextMilestone && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 pt-2 border-t">
                          <Calendar className="h-4 w-4" />
                          <span>Next Milestone: {project.nextMilestone}</span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 border-t">
                        <Button size="sm" variant="outline" className="flex-1">
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Contact Client
                        </Button>
                        <Button size="sm" className="flex-1">
                          View Details
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Inquiries Tab */}
            <TabsContent value="inquiries" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Client Inquiries</CardTitle>
                  <CardDescription>Manage incoming project requests</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {professional.inquiries.map((inquiry, index) => (
                    <motion.div
                      key={inquiry.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="border rounded-lg p-6 space-y-4 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="text-lg">
                              {inquiry.clientName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="text-lg font-semibold">{inquiry.clientName}</h3>
                            <p className="text-sm text-slate-600">{inquiry.projectType}</p>
                            <p className="text-xs text-slate-500">{inquiry.date}</p>
                          </div>
                        </div>
                        <Badge className={getInquiryStatusColor(inquiry.status)}>
                          {inquiry.status}
                        </Badge>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-lg">
                        <p className="text-slate-700">{inquiry.message}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-600">Budget Range</p>
                          <p className="font-semibold">{inquiry.budget}</p>
                        </div>
                        <div className="flex gap-2">
                          {inquiry.status === "new" ? (
                            <>
                              <Button variant="outline" size="sm">
                                Decline
                              </Button>
                              <Button size="sm">
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Respond
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm">
                              View Conversation
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Client Reviews</CardTitle>
                      <CardDescription>
                        Your professional reputation - {professional.stats.averageRating} average
                        rating from {professional.stats.totalReviews} reviews
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg">
                      <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                      <span className="text-2xl font-bold">
                        {professional.stats.averageRating}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {professional.reviews.map((review, index) => (
                    <motion.div
                      key={review.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="border rounded-lg p-6 space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="text-lg">
                              {review.clientName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold">{review.clientName}</h4>
                            <p className="text-sm text-slate-600">{review.project}</p>
                            <p className="text-xs text-slate-500">{review.date}</p>
                          </div>
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
                      <p className="text-slate-700">{review.comment}</p>
                    </motion.div>
                  ))}
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

