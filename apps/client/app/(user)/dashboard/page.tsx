"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";

import { 
  Plus, 
  MessageSquare, 
  Clock, 
  Calendar, 
  MoreHorizontal,
  Search,
  LayoutTemplate,
  ShoppingBag
} from "lucide-react";

import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileCompletionBanner } from "@/components/shared/ProfileCompletionBanner";
import { useProfileStatus } from "@/hooks/useProfileStatus";
import { cn } from "@/lib/utils";
import { ROUTES, getProjectUrl, getIdeaBookUrl } from "@/lib/links";

// --- Types based on your Prisma Schema ---
// (In a real app, import these from your types definition)

interface ProjectMock {
  id: string;
  title: string;
  status: 'planning' | 'in_progress' | 'completed';
  nextMilestone: string;
  dueDate: string;
  progress: number;
  image: string;
  professional?: {
    name: string;
    role: string;
    avatar: string;
  };
}

interface IdeaBookMock {
  id: string;
  title: string;
  itemCount: number;
  previewImage: string;
}

interface ActivityMock {
  id: string;
  type: 'message' | 'order' | 'milestone';
  content: string;
  meta: string;
  time: string;
  image?: string;
}

export default function UserDashboardPage() {
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  
  // Profile completion status
  const { completion, isLoading: profileLoading } = useProfileStatus();
  
  // Mock Data State
  const [activeProject, setActiveProject] = useState<ProjectMock | null>(null);
  const [ideaBooks, setIdeaBooks] = useState<IdeaBookMock[]>([]);
  const [activities, setActivities] = useState<ActivityMock[]>([]);

  useEffect(() => {
    // Simulate API fetch
    const timer = setTimeout(() => {
      // MOCK: Active Project Data
      setActiveProject({
        id: "proj_1",
        title: "Kileleshwa Kitchen Renovation",
        status: "in_progress",
        nextMilestone: "Cabinet Installation",
        dueDate: "Oct 24",
        progress: 65,
        image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80",
        professional: {
          name: "Evans Ndegwa",
          role: "Lead Contractor",
          avatar: "https://i.pravatar.cc/150?u=evans"
        }
      });

      // MOCK: Idea Books
      setIdeaBooks([
        { id: "ib_1", title: "Modern Living Rooms", itemCount: 12, previewImage: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=400&q=80" },
        { id: "ib_2", title: "Garden Landscapes", itemCount: 8, previewImage: "https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=400&q=80" },
        { id: "ib_3", title: "Master Bath", itemCount: 24, previewImage: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=400&q=80" },
      ]);

      // MOCK: Recent Activity
      setActivities([
        { id: "act_1", type: "message", content: "New message from Evans Ndegwa", meta: "Regarding: Tile selection", time: "10m ago", image: "https://i.pravatar.cc/150?u=evans" },
        { id: "act_2", type: "order", content: "Order #2939 Shipped", meta: "Ceramic Floor Tiles - 50 Boxes", time: "2h ago" },
        { id: "act_3", type: "milestone", content: "Milestone Completed", meta: "Demolition Phase", time: "1d ago" },
      ]);

      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const firstName = user?.firstName || "there";

  if (!isLoaded || loading) return <DashboardSkeleton />;

  return (
    <div className="min-h-screen bg-zinc-50/50">
      <ClientNavbar />
      
      <main className="container mx-auto px-4 md:px-8 py-8 pt-24 max-w-7xl">
        
        {/* Profile Completion Banner */}
        {!profileLoading && completion && !completion.isComplete && (
          <ProfileCompletionBanner 
            percentage={completion.percentage}
            missingFields={completion.missingRequiredLabels || []}
            profileType="client"
          />
        )}
        
        {/* --- Header Section --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">
              Good afternoon, {firstName}.
            </h1>
            <p className="text-zinc-500 mt-2 text-lg">
              You have <span className="text-emerald-600 font-medium">2 upcoming tasks</span> for your renovation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-12 px-6 border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50">
              <Search className="mr-2 h-4 w-4" /> Find Pros
            </Button>
            <Button className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* --- LEFT COLUMN (Main Content) --- */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* 1. Active Project Hero Card */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-zinc-900">Current Project</h2>
                <Link href={ROUTES.userProjects} className="text-sm font-medium text-emerald-600 hover:underline">
                  View all projects
                </Link>
              </div>
              
              {activeProject ? (
                <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                  <div className="grid grid-cols-1 md:grid-cols-5 min-h-[280px]">
                    {/* Image Side */}
                    <div className="md:col-span-2 relative h-64 md:h-full bg-zinc-100">
                      <Image 
                        src={activeProject.image} 
                        alt={activeProject.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-white/90 text-zinc-900 hover:bg-white backdrop-blur-sm border-0">
                          {activeProject.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>

                    {/* Content Side */}
                    <div className="md:col-span-3 p-6 md:p-8 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-2xl font-bold text-zinc-900 leading-tight">
                            {activeProject.title}
                          </h3>
                          <Button variant="ghost" size="icon" className="text-zinc-400">
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </div>

                        <div className="space-y-6">
                          {/* Progress */}
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-zinc-500 font-medium">Overall Progress</span>
                              <span className="text-zinc-900 font-bold">{activeProject.progress}%</span>
                            </div>
                            <Progress value={activeProject.progress} className="h-2 bg-zinc-100" indicatorClassName="bg-emerald-600" />
                          </div>

                          {/* Milestone */}
                          <div className="flex items-start gap-4 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                            <div className="bg-white p-2.5 rounded-lg shadow-sm text-emerald-600">
                              <Calendar className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">
                                Up Next
                              </p>
                              <p className="font-semibold text-zinc-900">
                                {activeProject.nextMilestone}
                              </p>
                              <p className="text-sm text-zinc-500">
                                Due: {activeProject.dueDate}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer: Professional Team */}
                      <div className="mt-8 pt-6 border-t border-zinc-100 flex items-center justify-between">
                        {activeProject.professional && (
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                              <AvatarImage src={activeProject.professional.avatar} />
                              <AvatarFallback>EN</AvatarFallback>
                            </Avatar>
                            <div className="text-sm">
                              <p className="font-medium text-zinc-900">{activeProject.professional.name}</p>
                              <p className="text-zinc-500 text-xs">{activeProject.professional.role}</p>
                            </div>
                          </div>
                        )}
                        <Button variant="outline" size="sm" className="ml-auto" asChild>
                          <Link href={getProjectUrl(activeProject.id)}>
                            Manage Project
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState />
              )}
            </section>

            {/* 2. Idea Books Grid */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-zinc-900">Your Idea Books</h2>
                <Link href={ROUTES.ideaBooks} className="text-sm font-medium text-emerald-600 hover:underline">
                  View all
                </Link>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {ideaBooks.map((book) => (
                  <Link href={getIdeaBookUrl(book.id)} key={book.id}>
                    <div className="group cursor-pointer">
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-3 bg-zinc-100">
                        <Image 
                          src={book.previewImage} 
                          alt={book.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white px-2 py-1 rounded text-xs font-medium">
                          {book.itemCount} Items
                        </div>
                      </div>
                      <h3 className="font-semibold text-zinc-900 group-hover:text-emerald-600 transition-colors">
                        {book.title}
                      </h3>
                      <p className="text-sm text-zinc-500">Last updated 2 days ago</p>
                    </div>
                  </Link>
                ))}
                
                {/* Add New Idea Book Card */}
                <button className="flex flex-col items-center justify-center aspect-[4/3] rounded-xl border-2 border-dashed border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group">
                  <div className="h-10 w-10 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center mb-3 group-hover:bg-white group-hover:text-emerald-600 group-hover:shadow-sm">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="font-medium text-zinc-600 group-hover:text-emerald-700">Create New Board</span>
                </button>
              </div>
            </section>

          </div>

          {/* --- RIGHT COLUMN (Sidebar) --- */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* 3. Quick Navigation Card */}
            <Card className="border-zinc-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Marketplace</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <QuickLink 
                  icon={<LayoutTemplate className="h-4 w-4" />} 
                  label="Browse Professionals" 
                  href={ROUTES.findProfessional} 
                  count="2k+"
                />
                <QuickLink 
                  icon={<ShoppingBag className="h-4 w-4" />} 
                  label="Shop Materials" 
                  href={ROUTES.products}
                  count="New"
                  badgeColor="bg-blue-100 text-blue-700"
                />
                <QuickLink 
                  icon={<MessageSquare className="h-4 w-4" />} 
                  label="Messages" 
                  href={ROUTES.userMessages} 
                  count="5"
                  badgeColor="bg-emerald-100 text-emerald-700"
                />
              </CardContent>
            </Card>

            {/* 4. Recent Activity Timeline */}
            <Card className="border-zinc-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative pl-4 border-l border-zinc-200 space-y-8">
                  {activities.map((activity) => (
                    <div key={activity.id} className="relative">
                      {/* Timeline Dot */}
                      <div className={cn(
                        "absolute -left-[21px] top-0 h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm",
                        activity.type === 'message' ? "bg-blue-500" : 
                        activity.type === 'order' ? "bg-amber-500" : "bg-emerald-500"
                      )} />
                      
                      <div className="flex gap-3">
                         {activity.image && (
                            <Avatar className="h-8 w-8 mt-1">
                                <AvatarImage src={activity.image} />
                                <AvatarFallback>U</AvatarFallback>
                            </Avatar>
                         )}
                         <div>
                            <p className="text-sm font-medium text-zinc-900">{activity.content}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">{activity.meta}</p>
                            <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {activity.time}
                            </p>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 5. Trust Banner */}
            <div className="bg-emerald-900 rounded-xl p-6 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl -mr-16 -mt-16" />
               <h4 className="font-semibold text-lg mb-2 relative z-10">Verified Pros Only</h4>
               <p className="text-emerald-100 text-sm mb-4 relative z-10 leading-relaxed">
                  Every contractor on Build Market is vetted for NCA compliance.
               </p>
               <Button variant="outline" size="sm" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white border-0 backdrop-blur-sm relative z-10">
                  Read our Promise
               </Button>
            </div>
            
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// --- Sub-Components ---

function QuickLink({ icon, label, href, count, badgeColor = "bg-zinc-100 text-zinc-600" }: { icon: React.ReactNode, label: string, href: string, count?: string, badgeColor?: string }) {
  return (
    <Link 
      href={href} 
      className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50 transition-colors group"
    >
      <div className="flex items-center gap-3 text-zinc-600 group-hover:text-emerald-700">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      {count && (
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", badgeColor)}>
          {count}
        </span>
      )}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-zinc-200 p-8 flex flex-col items-center justify-center text-center">
      <div className="h-12 w-12 rounded-full bg-zinc-50 flex items-center justify-center mb-4">
        <LayoutTemplate className="h-6 w-6 text-zinc-300" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-900">No active projects</h3>
      <p className="text-zinc-500 max-w-sm mt-1 mb-6">
        Ready to start building? Find a verified professional to kickstart your dream home.
      </p>
      <Button>Find a Pro</Button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50/50">
      <ClientNavbar />
      <div className="container mx-auto px-4 py-8 pt-24 max-w-7xl">
         <div className="space-y-4 mb-10">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-96" />
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
               <Skeleton className="h-[300px] w-full rounded-2xl" />
               <div className="grid grid-cols-3 gap-6">
                  <Skeleton className="h-40 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full rounded-xl" />
               </div>
            </div>
            <div className="lg:col-span-4 space-y-8">
               <Skeleton className="h-64 w-full rounded-xl" />
               <Skeleton className="h-64 w-full rounded-xl" />
            </div>
         </div>
      </div>
    </div>
  );
}