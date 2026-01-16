"use client";

import { 
  Users, 
  DollarSign, 
  TrendingUp
} from "lucide-react";


export function MockDashboard() {
  return (
    <div className="w-full h-full bg-zinc-900 p-6 flex flex-col font-sans select-none">
      
      {/* Header Mock */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-2 w-24 bg-zinc-800 rounded mb-2" />
          <div className="h-4 w-40 bg-zinc-700 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-full bg-zinc-800" />
          <div className="h-8 w-8 rounded-full bg-zinc-800" />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricCard 
          icon={DollarSign} 
          label="Revenue" 
          value="4.2M" 
          trend="+12%" 
          color="emerald" 
        />
        <MetricCard 
          icon={Users} 
          label="Leads" 
          value="14" 
          trend="+3" 
          color="blue" 
        />
        <MetricCard 
          icon={TrendingUp} 
          label="Growth" 
          value="85%" 
          trend="" 
          color="purple" 
        />
      </div>

      {/* Main List Area */}
      <div className="flex-1 bg-zinc-800/30 rounded-xl border border-zinc-700/50 p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="h-3 w-24 bg-zinc-700 rounded" />
          <div className="h-3 w-3 bg-zinc-700 rounded-full" />
        </div>
        
        <div className="space-y-3">
          <LeadItem 
            name="Sarah Johnson" 
            project="Kitchen Reno" 
            status="New" 
            time="2h ago"
            color="emerald"
          />
          <LeadItem 
            name="David Ochieng" 
            project="Landscape" 
            status="Offer Sent" 
            time="5h ago"
            color="blue"
          />
          <LeadItem 
            name="Tech Corp" 
            project="Office Fitout" 
            status="Pending" 
            time="1d ago"
            color="zinc"
          />
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  trend: string;
  color: string;
}

function MetricCard({ icon: Icon, label, value, trend, color }: MetricCardProps) {
  const colors = {
    emerald: "text-emerald-500 bg-emerald-500/10",
    blue: "text-blue-500 bg-blue-500/10",
    purple: "text-purple-500 bg-purple-500/10",
  };
  
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-1.5 rounded ${colors[color as keyof typeof colors]}`}>
          <Icon className="h-3 w-3" />
        </div>
        {trend && <span className="text-[10px] text-emerald-500 font-medium">{trend}</span>}
      </div>
      <div className="text-zinc-400 text-[10px] uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-white font-bold text-lg">{value}</div>
    </div>
  );
}

interface LeadItemProps {
  name: string;
  project: string;
  status: string;
  time: string;
  color: string;
}

function LeadItem({ status, time, color }: LeadItemProps) {
  const statusColors = {
    emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/20",
    zinc: "bg-zinc-700/50 text-zinc-400 border-zinc-600/50",
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
      <div className="h-8 w-8 rounded-full bg-zinc-700 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-zinc-600 rounded mb-1" />
          <div className="text-[10px] text-zinc-500">{time}</div>
        </div>
        <div className="h-2 w-16 bg-zinc-700 rounded" />
      </div>
      <div className={`px-2 py-0.5 rounded text-[10px] font-medium border ${statusColors[color as keyof typeof statusColors]}`}>
        {status}
      </div>
    </div>
  );
}