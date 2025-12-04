"use client";

import { useState } from "react";
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  XCircle,
  Clock
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock Data
const MOCK_LEADS = [
  { id: 1, name: "Sarah Johnson", project: "Kitchen Reno", location: "Kileleshwa", budget: "KSh 1.2M", status: "New", date: "2h ago", avatar: "https://i.pravatar.cc/150?u=1" },
  { id: 2, name: "David Ochieng", project: "Landscape", location: "Karen", budget: "KSh 300k", status: "Contacted", date: "1d ago", avatar: "https://i.pravatar.cc/150?u=2" },
  { id: 3, name: "Tech Solutions", project: "Office Fitout", location: "Westlands", budget: "KSh 2.5M", status: "Proposal", date: "3d ago", avatar: "https://i.pravatar.cc/150?u=3" },
  { id: 4, name: "Anita Patel", project: "Master Bath", location: "Parklands", budget: "KSh 500k", status: "Won", date: "1w ago", avatar: "https://i.pravatar.cc/150?u=4" },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState(MOCK_LEADS);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-end border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Leads Pipeline</h1>
          <p className="text-zinc-500 mt-1">Manage incoming inquiries and track conversion.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input 
              placeholder="Search leads..." 
              className="pl-9 bg-white border-zinc-200 focus:ring-emerald-500/20"
            />
          </div>
          <Button variant="outline" className="border-zinc-200">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
        </div>
      </div>

      {/* Leads Table Card */}
      <Card className="border border-zinc-200 shadow-sm bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 font-medium">
              <tr>
                <th className="px-6 py-4 w-[300px]">Client</th>
                <th className="px-6 py-4">Project Details</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Received</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="group hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-zinc-200">
                        <AvatarImage src={lead.avatar} />
                        <AvatarFallback>CL</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-zinc-900">{lead.name}</p>
                        <p className="text-zinc-500 text-xs">{lead.location}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-zinc-900">{lead.project}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">Budget: {lead.budget}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-6 py-4 text-zinc-500 flex items-center gap-2">
                    <Clock className="h-3 w-3" /> {lead.date}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="outline" className="h-8 w-8 text-emerald-600 border-emerald-100 hover:bg-emerald-50">
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8 text-blue-600 border-blue-100 hover:bg-blue-50">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Mark as Won</DropdownMenuItem>
                          <DropdownMenuItem>Mark as Lost</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">Archive Lead</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    New: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Contacted: "bg-blue-50 text-blue-700 border-blue-200",
    Proposal: "bg-purple-50 text-purple-700 border-purple-200",
    Won: "bg-zinc-900 text-white border-zinc-900",
    Lost: "bg-zinc-100 text-zinc-500 border-zinc-200",
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.Lost}`}>
      {status}
    </span>
  );
}