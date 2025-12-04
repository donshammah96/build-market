"use client";

import { useState, Suspense } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Search, MoreVertical, Phone, Video, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { ConversationsList } from "@/components/chat/ConversationsList";
import ChatWindow from "@/components/chat/ChatWindow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ROUTES } from "@/lib/links";

export default function MessagesPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleSelectConversation = (conversationId: string, otherUserId: string) => {
    setSelectedConversationId(conversationId);
    setSelectedUserId(otherUserId);
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col">
      <ClientNavbar />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-6 pt-24 max-w-7xl h-full flex flex-col">
        {/* Header (Optional, keeps context) */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Messages</h1>
            <p className="text-zinc-500 text-sm">Manage your communications with clients and pros.</p>
          </div>
          <Link href={ROUTES.userDashboard}>
            <Button variant="outline" size="sm" className="gap-2 text-zinc-600 hover:text-zinc-900">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="flex-1 grid md:grid-cols-12 gap-6 h-[calc(100vh-220px)] min-h-[600px]">
          
          {/* --- LEFT COLUMN: Conversations List --- */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="md:col-span-4 lg:col-span-3 h-full"
          >
            <Card className="h-full border-zinc-200 shadow-sm bg-white overflow-hidden flex flex-col">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-zinc-100 bg-white">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input 
                    type="text" 
                    placeholder="Search messages..." 
                    className="w-full pl-9 pr-4 py-2 bg-zinc-50 border-zinc-200 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
              
              {/* List Container */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <Suspense fallback={<ConversationsListSkeleton />}>
                  <ConversationsList
                    onSelectConversation={handleSelectConversation}
                    selectedId={selectedConversationId || undefined}
                  />
                </Suspense>
              </div>
            </Card>
          </motion.div>

          {/* --- RIGHT COLUMN: Chat Window --- */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="md:col-span-8 lg:col-span-9 h-full"
          >
            <Card className="h-full border-zinc-200 shadow-sm bg-white overflow-hidden flex flex-col relative">
              {selectedConversationId ? (
                <div className="flex flex-col h-full">
                  {/* Chat Header Overlay (Improves context) */}
                  <div className="h-16 border-b border-zinc-100 flex items-center justify-between px-6 bg-white z-10">
                    <div className="flex items-center gap-3">
                       <Avatar className="h-9 w-9 border border-zinc-100">
                          <AvatarFallback className="bg-emerald-100 text-emerald-700 font-medium">
                            {selectedUserId ? 'U' : '#'}
                          </AvatarFallback>
                       </Avatar>
                       <div>
                          <h3 className="font-semibold text-zinc-900 text-sm">
                            {selectedUserId ? `User ${selectedUserId.slice(0, 8)}` : "Chat"}
                          </h3>
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs text-zinc-500">Active now</span>
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-1">
                       <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-emerald-600">
                          <Phone className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-emerald-600">
                          <Video className="h-4 w-4" />
                       </Button>
                       <Separator orientation="vertical" className="h-6 mx-1 bg-zinc-200" />
                       <Button variant="ghost" size="icon" className="text-zinc-400">
                          <MoreVertical className="h-4 w-4" />
                       </Button>
                    </div>
                  </div>

                  {/* Actual Chat Component */}
                  <div className="flex-1 overflow-hidden relative">
                    <Suspense fallback={<ChatWindowSkeleton />}>
                      <ChatWindow
                        conversationId={selectedConversationId}
                        otherUserId={selectedUserId || undefined}
                        otherUserName={selectedUserId ? `User ${selectedUserId.slice(0, 8)}` : "User"}
                      />
                    </Suspense>
                  </div>
                </div>
              ) : (
                <EmptyChatState />
              )}
            </Card>
          </motion.div>
        </div>
      </main>

      {/* Footer is optional on chat apps, but keeping for consistency */}
      <div className="hidden md:block">
         <Footer />
      </div>
    </div>
  );
}

// --- Sub-Components & Skeletons ---

function EmptyChatState() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-zinc-50/50 p-8 text-center">
      <div className="h-20 w-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-6">
        <MessageSquare className="h-10 w-10 text-emerald-600" />
      </div>
      <h3 className="text-xl font-bold text-zinc-900 mb-2">Your Messages</h3>
      <p className="text-zinc-500 max-w-sm mb-8 leading-relaxed">
        Select a conversation from the sidebar to view your message history or start a new chat with a professional.
      </p>
      <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
        Start New Conversation
      </Button>
    </div>
  );
}

function ConversationsListSkeleton() {
  return (
    <div className="divide-y divide-zinc-100">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-full bg-zinc-200" />
          <div className="space-y-2 flex-1">
            <div className="flex justify-between">
               <Skeleton className="h-4 w-[100px] bg-zinc-200" />
               <Skeleton className="h-3 w-[40px] bg-zinc-100" />
            </div>
            <Skeleton className="h-3 w-[160px] bg-zinc-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatWindowSkeleton() {
  return (
    <div className="h-full p-6 flex flex-col space-y-8 bg-white">
      <div className="flex justify-start">
        <div className="space-y-2">
            <Skeleton className="h-12 w-[280px] rounded-2xl rounded-tl-none bg-zinc-100" />
            <Skeleton className="h-4 w-[100px] bg-zinc-50" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="space-y-2 flex flex-col items-end">
            <Skeleton className="h-16 w-[320px] rounded-2xl rounded-tr-none bg-emerald-50" />
            <Skeleton className="h-4 w-[80px] bg-zinc-50" />
        </div>
      </div>
      <div className="flex justify-start">
        <div className="space-y-2">
            <Skeleton className="h-24 w-[300px] rounded-2xl rounded-tl-none bg-zinc-100" />
        </div>
      </div>
      <div className="mt-auto pt-4 border-t border-zinc-100">
        <Skeleton className="h-12 w-full rounded-full bg-zinc-100" />
      </div>
    </div>
  );
}