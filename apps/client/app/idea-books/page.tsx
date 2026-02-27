"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Plus,
  BookOpen,
  MoreVertical,
  Image as ImageIcon,
  Search,
  LayoutGrid,
} from "lucide-react";

import { Navbar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useIdeaBooks,
  useCreateIdeaBook,
} from "@/hooks/useIdeaBooks";
import type { IdeaBookListItem } from "@/lib/idea-books-client";
import { getIdeaBookUrl } from "@/lib/links";

export default function IdeaBooksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading } = useIdeaBooks({
    search: searchQuery || undefined,
    limit: 50,
  });
  const createMutation = useCreateIdeaBook();

  const books = data?.data ?? [];

  const handleCreateBook = (title: string, description: string) => {
    createMutation.mutate(
      { title, description, category: "WHOLE_HOUSE", privacy: "PUBLIC" },
      {
        onSuccess: () => setIsCreateOpen(false),
      },
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col">
      <Navbar variant="light" />

      <main className="flex-1 container mx-auto px-4 md:px-8 py-8 pt-24 max-w-7xl">
        
        {/* --- Header Section --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-emerald-600" />
              Idea Books
            </h1>
            <p className="text-zinc-500 mt-2 text-lg max-w-2xl">
              Collect, organize, and share inspiration for your next project.
            </p>
          </motion.div>

          <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             className="flex items-center gap-3"
          >
            <div className="relative hidden md:block w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Search your boards..." 
                className="pl-9 bg-white border-zinc-200 focus:ring-emerald-500/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              size="lg" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="mr-2 h-5 w-5" /> New Idea Book
            </Button>
          </motion.div>
        </div>

        {/* --- Content Grid --- */}
        {isLoading ? (
          <IdeaBookSkeleton />
        ) : books.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
            <AnimatePresence mode="popLayout">
              {books.map((book, index) => (
                <IdeaBookCard key={book.id} book={book} index={index} />
              ))}
            </AnimatePresence>
            
            {/* "Create New" Placeholder Card */}
            <motion.button
              layout
              onClick={() => setIsCreateOpen(true)}
              className="group relative aspect-[4/3] rounded-2xl border-2 border-dashed border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all flex flex-col items-center justify-center gap-4"
            >
               <div className="h-16 w-16 rounded-full bg-zinc-100 group-hover:bg-emerald-100 text-zinc-400 group-hover:text-emerald-600 flex items-center justify-center transition-colors">
                  <Plus className="h-8 w-8" />
               </div>
               <span className="font-semibold text-zinc-500 group-hover:text-emerald-700">Create New Board</span>
            </motion.button>
          </div>
        ) : (
          <EmptyState onCreate={() => setIsCreateOpen(true)} />
        )}
      </main>

      {/* --- Create Modal --- */}
      <CreateBookModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateBook}
        isPending={createMutation.isPending}
      />

      <Footer />
    </div>
  );
}

// --- Component: Idea Book Card ---
function IdeaBookCard({ book, index }: { book: IdeaBookListItem; index: number }) {
  const previewUrls = (book.attachments ?? [])
    .slice(0, 3)
    .map((a) => a.asset?.cdnUrl ?? a.fileUrl ?? a.sourceUrl)
    .filter(Boolean) as string[];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group"
    >
      <Link href={getIdeaBookUrl(book.id)}>
        <Card className="h-full border-zinc-200 hover:border-emerald-500/50 hover:shadow-xl transition-all duration-300 overflow-hidden bg-white group-hover:-translate-y-1">
          
          {/* Collage Image Area */}
          <div className="aspect-[4/3] bg-zinc-100 grid grid-cols-3 gap-0.5 relative">
             {/* Large Main Image */}
             <div className="col-span-2 row-span-2 relative overflow-hidden bg-zinc-200">
               {previewUrls[0] ? (
                 <Image src={previewUrls[0]} alt="" fill className="object-cover transition-transform duration-700 group-hover:scale-105" />
               ) : (
                 <div className="h-full w-full flex items-center justify-center text-zinc-300">
                   <ImageIcon className="h-10 w-10" />
                 </div>
               )}
             </div>

             {/* Small Side Images */}
             <div className="relative overflow-hidden bg-zinc-200">
                {previewUrls[1] ? (
                   <Image src={previewUrls[1]} alt="" fill className="object-cover" />
                ) : <div className="h-full w-full bg-zinc-100" />}
             </div>
             <div className="relative overflow-hidden bg-zinc-200">
                {previewUrls[2] ? (
                   <Image src={previewUrls[2]} alt="" fill className="object-cover" />
                ) : <div className="h-full w-full bg-zinc-100" />}
             </div>

             {/* Item Count Badge */}
             <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 z-10">
                <LayoutGrid className="h-3 w-3" />
                {book.attachmentCount} Items
             </div>
          </div>

          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-zinc-900 text-lg group-hover:text-emerald-700 transition-colors">
                  {book.title}
                </h3>
                <p className="text-zinc-500 text-sm mt-1 line-clamp-1">{book.description ?? ""}</p>
                <p className="text-xs text-zinc-400 mt-3 flex items-center gap-1">
                  Updated {formatDistanceToNow(new Date(book.updatedAt), { addSuffix: true })}
                </p>
              </div>
              
              <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-900 -mr-2 -mt-2">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

// --- Component: Create Modal ---
function CreateBookModal({
  isOpen,
  onClose,
  onCreate,
  isPending = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (t: string, d: string) => void;
  isPending?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    onCreate(title, desc);
    setTitle("");
    setDesc("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-zinc-900">Create New Idea Book</h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-zinc-100">
                  <Plus className="h-5 w-5 rotate-45 text-zinc-500" />
                </Button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Title</label>
                  <Input 
                    placeholder="e.g. Master Bedroom, Garden Vibes" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                    className="bg-zinc-50 border-zinc-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Description (Optional)</label>
                  <Input 
                    placeholder="What's this collection about?" 
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    className="bg-zinc-50 border-zinc-200"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={!title || isPending}
                  >
                    {isPending ? "Creating..." : "Create Board"}
                  </Button>
                </div>
              </form>
            </div>
            <div className="bg-zinc-50 px-6 py-4 text-xs text-zinc-500 text-center border-t border-zinc-100">
               Idea Books are private by default. You can share them later.
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-zinc-200 rounded-2xl bg-white/50">
      <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
        <BookOpen className="h-10 w-10 text-emerald-500" />
      </div>
      <h3 className="text-xl font-bold text-zinc-900 mb-2">No Idea Books yet</h3>
      <p className="text-zinc-500 max-w-sm mb-8">
        Start collecting inspiration for your dream home. Save photos, products, and styles you love.
      </p>
      <Button onClick={onCreate} size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
        Create Your First Book
      </Button>
    </div>
  );
}

function IdeaBookSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-80 bg-white rounded-2xl border border-zinc-200 p-4 space-y-4">
          <Skeleton className="h-48 w-full rounded-lg bg-zinc-100" />
          <Skeleton className="h-6 w-3/4 bg-zinc-100" />
          <Skeleton className="h-4 w-1/2 bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}