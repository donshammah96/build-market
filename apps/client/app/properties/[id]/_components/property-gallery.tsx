"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface GalleryImage {
  url?: string | null;
  caption?: string | null;
  asset?: {
    cdnUrl?: string | null;
    thumbnailUrl?: string | null;
  } | null;
}

function resolveUrl(img: GalleryImage): string {
  return img.asset?.cdnUrl || img.url || "/placeholder-property.jpg";
}

function resolveThumb(img: GalleryImage): string {
  return (
    img.asset?.thumbnailUrl ||
    img.asset?.cdnUrl ||
    img.url ||
    "/placeholder-property.jpg"
  );
}

export default function PropertyGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const displayImages =
    images.length > 0
      ? images
      : [{ url: "/placeholder-property.jpg", caption: null, asset: null }];

  const next = useCallback(
    () => setCurrentIndex((i) => (i + 1) % displayImages.length),
    [displayImages.length],
  );
  const prev = useCallback(
    () =>
      setCurrentIndex(
        (i) => (i - 1 + displayImages.length) % displayImages.length,
      ),
    [displayImages.length],
  );

  return (
    <>
      {/* Main image */}
      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden group">
        <Image
          src={resolveUrl(displayImages[currentIndex]!)}
          alt={displayImages[currentIndex]?.caption || title}
          fill
          className="object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
          onClick={() => setLightboxOpen(true)}
          priority
        />
        {displayImages.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
        <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/50 text-white text-xs font-medium">
          {currentIndex + 1} / {displayImages.length}
        </div>
      </div>

      {/* Thumbnails */}
      {displayImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
          {displayImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`relative flex-shrink-0 h-20 w-20 rounded-lg overflow-hidden border-2 transition-all ${
                i === currentIndex
                  ? "border-emerald-500 ring-2 ring-emerald-300"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={resolveThumb(img)}
                alt={img.caption || `Image ${i + 1}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            <button
              onClick={prev}
              className="absolute left-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>

            <div className="relative w-full h-full max-w-5xl max-h-[80vh] mx-4">
              <Image
                src={resolveUrl(displayImages[currentIndex]!)}
                alt={displayImages[currentIndex]?.caption || title}
                fill
                className="object-contain"
              />
            </div>

            <button
              onClick={next}
              className="absolute right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="h-8 w-8" />
            </button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/20 text-white text-sm font-medium">
              {currentIndex + 1} / {displayImages.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
