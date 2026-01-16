"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  Image as ImageIcon,
} from "lucide-react";

interface DocumentViewerProps {
  document: {
    id: string;
    type: string;
    fileUrl: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentViewer({
  document,
  open,
  onOpenChange,
}: DocumentViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(document.fileUrl);
  const isPdf = /\.pdf$/i.test(document.fileUrl);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {isImage ? (
                <ImageIcon className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
              {document.type}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isImage && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleZoomOut}
                    disabled={zoom <= 50}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm w-12 text-center">{zoom}%</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleZoomIn}
                    disabled={zoom >= 200}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleRotate}>
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="outline" size="icon" asChild>
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" size="icon" asChild>
                <a href={document.fileUrl} download>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted rounded-lg p-4 min-h-[400px]">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Skeleton className="w-full h-full" />
            </div>
          )}

          {isImage && (
            <div
              className="flex items-center justify-center h-full"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transition: "transform 0.2s ease",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={document.fileUrl}
                alt={document.type}
                className="max-w-full max-h-full object-contain"
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
                style={{ display: isLoading ? "none" : "block" }}
              />
            </div>
          )}

          {isPdf && (
            <iframe
              src={`${document.fileUrl}#toolbar=0`}
              className="w-full h-full min-h-[500px] rounded"
              title={document.type}
              onLoad={() => setIsLoading(false)}
              style={{ display: isLoading ? "none" : "block" }}
            />
          )}

          {!isImage && !isPdf && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium">Preview not available</p>
              <p className="text-sm">
                Click the external link or download button to view this document.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
