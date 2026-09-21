"use client";

import {
  Edit,
  Eye,
  Trash2,
  Home,
  MapPin,
  DollarSign,
  Calendar,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ImageWithFallback } from "@/app/lib/media/ImageWithFallback";
import type { MyPropertyListing } from "@/lib/facades/properties-client";

export interface PropertyListCardProps {
  property: MyPropertyListing;
  statusBadge: React.ReactNode;
  onEdit: (property: MyPropertyListing) => void;
  onDelete: (property: MyPropertyListing) => void;
}

export function PropertyListCard({
  property,
  statusBadge,
  onEdit,
  onDelete,
}: PropertyListCardProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
      {/* Property Image */}
      <div className="w-full md:w-48 flex-shrink-0">
        <AspectRatio
          ratio={16 / 9}
          className="bg-zinc-100 rounded-lg overflow-hidden"
        >
          <ImageWithFallback
            src={property.images?.[0] || ""}
            alt={property.title}
            className="object-cover w-full h-full"
          />
        </AspectRatio>
      </div>

      {/* Property Details */}
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">
              {property.title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <MapPin className="h-4 w-4 text-zinc-400" />
              <span className="text-sm text-zinc-600">{property.location}</span>
            </div>
          </div>
          {statusBadge}
        </div>

        <div className="flex items-center gap-4 text-sm text-zinc-600">
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            <span className="font-semibold">
              {new Intl.NumberFormat("en-KE", {
                style: "currency",
                currency: "KES",
                minimumFractionDigits: 0,
              }).format(property.price)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Home className="h-4 w-4" />
            <span>{property.type}</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            <span>{property.views} views</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{property.inquiries} inquiries</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/properties/${property.id}`}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => onEdit(property)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(property)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
