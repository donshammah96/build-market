"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  Users, 
  Briefcase, 
  DollarSign, 
  Star,
  Clock,
  ArrowUpRight,
  MoreHorizontal,
  Phone,
  MessageSquare,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronRight
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// --- Types ---
interface Lead {
  id: string;
  name: string;
  project: string;
  budget: string;
  location: string;
  status: 'new' | 'contacted' | 'proposal';
  received: string;
  avatar: string;
}

export default function ProfessionalDashboardPage() {
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);

  // Fetch Agenda (Today's Events)
  const { data: events } = useQuery({
    queryKey: ["dashboard-agenda"],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      
      const res = await fetch(`/api/professional-portal/calendar?start=${start.toISOString()}&end=${end.toISOString()}`);
      if (!res.ok) throw new Error("Failed to fetch agenda");
      return res.json();
    },
  });

  useEffect(() => {
    // Simulate API Fetch
    setTimeout(() => {
      setLeads([
        { id: "1", name: "Ron Shallom", project: "Kitchen Renovation", budget: "KSh 1.2M", location: "Kileleshwa", status: 'new', received: "2h ago", avatar: "https://i.pravatar.cc/150?u=1" },
        { id: "2", name: "Gabby Makush", project: "Landscape Design", budget: "KSh 300k", location: "Karen", status: 'contacted', received: "5h ago", avatar: "https://i.pravatar.cc/150?u=2" },
        { id: "3", name: "Pam Mwende", project: "Master Bath", budget: "KSh 500k", location: "Westlands", status: 'proposal', received: "1d ago", avatar: "https://i.pravatar.cc/150?u=3" },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  if (!isLoaded || loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto pb-10">
      
      {/* --- Header: Clean & Minimalist --- */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-zinc-100">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Overview</h1>
          <p className="text-zinc-500 mt-2 text-sm max-w-md leading-relaxed">
            Welcome back. You have <span className="text-zinc-900 font-medium">3 active projects</span> and <span className="text-zinc-900 font-medium">2 new leads</span> requiring attention today.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 bg-white shadow-sm" asChild>
            <Link href="/professional-portal/calendar">
                <Calendar className="mr-2 h-4 w-4" /> Schedule
            </Link>
          </Button>
          <Button className="bg-zinc-900 hover:bg-zinc-800 text-white shadow-md transition-all hover:shadow-lg">
            <ArrowUpRight className="mr-2 h-4 w-4" /> Promote Profile
          </Button>
        </div>
      </div>

      {/* --- Section 1: Financial & Operational Vitals --- */}
      {/* Design Note: Removed the "Rainbow" colors. Used Zinc/Emerald for a financial look. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <MetricCard 
            title="Total Revenue" 
            value="KSh 4.2M" 
            trend="+12%" 
            icon={DollarSign} 
            chart={[40, 60, 55, 70, 65, 80, 85]}
         />
         <MetricCard 
            title="Active Leads" 
            value="14" 
            trend="+3 this week" 
            icon={Users} 
            chart={[20, 25, 30, 25, 35, 40, 45]}
         />
         <MetricCard 
            title="Projects" 
            value="6" 
            trend="On Schedule" 
            icon={Briefcase} 
            chart={[50, 50, 50, 60, 60, 60, 60]}
         />
         <MetricCard 
            title="Client Rating" 
            value="4.9" 
            trend="Top Rated" 
            icon={Star} 
            chart={[90, 92, 95, 95, 98, 98, 98]}
         />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* --- Section 2: Priority Workflow (Leads) --- */}
        <div className="xl:col-span-2 space-y-8">
          
          <Card className="border border-zinc-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="border-b border-zinc-100 py-5 px-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-zinc-900">Recent Inquiries</CardTitle>
                <div className="h-5 px-2 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center">
                  3 NEW
                </div>
              </div>
              <Link href="/professional-portal/leads" className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 group">
                View Pipeline <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </CardHeader>
            
            <div className="divide-y divide-zinc-100">
               {leads.map((lead) => (
                 <div key={lead.id} className="p-6 hover:bg-zinc-50/50 transition-colors group flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                    
                    <Avatar className="h-12 w-12 border border-zinc-100 shadow-sm">
                      <AvatarImage src={lead.avatar} />
                      <AvatarFallback className="bg-zinc-100 text-zinc-500 font-medium">CL</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-zinc-900">{lead.name}</h4>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {lead.received}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600">{lead.project} <span className="text-zinc-300 mx-1">•</span> {lead.location}</p>
                      <div className="flex items-center gap-3 pt-1">
                         <span className="text-xs font-medium text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                            {lead.budget}
                         </span>
                         {lead.status === 'new' && (
                           <span className="flex h-2 w-2 relative">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                           </span>
                         )}
                      </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto pt-2 sm:pt-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200">
                       <Button size="sm" className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white h-9 shadow-sm">
                          Reply
                       </Button>
                       <Button size="icon" variant="outline" className="border-zinc-200 text-zinc-600 hover:text-zinc-900 h-9 w-9">
                          <Phone className="h-4 w-4" />
                       </Button>
                    </div>
                 </div>
               ))}
            </div>
          </Card>

          {/* Project Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <ProjectStatusCard 
                title="Karen Villa Renovation" 
                client="M. Kamau" 
                progress={75} 
                status="On Track"
                dueDate="Oct 24"
             />
             <ProjectStatusCard 
                title="Westlands Office Fitout" 
                client="Tech Sol" 
                progress={30} 
                status="Attention"
                dueDate="Nov 15"
                alert
             />
          </div>

        </div>

        {/* --- Section 3: Professional Widgets --- */}
        <div className="space-y-6">
          
          {/* Profile Strength */}
          <Card className="border border-zinc-200 shadow-sm bg-white overflow-hidden">
             <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Profile Strength</CardTitle>
             </CardHeader>
             <CardContent className="px-5 pb-6">
                <div className="flex items-baseline gap-2 mb-3">
                   <span className="text-3xl font-bold text-zinc-900">85%</span>
                   <span className="text-sm font-medium text-emerald-600">Excellent</span>
                </div>
                <Progress value={85} className="h-1.5 bg-zinc-100" indicatorClassName="bg-zinc-900" />
                
                <div className="mt-6 space-y-3">
                   <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                         <p className="text-xs font-semibold text-amber-900">Action Required</p>
                         <p className="text-xs text-amber-700 mt-0.5">Upload 2 recent project photos to boost visibility.</p>
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>

          {/* Daily Agenda */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
             <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Agenda</CardTitle>
                <span className="text-xs font-medium text-zinc-500">Today</span>
             </CardHeader>
             <CardContent className="px-2 pb-2">
                <div className="space-y-1">
                   {(events?.data || []).length === 0 ? (
                       <p className="p-3 text-xs text-zinc-500 text-center">No events scheduled for today.</p>
                   ) : (
                       (events?.data || []).map((event: any) => (
                           <AgendaItem 
                                key={event.id}
                                time={new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                                title={event.title} 
                                checked={event.status === 'completed'}
                           />
                       ))
                   )}
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-zinc-500 hover:text-zinc-900" asChild>
                   <Link href="/professional-portal/calendar">
                        View Calendar
                   </Link>
                </Button>
             </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}

// --- Sophisticated Sub-Components ---

function MetricCard({ title, value, trend, icon: Icon, chart }: any) {
  return (
    <Card className="border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-300 bg-white group">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-6">
           <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-100 text-zinc-400 group-hover:text-zinc-900 group-hover:border-zinc-200 transition-colors">
              <Icon className="h-5 w-5" />
           </div>
           <div className="flex items-end gap-1 h-8 opacity-30 group-hover:opacity-100 transition-opacity">
              {chart.map((h: number, i: number) => (
                 <div 
                    key={i} 
                    className="w-1 bg-zinc-900 rounded-t-sm"
                    style={{ height: `${h}%` }}
                 />
              ))}
           </div>
        </div>
        <div>
           <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{title}</p>
           <div className="flex items-baseline gap-3 mt-1">
              <h3 className="text-2xl font-bold text-zinc-900">{value}</h3>
              <span className="text-xs font-medium text-emerald-600 flex items-center gap-0.5">
                 <TrendingUp className="h-3 w-3" /> {trend}
              </span>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectStatusCard({ title, client, progress, status, dueDate, alert }: any) {
   return (
      <Card className="border border-zinc-200 shadow-sm bg-white">
         <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h4 className="font-bold text-zinc-900 text-sm">{title}</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">{client}</p>
               </div>
               <Badge 
                  variant="outline" 
                  className={cn(
                     "font-medium border-0 px-2 py-0.5", 
                     alert ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"
                  )}
               >
                  {status}
               </Badge>
            </div>
            
            <div className="space-y-2">
               <div className="flex justify-between text-xs text-zinc-500">
                  <span>Progress</span>
                  <span className="font-medium text-zinc-900">{progress}%</span>
               </div>
               <Progress 
                  value={progress} 
                  className="h-1.5 bg-zinc-100" 
                  indicatorClassName={alert ? "bg-amber-500" : "bg-zinc-900"} 
               />
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center justify-between text-xs text-zinc-500">
               <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                  Due {dueDate}
               </span>
               <button className="text-zinc-900 font-medium hover:underline">Manage</button>
            </div>
         </CardContent>
      </Card>
   )
}

function AgendaItem({ time, title, checked }: { time: string, title: string, checked?: boolean }) {
   return (
      <div className="flex items-center gap-3 p-3 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer group">
         {checked ? (
            <div className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200">
               <CheckCircle2 className="h-3 w-3" />
            </div>
         ) : (
            <div className="h-4 w-4 rounded-full border-2 border-zinc-300 group-hover:border-zinc-400" />
         )}
         <div className="flex-1">
            <p className={cn("text-xs font-semibold", checked ? "text-zinc-400 line-through" : "text-zinc-900")}>{title}</p>
            <p className="text-[10px] text-zinc-400">{time}</p>
         </div>
      </div>
   )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto p-4">
      <div className="h-20 w-full bg-zinc-100 rounded-xl animate-pulse" />
      <div className="grid grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-40 bg-zinc-100 rounded-xl animate-pulse" />)}
      </div>
      <div className="grid grid-cols-3 gap-8">
         <div className="col-span-2 h-96 bg-zinc-100 rounded-xl animate-pulse" />
         <div className="col-span-1 h-96 bg-zinc-100 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}