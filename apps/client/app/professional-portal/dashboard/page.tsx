"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Star,
  Calendar,
  Briefcase,
  DollarSign,
  Eye,
  Settings,
  ArrowRight,
  Sparkles,
  Clock,
  Award,
  FileText,
  Bell
} from "lucide-react";

import { Navbar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface ProfessionalStats {
  activeLeads: number;
  activeProjects: number;
  totalEarnings: number;
  profileViews: number;
  averageRating: number;
  totalReviews: number;
  unreadMessages: number;
  upcomingAppointments: number;
}

interface Lead {
  id: number;
  clientName: string;
  projectType: string;
  budget: string;
  status: 'new' | 'contacted' | 'in-progress';
  timeAgo: string;
  avatar?: string;
}

interface Appointment {
  id: number;
  clientName: string;
  type: string;
  date: string;
  time: string;
  status: 'upcoming' | 'confirmed' | 'pending';
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function ProfessionalDashboardPage() {
  const { user, isLoaded } = useUser();
  const [stats, setStats] = useState<ProfessionalStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch professional stats from API
    // Mock data for now
    setTimeout(() => {
      setStats({
        activeLeads: 12,
        activeProjects: 5,
        totalEarnings: 48500,
        profileViews: 234,
        averageRating: 4.8,
        totalReviews: 27,
        unreadMessages: 8,
        upcomingAppointments: 3,
      });

      setRecentLeads([
        {
          id: 1,
          clientName: "Sarah Johnson",
          projectType: "Kitchen Renovation",
          budget: "$15,000 - $25,000",
          status: "new",
          timeAgo: "5 minutes ago",
        },
        {
          id: 2,
          clientName: "Michael Chen",
          projectType: "Bathroom Remodel",
          budget: "$8,000 - $12,000",
          status: "contacted",
          timeAgo: "2 hours ago",
        },
        {
          id: 3,
          clientName: "Emma Davis",
          projectType: "Home Addition",
          budget: "$50,000+",
          status: "in-progress",
          timeAgo: "1 day ago",
        },
      ]);

      setUpcomingAppointments([
        {
          id: 1,
          clientName: "John Williams",
          type: "Site Consultation",
          date: "Today",
          time: "2:00 PM",
          status: "confirmed",
        },
        {
          id: 2,
          clientName: "Lisa Anderson",
          type: "Project Discussion",
          date: "Tomorrow",
          time: "10:30 AM",
          status: "upcoming",
        },
        {
          id: 3,
          clientName: "David Martinez",
          type: "Follow-up Meeting",
          date: "Nov 20",
          time: "3:00 PM",
          status: "pending",
        },
      ]);

      setLoading(false);
    }, 1000);
  }, []);

  const firstName = user?.firstName || user?.username || "Professional";

  if (!isLoaded || loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
          <div className="container mx-auto px-4 py-12 pt-24">
            <div className="space-y-8">
              <div className="space-y-2">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-6 w-96" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-40" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const statCards = [
    {
      title: "Active Leads",
      value: stats?.activeLeads || 0,
      link: "/leads",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      trend: "+3 new",
      description: "this week",
    },
    {
      title: "Active Projects",
      value: stats?.activeProjects || 0,
      link: "/projects",
      icon: Briefcase,
      color: "text-green-600",
      bgColor: "bg-green-50",
      trend: "2 ending soon",
      description: "manage deadlines",
    },
    {
      title: "Total Earnings",
      value: `$${(stats?.totalEarnings || 0).toLocaleString()}`,
      link: "/settings",
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      trend: "+15%",
      description: "vs last month",
    },
    {
      title: "Profile Views",
      value: stats?.profileViews || 0,
      link: "/portfolio",
      icon: Eye,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      trend: "+23",
      description: "this week",
    },
  ];

  const quickActions = [
    {
      title: "View Leads",
      description: "Respond to inquiries",
      icon: Users,
      href: "/leads",
      color: "from-blue-500 to-indigo-600",
      badge: stats?.activeLeads,
    },
    {
      title: "My Calendar",
      description: "Check appointments",
      icon: Calendar,
      href: "/calendar",
      color: "from-purple-500 to-pink-600",
      badge: stats?.upcomingAppointments,
    },
    {
      title: "Portfolio",
      description: "Update your work",
      icon: Award,
      href: "/portfolio",
      color: "from-amber-500 to-orange-600",
    },
    {
      title: "Messages",
      description: "Client communications",
      icon: MessageSquare,
      href: "/messages",
      color: "from-teal-500 to-cyan-600",
      badge: stats?.unreadMessages,
    },
  ];

  const getLeadStatusColor = (status: Lead['status']) => {
    switch (status) {
      case 'new':
        return 'bg-green-100 text-green-800';
      case 'contacted':
        return 'bg-blue-100 text-blue-800';
      case 'in-progress':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAppointmentStatusColor = (status: Appointment['status']) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="container mx-auto px-4 py-12 pt-24">
          {/* Welcome Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 10, 0] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <Sparkles className="h-8 w-8 text-blue-500" />
                </motion.div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-blue-700 bg-clip-text text-transparent">
                  Welcome back, {firstName}!
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border">
                  <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                  <span className="font-bold text-lg">{stats?.averageRating}</span>
                  <span className="text-gray-500 text-sm">({stats?.totalReviews} reviews)</span>
                </div>
              </div>
            </div>
            <p className="text-gray-600 text-lg">Manage your business and grow your client base.</p>
          </motion.div>

          {/* Stats Grid */}
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
          >
            {statCards.map((card) => (
              <motion.div key={card.title} variants={item}>
                <Link href={card.link}>
                  <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md hover:scale-105 cursor-pointer overflow-hidden relative">
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                    <CardHeader className="relative z-10">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-gray-600">
                          {card.title}
                        </CardTitle>
                        <div className={`p-2 rounded-lg ${card.bgColor}`}>
                          <card.icon className={`h-5 w-5 ${card.color}`} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <div className="text-3xl font-bold mb-2">{card.value}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {card.trend}
                        </Badge>
                        <span className="text-xs text-gray-500">{card.description}</span>
                      </div>
                      <Progress value={65} className="mt-3 h-1" />
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-12"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <ArrowRight className="h-6 w-6 text-blue-500" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {quickActions.map((action, index) => (
                <motion.div
                  key={action.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link href={action.href}>
                    <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md cursor-pointer overflow-hidden relative">
                      <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                      <CardContent className="pt-6 relative z-10">
                        <div className="flex flex-col items-center text-center space-y-4">
                          <div className="relative">
                            <div className={`p-4 rounded-full bg-gradient-to-br ${action.color} text-white shadow-lg group-hover:shadow-xl transition-shadow`}>
                              <action.icon className="h-8 w-8" />
                            </div>
                            {action.badge && action.badge > 0 && (
                              <Badge className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 bg-red-500 text-white border-2 border-white">
                                {action.badge}
                              </Badge>
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg mb-1">{action.title}</h3>
                            <p className="text-sm text-gray-600">{action.description}</p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Leads */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Users className="h-6 w-6 text-blue-500" />
                  Recent Leads
                </h2>
                <Link href="/leads">
                  <Button variant="ghost" size="sm" className="group">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-0">
                  <div className="divide-y">
                    {recentLeads.map((lead, index) => (
                      <motion.div
                        key={lead.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.9 + index * 0.1 }}
                      >
                        <div className="group p-6 hover:bg-blue-50/50 transition-colors cursor-pointer">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-12 w-12 border-2 border-blue-100 transition-all group-hover:border-blue-300">
                              <AvatarImage src={lead.avatar} />
                              <AvatarFallback className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
                                {lead.clientName.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <p className="font-semibold text-gray-900 transition-colors group-hover:text-blue-700">
                                    {lead.clientName}
                                  </p>
                                  <p className="text-sm text-gray-600">{lead.projectType}</p>
                                </div>
                                <Badge className={getLeadStatusColor(lead.status)}>
                                  {lead.status.replace('-', ' ')}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium text-emerald-600 mb-1">{lead.budget}</p>
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {lead.timeAgo}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Upcoming Appointments */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-blue-500" />
                  Upcoming Appointments
                </h2>
                <Link href="/calendar">
                  <Button variant="ghost" size="sm" className="group">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-0">
                  <div className="divide-y">
                    {upcomingAppointments.map((appointment, index) => (
                      <motion.div
                        key={appointment.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.1 + index * 0.1 }}
                      >
                        <div className="group p-6 hover:bg-purple-50/50 transition-colors cursor-pointer">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg">
                              <Calendar className="h-6 w-6 text-purple-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <p className="font-semibold text-gray-900 transition-colors group-hover:text-purple-700">
                                    {appointment.clientName}
                                  </p>
                                  <p className="text-sm text-gray-600">{appointment.type}</p>
                                </div>
                                <Badge className={getAppointmentStatusColor(appointment.status)}>
                                  {appointment.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                <span className="font-medium text-gray-700">{appointment.date}</span>
                                <span className="text-gray-500">•</span>
                                <span className="text-gray-600">{appointment.time}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Performance Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-8"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-blue-500" />
              Performance Summary
            </h2>
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-50 rounded-lg">
                      <Star className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.averageRating}</p>
                      <p className="text-sm text-gray-600">Average Rating</p>
                      <Progress value={(stats?.averageRating || 0) * 20} className="mt-2 h-2" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <FileText className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalReviews}</p>
                      <p className="text-sm text-gray-600">Total Reviews</p>
                      <Progress value={Math.min((stats?.totalReviews || 0) * 2, 100)} className="mt-2 h-2" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Award className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">92%</p>
                      <p className="text-sm text-gray-600">Response Rate</p>
                      <Progress value={92} className="mt-2 h-2" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      <Footer />
    </>
  );
}

