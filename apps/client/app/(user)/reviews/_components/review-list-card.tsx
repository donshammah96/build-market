"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Star,
  ThumbsUp,
  Store as StoreIcon,
  HardHat,
  BadgeCheck,
  Quote,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getProfessionalUrl, getStoreUrl } from "@/lib/routes";
import type { ReviewListItemDto } from "@/app/lib/domains/reviews/contracts";

export function ReviewListCard({
  review,
  index,
}: {
  review: ReviewListItemDto;
  index: number;
}) {
  const targetName =
    review.type === "PROFESSIONAL"
      ? review.professional?.companyName
      : review.store?.name;
  const targetImage =
    review.type === "PROFESSIONAL"
      ? review.professional?.imageUrl
      : review.store?.imageUrl;
  const isVerified =
    review.type === "PROFESSIONAL"
      ? review.professional?.verified
      : review.store?.verified;
  const targetUrl =
    review.type === "PROFESSIONAL" && review.professional
      ? getProfessionalUrl(review.professional.id)
      : review.store
        ? getStoreUrl(review.store.id)
        : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="h-full border-zinc-200 hover:shadow-lg transition-all duration-300 flex flex-col group">
        <CardContent className="p-6 flex flex-col h-full">
          {/* Header: Reviewer Info */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10 border border-zinc-100">
              <AvatarImage src={review.reviewer.avatar ?? undefined} />
              <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold">
                {review.reviewer.firstName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {review.reviewer.firstName} {review.reviewer.lastName}
              </p>
              <p className="text-xs text-zinc-500">
                {review.reviewer.city ?? "Kenya"} •{" "}
                {formatDistanceToNow(new Date(review.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
            <div className="ml-auto flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-3.5 w-3.5",
                    i < review.rating
                      ? "fill-amber-400 text-amber-400"
                      : "fill-zinc-200 text-zinc-200",
                  )}
                />
              ))}
            </div>
          </div>

          {/* Body: Quote */}
          <div className="relative mb-6 flex-1">
            <Quote className="absolute -top-1 -left-1 h-6 w-6 text-zinc-100 fill-zinc-100 transform -scale-x-100" />
            <p className="relative z-10 text-zinc-600 leading-relaxed pt-2">
              &quot;{review.comment ?? ""}&quot;
            </p>
          </div>

          {/* Footer: Reviewed Entity */}
          <div className="mt-auto pt-4 border-t border-zinc-100">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              {review.type === "PROFESSIONAL" ? (
                <HardHat className="h-3 w-3" />
              ) : (
                <StoreIcon className="h-3 w-3" />
              )}
              Reviewed
            </div>

            {targetUrl ? (
              <Link
                href={targetUrl}
                className="flex items-center gap-3 bg-zinc-50 p-3 rounded-lg group-hover:bg-emerald-50/50 transition-colors cursor-pointer"
              >
                <div className="h-10 w-10 relative rounded overflow-hidden bg-white border border-zinc-200 shrink-0">
                  {targetImage ? (
                    <Image
                      src={targetImage}
                      alt={targetName || ""}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-zinc-100 text-zinc-400">
                      {review.type === "PROFESSIONAL" ? (
                        <HardHat className="h-5 w-5" />
                      ) : (
                        <StoreIcon className="h-5 w-5" />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-zinc-900 truncate flex items-center gap-1">
                    {targetName}
                    {isVerified && (
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                  </h4>
                  <p className="text-xs text-zinc-500 truncate">
                    {review.type === "PROFESSIONAL"
                      ? "Verified Professional"
                      : "Verified Merchant"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-zinc-400 group-hover:text-emerald-600"
                >
                  <ThumbsUp className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-3 bg-zinc-50 p-3 rounded-lg">
                <div className="h-10 w-10 relative rounded overflow-hidden bg-white border border-zinc-200 shrink-0">
                  {targetImage ? (
                    <Image
                      src={targetImage}
                      alt={targetName ?? ""}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-zinc-100 text-zinc-400">
                      {review.type === "PROFESSIONAL" ? (
                        <HardHat className="h-5 w-5" />
                      ) : (
                        <StoreIcon className="h-5 w-5" />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-zinc-900 truncate flex items-center gap-1">
                    {targetName}
                    {isVerified && (
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                  </h4>
                  <p className="text-xs text-zinc-500 truncate">
                    {review.type === "PROFESSIONAL"
                      ? "Verified Professional"
                      : "Verified Merchant"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
