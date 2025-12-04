"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  BookOpen, 
  MoreVertical, 
  Image as ImageIcon, 
  Share2, 
  Lock, 
  Trash2, 
  Edit3,
  Search,
  LayoutGrid
} from "lucide-react";

import { Navbar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// --- Types based on Prisma Schema ---
// In a real app, 'items' would be parsed from JSON
interface IdeaBookItem {
  id: string;
  imageUrl: string;
}

interface IdeaBook {
  id: string;
  title: string;
  description: string;
  items: IdeaBookItem[]; // Mocking the JSONB field
  createdAt: string;
  itemCount: number;
}

export default function IdeaBooksPage() {
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<IdeaBook[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    // Simulate API Fetch
    const timer = setTimeout(() => {
      setBooks(MOCK_IDEA_BOOKS);
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleCreateBook = (title: string, description: string) => {
    // Mock Backend Call
    const newBook: IdeaBook = {
      id: `ib_${Date.now()}`,
      title,
      description,
      items: [],
      itemCount: 0,
      createdAt: "Just now",
    };
    setBooks([newBook, ...books]);
    setIsCreateOpen(false);
  };

  const filteredBooks = books.filter(book => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col">
      <Navbar />

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
        {loading ? (
          <IdeaBookSkeleton />
        ) : filteredBooks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
            <AnimatePresence mode="popLayout">
              {filteredBooks.map((book, index) => (
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
      />

      <Footer />
    </div>
  );
}

// --- Component: Idea Book Card ---
function IdeaBookCard({ book, index }: { book: IdeaBook; index: number }) {
  // Logic to display preview grid (collage)
  const previews = book.items.slice(0, 3);
  const emptySlots = 3 - previews.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group"
    >
      <Link href={`/idea-books/${book.id}`}>
        <Card className="h-full border-zinc-200 hover:border-emerald-500/50 hover:shadow-xl transition-all duration-300 overflow-hidden bg-white group-hover:-translate-y-1">
          
          {/* Collage Image Area */}
          <div className="aspect-[4/3] bg-zinc-100 grid grid-cols-3 gap-0.5 relative">
             {/* Large Main Image */}
             <div className="col-span-2 row-span-2 relative overflow-hidden bg-zinc-200">
               {previews[0] ? (
                 <img src={previews[0].imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
               ) : (
                 <div className="h-full w-full flex items-center justify-center text-zinc-300">
                   <ImageIcon className="h-10 w-10" />
                 </div>
               )}
             </div>

             {/* Small Side Images */}
             <div className="relative overflow-hidden bg-zinc-200">
                {previews[1] ? (
                   <img src={previews[1].imageUrl} alt="" className="h-full w-full object-cover" />
                ) : <div className="h-full w-full bg-zinc-100" />}
             </div>
             <div className="relative overflow-hidden bg-zinc-200">
                {previews[2] ? (
                   <img src={previews[2].imageUrl} alt="" className="h-full w-full object-cover" />
                ) : <div className="h-full w-full bg-zinc-100" />}
             </div>

             {/* Item Count Badge */}
             <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 z-10">
                <LayoutGrid className="h-3 w-3" />
                {book.itemCount} Items
             </div>
          </div>

          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-zinc-900 text-lg group-hover:text-emerald-700 transition-colors">
                  {book.title}
                </h3>
                <p className="text-zinc-500 text-sm mt-1 line-clamp-1">{book.description}</p>
                <p className="text-xs text-zinc-400 mt-3 flex items-center gap-1">
                  Updated {book.createdAt}
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
function CreateBookModal({ isOpen, onClose, onCreate }: { isOpen: boolean; onClose: () => void; onCreate: (t: string, d: string) => void }) {
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
                  <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!title}>
                    Create Board
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
  )
}

// --- Mock Data ---
const MOCK_IDEA_BOOKS: IdeaBook[] = [
  {
    id: "ib_1",
    title: "Modern Kitchens",
    description: "Minimalist styles with marble countertops",
    itemCount: 12,
    createdAt: "2 days ago",
    items: [
       { id: "1", imageUrl: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80" },
       { id: "2", imageUrl: "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?auto=format&fit=crop&w=800&q=80" },
       { id: "3", imageUrl: "https://images.unsplash.com/photo-1484154218962-a1c002085d2f?auto=format&fit=crop&w=800&q=80" },
    ]
  },
  {
    id: "ib_2",
    title: "Outdoor Spaces",
    description: "Landscaping ideas for the backyard",
    itemCount: 8,
    createdAt: "1 week ago",
    items: [
       { id: "4", imageUrl: "https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=800&q=80" },
       { id: "5", imageUrl: "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=800&q=80" },
    ]
  },
  {
    id: "ib_3",
    title: "Dream Bathroom",
    description: "Spa-like vibes",
    itemCount: 5,
    createdAt: "3 weeks ago",
    items: [
       { id: "6", imageUrl: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=800&q=80" }
    ]
  }
];