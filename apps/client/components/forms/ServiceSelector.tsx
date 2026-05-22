"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { ServiceGroup } from "@/app/lib/domains/professional-settings";

interface ServiceSelectorProps {
  initialSelectedIds?: string[];
  onChange: (ids: string[]) => void;
  serviceGroups: ServiceGroup[];
  isLoading?: boolean;
}

export function ServiceSelector({
  initialSelectedIds = [],
  onChange,
  serviceGroups,
  isLoading,
}: ServiceSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  useEffect(() => {
    setSelectedIds(initialSelectedIds);
  }, [initialSelectedIds]);

  const handleToggle = (serviceId: string) => {
    const newSelected = selectedIds.includes(serviceId)
      ? selectedIds.filter((id) => id !== serviceId)
      : [...selectedIds, serviceId];

    setSelectedIds(newSelected);
    onChange(newSelected);
  };

  const handleToggleGroup = (category: ServiceGroup) => {
    // Check if checks all or unchecks all
    const catServiceIds = category.services.map((s) => s.id);
    const allSelected = catServiceIds.every((id) => selectedIds.includes(id));

    let newSelected: string[];
    if (allSelected) {
      // Unselect all in group
      newSelected = selectedIds.filter((id) => !catServiceIds.includes(id));
    } else {
      // Select all in group (merge)
      newSelected = Array.from(new Set([...selectedIds, ...catServiceIds]));
    }

    setSelectedIds(newSelected);
    onChange(newSelected);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (serviceGroups.length === 0) {
    return <div className="text-zinc-500 text-sm">No services available.</div>;
  }

  return (
    <Accordion type="multiple" className="w-full space-y-4">
      {serviceGroups.map((group) => {
        const groupServiceIds = group.services.map((s) => s.id);
        const selectedCount = groupServiceIds.filter((id) =>
          selectedIds.includes(id),
        ).length;

        return (
          <AccordionItem
            key={group.id}
            value={group.id}
            className="border rounded-lg px-4"
          >
            <div className="flex items-center justify-between py-2">
              <AccordionTrigger className="hover:no-underline flex-1">
                <span className="flex items-center gap-2">
                  {group.name}
                  {selectedCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {selectedCount} selected
                    </Badge>
                  )}
                </span>
              </AccordionTrigger>
              {/* Use a native <button> — not a div — so this is keyboard-accessible
                  and doesn't require stopPropagation hacks against the accordion trigger.
                  type="button" prevents accidental form submission if nested inside a form. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleGroup(group);
                }}
                className="flex items-center gap-2 mr-4 text-xs text-zinc-500 hover:text-zinc-300 transition-colors min-h-[44px] min-w-[44px] px-2"
                aria-label={`Select all services in ${group.name}`}
              >
                <Checkbox
                  checked={
                    selectedCount === group.services.length &&
                    group.services.length > 0
                  }
                  onCheckedChange={() => handleToggleGroup(group)}
                  aria-hidden="true"
                  tabIndex={-1}
                  className="mr-1 pointer-events-none"
                />
                Select All
              </button>
            </div>

            <AccordionContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 pb-4">
                {group.services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-start space-x-2 p-2 rounded hover:bg-zinc-50"
                  >
                    <Checkbox
                      id={service.id}
                      checked={selectedIds.includes(service.id)}
                      onCheckedChange={() => handleToggle(service.id)}
                    />
                    <Label
                      htmlFor={service.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer pt-0.5"
                    >
                      {service.name}
                    </Label>
                  </div>
                ))}
                {group.services.length === 0 && (
                  <p className="text-sm text-zinc-400 italic">
                    No specific services listed.
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
