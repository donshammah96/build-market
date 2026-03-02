"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MoreHorizontal,
  Phone,
  MessageSquare,
  Clock,
  Building2,
  ChevronRight,
  AlertCircle,
  Eye,
} from "lucide-react";

import { useInquiries } from "@/hooks/useInquiries";
import type { PropertyInquiryList } from "@/lib/inquiries-client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// We import PropertyInquiryList instead of redefining it locally

const statusConfig: Record<string, { color: string; label: string }> = {
  new: {
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    label: "New",
  },
  contacted: {
    color: "bg-blue-50 text-blue-700 border-blue-200",
    label: "Contacted",
  },
  viewing_scheduled: {
    color: "bg-purple-50 text-purple-700 border-purple-200",
    label: "Viewing Scheduled",
  },
  offer_made: {
    color: "bg-amber-50 text-amber-700 border-amber-200",
    label: "Offer Made",
  },
  closed: {
    color: "bg-zinc-100 text-zinc-700 border-zinc-200",
    label: "Closed",
  },
};

/**
 * InquiriesPage Component
 *
 * Enterprise-level inquiries management interface with:
 * - Search and filtering
 * - Status management
 * - Link to detail pages
 * - Error handling
 */
export default function InquiriesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch Inquiries using our new unified hook
  const {
    data: inquiriesData,
    isLoading,
    error: fetchError,
  } = useInquiries(
    statusFilter !== "all"
      ? {
          status: statusFilter.toUpperCase() as
            | "NEW"
            | "CONTACTED"
            | "VIEWING_SCHEDULED"
            | "OFFER_MADE"
            | "CLOSED",
        }
      : {},
  );

  // Ensure inquiries is always an array
  const inquiries: PropertyInquiryList[] = useMemo(() => {
    if (!inquiriesData) return [];
    if (Array.isArray(inquiriesData)) return inquiriesData;
    return [];
  }, [inquiriesData]);

  // Filter inquiries by search query
  const filteredInquiries = useMemo(() => {
    if (!searchQuery.trim()) return inquiries;
    const query = searchQuery.toLowerCase();
    return inquiries.filter(
      (inq) =>
        inq.clientName.toLowerCase().includes(query) ||
        inq.propertyTitle.toLowerCase().includes(query) ||
        inq.message?.toLowerCase().includes(query) ||
        inq.clientPhone?.includes(query),
    );
  }, [inquiries, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    return {
      total: inquiries.length,
      new: inquiries.filter((i) => i.status === "NEW").length,
      contacted: inquiries.filter((i) => i.status === "CONTACTED").length,
      viewingScheduled: inquiries.filter(
        (i) => i.status === "VIEWING_SCHEDULED",
      ).length,
      offerMade: inquiries.filter((i) => i.status === "OFFER_MADE").length,
      closed: inquiries.filter((i) => i.status === "CLOSED").length,
    };
  }, [inquiries]);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-end border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Property Inquiries
          </h1>
          <p className="text-zinc-500 mt-1">
            Manage property inquiries and track client interest.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search inquiries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white border-zinc-200 focus:ring-emerald-500/20"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-white border-zinc-200">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="viewing_scheduled">
                Viewing Scheduled
              </SelectItem>
              <SelectItem value="offer_made">Offer Made</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="text-sm text-zinc-500 mb-1">Total</div>
            <div className="text-2xl font-bold text-zinc-900">
              {stats.total}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="text-sm text-zinc-500 mb-1">New</div>
            <div className="text-2xl font-bold text-emerald-600">
              {stats.new}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="text-sm text-zinc-500 mb-1">Contacted</div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.contacted}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="text-sm text-zinc-500 mb-1">Viewing</div>
            <div className="text-2xl font-bold text-purple-600">
              {stats.viewingScheduled}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="text-sm text-zinc-500 mb-1">Offer Made</div>
            <div className="text-2xl font-bold text-amber-600">
              {stats.offerMade}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="text-sm text-zinc-500 mb-1">Closed</div>
            <div className="text-2xl font-bold text-zinc-600">
              {stats.closed}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inquiries List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 bg-zinc-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : fetchError ? (
        <Card className="p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-500 mb-4">
              {fetchError instanceof Error
                ? fetchError.message
                : "Failed to load inquiries"}
            </p>
            <Button
              onClick={() => {
                queryClient.invalidateQueries({
                  queryKey: ["inquiries"],
                });
              }}
            >
              Retry
            </Button>
          </div>
        </Card>
      ) : filteredInquiries.length > 0 ? (
        <div className="space-y-4">
          {filteredInquiries.map((inquiry) => (
            <InquiryCard key={inquiry.id} inquiry={inquiry} />
          ))}
        </div>
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-zinc-300" />
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">
              No inquiries found
            </h3>
            <p className="text-zinc-500">
              {searchQuery
                ? "Try adjusting your search criteria."
                : "You don't have any property inquiries yet."}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

function InquiryCard({ inquiry }: { inquiry: PropertyInquiryList }) {
  const status = (statusConfig[inquiry.status.toLowerCase()] ??
    statusConfig.new) as {
    color: string;
    label: string;
  };

  return (
    <Card className="border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-300 bg-white group cursor-pointer">
      <Link href={`/professional-portal/inquiries/${inquiry.id}`}>
        <CardContent className="p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
          {/* Status & Time */}
          <div className="flex flex-col gap-2 min-w-[140px]">
            <div className="flex items-center text-zinc-900 font-medium">
              <Clock className="h-4 w-4 mr-2 text-zinc-400" />
              {new Date(inquiry.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <Badge className={`w-fit ${status.color} border-0`}>
              {status.label}
            </Badge>
          </div>

          {/* Inquiry Details */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-zinc-900 text-lg">
                  {inquiry.propertyTitle}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-sm text-zinc-500">
                    Property Inquiry
                  </span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.preventDefault()}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4 text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/professional-portal/inquiries/${inquiry.id}`}>
                      <Eye className="mr-2 h-4 w-4" /> View Details
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {inquiry.message && (
              <p className="text-sm text-zinc-600 line-clamp-2 mt-2">
                {inquiry.message}
              </p>
            )}
            <div className="flex items-center gap-2 pt-2">
              <Avatar className="h-6 w-6 border border-zinc-200">
                <AvatarFallback className="text-xs">
                  {inquiry.clientName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-zinc-600">
                <span className="font-medium text-zinc-900">
                  {inquiry.clientName}
                </span>
                {inquiry.clientPhone && (
                  <>
                    {" • "}
                    <Phone className="h-3 w-3 inline mr-1" />
                    {inquiry.clientPhone}
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Action */}
          <div className="hidden md:flex">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-zinc-900"
              asChild
            >
              <Link href={`/professional-portal/inquiries/${inquiry.id}`}>
                Details <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
