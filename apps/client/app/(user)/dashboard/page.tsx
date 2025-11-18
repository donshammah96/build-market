"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  Package, 
  MessageSquare, 
  Heart,
  Search,
  ShoppingCart,
  Lightbulb,
  Clock,
  ArrowRight,
  Sparkles
} from "lucide-react";

import { Navbar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  activeProjects: number;
  recentOrders: number;
  unreadMessages: number;
  savedIdeas: number;
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

export default function UserDashboardPage() {
  const { user, isLoaded } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch user stats from various services
    // Mock data for now
    setTimeout(() => {
      setStats({
        activeProjects: 2,
        recentOrders: 3,
        unreadMessages: 5,
        savedIdeas: 12,
      });
      setLoading(false);
    }, 1000);
  }, []);

  const firstName = user?.firstName || user?.username || "there";

  if (!isLoaded || loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
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
      title: "Active Projects",
      value: stats?.activeProjects || 0,
      link: "/projects",
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      trend: "+12%",
      description: "vs last month",
    },
    {
      title: "Recent Orders",
      value: stats?.recentOrders || 0,
      link: "/orders",
      icon: Package,
      color: "text-green-600",
      bgColor: "bg-green-50",
      trend: "+8%",
      description: "vs last month",
    },
    {
      title: "Messages",
      value: stats?.unreadMessages || 0,
      link: "/messages",
      icon: MessageSquare,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      trend: "New",
      description: "unread messages",
    },
    {
      title: "Saved Ideas",
      value: stats?.savedIdeas || 0,
      link: "/inspiration",
      icon: Heart,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      trend: "+4",
      description: "this week",
    },
  ];

  const quickActions = [
    {
      title: "Find Professionals",
      description: "Connect with experts",
      icon: Search,
      href: "/professionals",
      color: "from-emerald-500 to-teal-600",
    },
    {
      title: "Shop Products",
      description: "Browse marketplace",
      icon: ShoppingCart,
      href: "/products",
      color: "from-blue-500 to-indigo-600",
    },
    {
      title: "Browse Ideas",
      description: "Get inspired",
      icon: Lightbulb,
      href: "/inspiration",
      color: "from-amber-500 to-orange-600",
    },
  ];

  const recentActivities = [
    {
      id: 1,
      time: "2 hours ago",
      action: "You messaged Evans Ndegwa: Structural Engineer",
      type: "message",
      avatar: "/avatars/default.png",
    },
    {
      id: 2,
      time: "Yesterday",
      action: "Order #ORD-002 was shipped",
      type: "order",
      avatar: "/avatars/default.png",
    },
    {
      id: 3,
      time: "2 days ago",
      action: "You saved Modern Kitchen Idea",
      type: "save",
      avatar: "/avatars/default.png",
    },
  ];

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
        <div className="container mx-auto px-4 py-12 pt-24">
          {/* Welcome Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-3">
              <motion.div
                animate={{ rotate: [0, 10, -10, 10, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Sparkles className="h-8 w-8 text-emerald-500" />
              </motion.div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-emerald-700 bg-clip-text text-transparent">
                Welcome back, {firstName}!
              </h1>
            </div>
            <p className="text-gray-600 text-lg">Here's what's happening with your projects today.</p>
          </motion.div>

          {/* Stats Grid */}
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
          >
            {statCards.map((card, index) => (
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
              <ArrowRight className="h-6 w-6 text-emerald-500" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md cursor-pointer overflow-hidden">
                      <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                      <CardContent className="pt-6 relative z-10">
                        <div className="flex flex-col items-center text-center space-y-4">
                          <div className={`p-4 rounded-full bg-gradient-to-br ${action.color} text-white shadow-lg group-hover:shadow-xl transition-shadow`}>
                            <action.icon className="h-8 w-8" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg mb-1">{action.title}</h3>
                            <p className="text-sm text-gray-600">{action.description}</p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Clock className="h-6 w-6 text-emerald-500" />
              Recent Activity
            </h2>
            <Card className="border-0 shadow-lg">
              <CardContent className="p-0">
                <div className="divide-y">
                  {recentActivities.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.9 + index * 0.1 }}
                    >
                      <div className="group p-6 hover:bg-emerald-50/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 border-2 border-emerald-100 transition-all group-hover:border-emerald-300">
                            <AvatarImage src={activity.avatar} />
                            <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                              {activity.type === 'message' ? 'M' : activity.type === 'order' ? 'O' : 'S'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 transition-colors group-hover:text-emerald-700">
                              {activity.action}
                            </p>
                            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              {activity.time}
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-300 transition-all group-hover:text-emerald-500 group-hover:translate-x-1" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
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

