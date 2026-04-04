import { notFound } from "next/navigation";
import Link from "next/link";
import { getLeadDetails } from "@/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  MessageSquare,
  User,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  MapPin,
  Building2,
  FileText,
  UserCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { UpdateStatusButton } from "@/components/admin/leads/UpdateStatusButton";
import { LeadActions } from "@/components/admin/leads/LeadActions";
import { getAdminPermissions } from "@/actions/admin/shared";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

const statusConfig: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  NEW: {
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <AlertCircle className="h-4 w-4" />,
    label: "New Lead",
  },
  CONTACTED: {
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: <MessageSquare className="h-4 w-4" />,
    label: "Contacted",
  },
  PROPOSAL: {
    color: "bg-purple-100 text-purple-700 border-purple-200",
    icon: <UserCheck className="h-4 w-4" />,
    label: "Proposal Sent",
  },
  WON: {
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: <CheckCircle className="h-4 w-4" />,
    label: "Won",
  },
  LOST: {
    color: "bg-red-100 text-red-700 border-red-200",
    icon: <XCircle className="h-4 w-4" />,
    label: "Lost",
  },
};

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  const response = await getLeadDetails(id);

  if (!response.success || !response.data) {
    notFound();
  }

  const lead = response.data;
  const status = statusConfig[lead.status] || statusConfig.NEW;

  if (!status) {
    notFound();
  }

  const { granularRole } = await getAdminPermissions();
  const canManageLeads = ["SUPER_ADMIN", "SALES_MANAGER"].includes(
    granularRole || "",
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/leads">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-zinc-900">
                {lead.clientName || "Anonymous Lead"}
              </h1>
              <Badge variant="outline" className={status.color}>
                {status.icon}
                <span className="ml-1">{status.label}</span>
              </Badge>
            </div>
            <p className="text-zinc-500 mt-1">Lead #{lead.id.slice(0, 8)}</p>
          </div>
        </div>
        {canManageLeads && (
          <UpdateStatusButton leadId={lead.id} currentStatus={lead.status} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lead Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Lead Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {lead.notes && (
                <div>
                  <h4 className="text-sm font-medium text-zinc-500 mb-2">
                    Notes
                  </h4>
                  <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                    <p className="text-zinc-900 whitespace-pre-wrap">
                      {lead.notes}
                    </p>
                  </div>
                </div>
              )}

              {lead.projectType && (
                <>
                  {lead.notes && <Separator />}
                  <div>
                    <h4 className="text-sm font-medium text-zinc-500 mb-2">
                      Project Type
                    </h4>
                    <p className="text-zinc-900 capitalize">
                      {lead.projectType.replace(/_/g, " ")}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                {lead.budget && (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-500 mb-2 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Budget
                    </h4>
                    <p className="text-zinc-900 font-medium">{lead.budget}</p>
                  </div>
                )}

                {lead.followUpDate && (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-500 mb-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Follow Up Date
                    </h4>
                    <p className="text-zinc-900">
                      {new Date(lead.followUpDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </div>

              {lead.location && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium text-zinc-500 mb-2 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Location
                    </h4>
                    <p className="text-zinc-900">{lead.location}</p>
                  </div>
                </>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-zinc-500 mb-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Submitted
                  </h4>
                  <p className="text-zinc-900">
                    {new Date(lead.createdAt).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-zinc-500 mb-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Last Updated
                  </h4>
                  <p className="text-zinc-900">
                    {new Date(lead.updatedAt).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Info */}
          {lead.professional && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Assigned Professional
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 bg-zinc-50">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900">
                        {lead.professional.companyName}
                      </p>
                      {lead.professional.user && (
                        <p className="text-sm text-zinc-500">
                          {lead.professional.user.firstName}{" "}
                          {lead.professional.user.lastName}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href={`/professionals/${lead.professional.userId}`}>
                      View Profile
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lead.clientName ? (
                <>
                  <div>
                    <p className="text-sm text-zinc-500">Name</p>
                    <p className="font-medium text-zinc-900">
                      {lead.clientName}
                    </p>
                  </div>

                  {lead.clientEmail && (
                    <div>
                      <p className="text-sm text-zinc-500">Email</p>
                      <a
                        href={`mailto:${lead.clientEmail}`}
                        className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        {lead.clientEmail}
                      </a>
                    </div>
                  )}

                  {lead.clientPhone && (
                    <div>
                      <p className="text-sm text-zinc-500">Phone</p>
                      <a
                        href={`tel:${lead.clientPhone}`}
                        className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        {lead.clientPhone}
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <User className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">No client information</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      lead.status === key
                        ? "bg-zinc-100 ring-2 ring-zinc-300"
                        : "opacity-50"
                    }`}
                  >
                    {config.icon}
                    <span className={lead.status === key ? "font-medium" : ""}>
                      {config.label}
                    </span>
                    {lead.status === key && (
                      <CheckCircle className="h-4 w-4 text-emerald-500 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          {canManageLeads && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <LeadActions
                  leadId={lead.id}
                  clientEmail={lead.clientEmail}
                  clientPhone={lead.clientPhone}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
