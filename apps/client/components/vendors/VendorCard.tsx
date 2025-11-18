import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Star, MapPin, Award, Store as StoreIcon, ExternalLink } from "lucide-react";
import { ImageWithFallback } from "../../app/lib/ImageWithFallback";
import { motion } from "framer-motion";
import Link from "next/link";
import { VendorCardData } from "../../types/vendor";

interface VendorCardProps {
  vendor: VendorCardData;
  index?: number;
  isInView?: boolean;
}

const VendorCard: React.FC<VendorCardProps> = ({ 
  vendor, 
  index = 0, 
  isInView = true 
}) => {
  const displayLocation = vendor.location || 
    (vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : vendor.address);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      whileHover={{ y: -8 }}
    >
      <Card className="overflow-hidden hover:shadow-xl transition-shadow h-full">
        <div className="aspect-video overflow-hidden bg-slate-200 relative">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <ImageWithFallback 
              src={vendor.imageUrl || '/hardware.png'}
              alt={vendor.name}
              className="w-full h-full object-cover"
            />
          </motion.div>
          {vendor.verified && (
            <div className="absolute top-3 right-3 bg-blue-600 text-white px-2 py-1 rounded-full flex items-center gap-1 text-xs font-medium">
              <Award className="h-3 w-3" />
              Verified
            </div>
          )}
        </div>
        
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <StoreIcon className="h-5 w-5 text-slate-600" />
                {vendor.name}
              </CardTitle>
              {vendor.description && (
                <CardDescription className="line-clamp-2 mt-1">
                  {vendor.description}
                </CardDescription>
              )}
            </div>
            {vendor.rating && (
              <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-semibold">{vendor.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
          
          {displayLocation && (
            <div className="flex items-center gap-1 text-sm text-slate-600 mt-2">
              <MapPin className="h-4 w-4" />
              <span>{displayLocation}</span>
            </div>
          )}
          
          <div className="flex items-center gap-4 text-sm text-slate-600 mt-2">
            {vendor.productCount !== undefined && (
              <span>{vendor.productCount} products</span>
            )}
            {vendor.reviewCount !== undefined && vendor.reviewCount > 0 && (
              <span>{vendor.reviewCount} reviews</span>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {vendor.categories.slice(0, 4).map((category, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3, delay: index * 0.15 + i * 0.05 }}
              >
                <Badge variant="secondary" className="text-xs">
                  {category}
                </Badge>
              </motion.div>
            ))}
            {vendor.categories.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{vendor.categories.length - 4} more
              </Badge>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link href={`/vendors/${vendor.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Store
              </Link>
            </Button>
            {vendor.productCount !== undefined && vendor.productCount > 0 && (
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href={`/vendors/${vendor.id}/products`}>
                  Browse Products
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default VendorCard;
