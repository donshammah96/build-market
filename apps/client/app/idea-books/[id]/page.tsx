"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  BookOpen,
  Image as ImageIcon,
  MoreVertical,
  Trash2,
  LayoutGrid,
} from "lucide-react";

import { Navbar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useIdeaBook,
  useDeleteIdeaBook,
  useDeleteIdeaBookAttachment,
} from "@/hooks/useIdeaBooks";
import type { IdeaBookAttachment } from "@/lib/facades/idea-books-client";
import { ROUTES } from "@/lib/routes";

function getAttachmentUrl(att: IdeaBookAttachment): string | null {
  return att.asset?.cdnUrl ?? att.fileUrl ?? att.sourceUrl ?? null;
}

function formatCategory(category: string): string {
  return category
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export default function IdeaBookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : null;

  const { data: book, isLoading, error, isError } = useIdeaBook(id);
  const deleteBookMutation = useDeleteIdeaBook();
  const deleteAttachmentMutation = useDeleteIdeaBookAttachment();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleDeleteBook = () => {
    if (!id) return;
    deleteBookMutation.mutate(id, {
      onSuccess: () => {
        setDeleteConfirmOpen(false);
        router.push(ROUTES.ideaBooks);
      },
    });
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    if (!id) return;
    deleteAttachmentMutation.mutate({ bookId: id, attachmentId });
  };

  if (!id) {
    return (
      <div className="min-h-screen bg-zinc-50/50 flex flex-col">
        <Navbar variant="light" />
        <main className="flex-1 container mx-auto px-4 md:px-8 py-8 pt-24 max-w-7xl">
          <div className="text-center py-20">
            <p className="text-zinc-500">Invalid idea book</p>
            <Link href={ROUTES.ideaBooks}>
              <Button variant="outline" className="mt-4">
                Back to Idea Books
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50/50 flex flex-col">
        <Navbar variant="light" />
        <main className="flex-1 container mx-auto px-4 md:px-8 py-8 pt-24 max-w-7xl">
          <IdeaBookDetailSkeleton />
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="min-h-screen bg-zinc-50/50 flex flex-col">
        <Navbar variant="light" />
        <main className="flex-1 container mx-auto px-4 md:px-8 py-8 pt-24 max-w-7xl">
          <div className="text-center py-20">
            <BookOpen className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Idea book not found
            </h2>
            <p className="text-zinc-500 mb-6">
              {error?.message ??
                "This idea book may have been deleted or you don't have access."}
            </p>
            <Link href={ROUTES.ideaBooks}>
              <Button variant="outline">Back to Idea Books</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const attachments = book.attachments ?? [];
  const attachmentCount = book.attachmentCount ?? attachments.length;

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col">
      <Navbar variant="light" />

      <main className="flex-1 container mx-auto px-4 md:px-8 py-8 pt-24 max-w-7xl">
        {/* Back link */}
        <Link
          href={ROUTES.ideaBooks}
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Idea Books
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1"
          >
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
                  {book.title}
                </h1>
                {book.description && (
                  <p className="text-zinc-500 mt-1">{book.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-zinc-400">
                  <span>{formatCategory(book.category)}</span>
                  <span>•</span>
                  <span>
                    Updated{" "}
                    {formatDistanceToNow(new Date(book.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {attachmentCount} {attachmentCount === 1 ? "item" : "items"}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-zinc-200"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onSelect={(e) => {
                    e.preventDefault();
                    setDeleteConfirmOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete idea book
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        </div>

        {/* Attachments grid */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">
            Saved items
          </h2>
          {attachments.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <AnimatePresence mode="popLayout">
                {attachments.map((att, index) => (
                  <AttachmentCard
                    key={att.id}
                    attachment={att}
                    index={index}
                    onDelete={() => handleDeleteAttachment(att.id)}
                    isDeleting={deleteAttachmentMutation.isPending}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="border-2 border-dashed border-zinc-200 rounded-2xl bg-white/50 py-16 text-center">
              <ImageIcon className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 font-medium">No items yet</p>
              <p className="text-sm text-zinc-400 mt-1">
                Add images and inspiration to this idea book
              </p>
            </div>
          )}
        </motion.section>
      </main>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteConfirmOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-50 p-6"
            >
              <h3 className="text-lg font-semibold text-zinc-900">
                Delete idea book?
              </h3>
              <p className="text-zinc-500 mt-2 text-sm">
                This will permanently delete &quot;{book.title}&quot; and all
                its items. This action cannot be undone.
              </p>
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={deleteBookMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDeleteBook}
                  disabled={deleteBookMutation.isPending}
                >
                  {deleteBookMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}

// --- Attachment Card ---
function AttachmentCard({
  attachment,
  index,
  onDelete,
  isDeleting,
}: {
  attachment: IdeaBookAttachment;
  index: number;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const url = getAttachmentUrl(attachment);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className="group relative aspect-square rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200"
    >
      {url ? (
        <Image
          src={url}
          alt={attachment.caption ?? ""}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
          <ImageIcon className="h-10 w-10" />
        </div>
      )}

      {/* Overlay with caption and delete */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
        {attachment.caption && (
          <p className="text-white text-sm line-clamp-2">
            {attachment.caption}
          </p>
        )}
        <div className="flex justify-end">
          <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onSelect={(e) => {
                  e.preventDefault();
                  onDelete();
                  setShowMenu(false);
                }}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
}

function IdeaBookDetailSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex gap-4">
        <Skeleton className="h-14 w-14 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <div>
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
