"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, AlertCircle, Eye } from "lucide-react";
import { RegulatorVerificationDetailDialog } from "./RegulatorVerificationDetailDialog";
import type {
  RegulatorVerificationCaseItem,
  RegulatorVerificationCaseFilter,
} from "@/lib/domains/regulator-verification";

interface RegulatorVerificationQueueProps {
  items: RegulatorVerificationCaseItem[];
  total: number;
  page: number;
  pageSize: number;
  filters: RegulatorVerificationCaseFilter;
  onFilterChange: (filters: Partial<RegulatorVerificationCaseFilter>) => void;
  onRefresh?: (() => void) | undefined;
}

const AUTHORITIES = [
  "NCA",
  "EPRA",
  "BORAQS",
  "EBK",
  "EARB",
  "VRB",
  "ISK",
] as const;

export function RegulatorVerificationQueue({
  items,
  total,
  page,
  pageSize,
  filters,
  onFilterChange,
  onRefresh,
}: RegulatorVerificationQueueProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleReview = (id: string) => {
    setSelectedCaseId(id);
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DEAD_LETTER":
        return <Badge variant="destructive">DEAD_LETTER</Badge>;
      case "NEEDS_MANUAL_REVIEW":
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600">
            NEEDS_REVIEW
          </Badge>
        );
      case "MANUALLY_VERIFIED":
      case "AUTO_VERIFIED":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700">
            VERIFIED
          </Badge>
        );
      case "MANUALLY_REJECTED":
      case "AUTO_REJECTED":
        return (
          <Badge variant="outline" className="text-red-500 border-red-500">
            REJECTED
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const deadLetterCount = items.filter(
    (i) => i.status === "DEAD_LETTER",
  ).length;
  const reviewCount = items.filter(
    (i) => i.status === "NEEDS_MANUAL_REVIEW",
  ).length;

  return (
    <div className="space-y-6">
      {/* Queue Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Needs Manual Review
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviewCount}</div>
            <p className="text-xs text-muted-foreground">
              Cases requiring operator triage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Dead Letter Cases
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deadLetterCount}</div>
            <p className="text-xs text-muted-foreground">
              Exhausted attempt budget
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">
              In active queue filters
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-muted/30 p-4 rounded-lg border">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Status Select */}
          <Select
            value={filters.status?.[0] || "ALL"}
            onValueChange={(val) =>
              onFilterChange({
                ...filters,
                status: val === "ALL" ? undefined : [val],
                page: 1,
              })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="NEEDS_MANUAL_REVIEW">Needs Review</SelectItem>
              <SelectItem value="DEAD_LETTER">Dead Letter</SelectItem>
              <SelectItem value="MANUALLY_VERIFIED">
                Manually Verified
              </SelectItem>
              <SelectItem value="MANUALLY_REJECTED">
                Manually Rejected
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Authority Select */}
          <Select
            value={filters.authority || "ALL"}
            onValueChange={(val) =>
              onFilterChange({
                ...filters,
                authority: val === "ALL" ? undefined : val,
                page: 1,
              })
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Regulators" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Regulators</SelectItem>
              {AUTHORITIES.map((auth) => (
                <SelectItem key={auth} value={auth}>
                  {auth}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cases Table */}
      <div className="border rounded-lg overflow-hidden bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Authority</TableHead>
              <TableHead>License #</TableHead>
              <TableHead>Professional ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  No regulator verification cases found matching criteria.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold">
                    {item.authority}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.licenseNumber}
                  </TableCell>
                  <TableCell
                    className="text-xs truncate max-w-[140px]"
                    title={item.professionalId}
                  >
                    {item.professionalId}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {item.confidence !== null
                      ? `${(item.confidence * 100).toFixed(0)}%`
                      : "N/A"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.attempts}/{item.maxAttempts}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReview(item.id)}
                      className="flex items-center gap-1 ml-auto"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Review Case
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <RegulatorVerificationDetailDialog
        caseId={selectedCaseId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDecisionSubmitted={onRefresh}
      />
    </div>
  );
}
