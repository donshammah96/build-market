"use client";

import { useState, Suspense } from "react";
import { ConversationsList } from "@/components/shared/ConversationsList";
import ChatWindow from "@/components/shared/ChatWindow";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

function ConversationsListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-3 w-[180px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatWindowSkeleton() {
  return (
    <div className="h-[600px] border rounded-lg p-4 flex flex-col">
      <div className="flex items-center gap-4 border-b pb-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-5 w-[150px]" />
      </div>
      <div className="flex-1 py-4 space-y-4">
        <div className="flex justify-start"><Skeleton className="h-10 w-[200px] rounded-lg" /></div>
        <div className="flex justify-end"><Skeleton className="h-10 w-[200px] rounded-lg" /></div>
        <div className="flex justify-start"><Skeleton className="h-16 w-[250px] rounded-lg" /></div>
      </div>
      <div className="pt-4 border-t">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleSelectConversation = (conversationId: string, otherUserId: string) => {
    setSelectedConversationId(conversationId);
    setSelectedUserId(otherUserId);
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="grid md:grid-cols-3 gap-4">
        {/* Conversations List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="md:col-span-1"
        >
          <Suspense fallback={<ConversationsListSkeleton />}>
            <ConversationsList
              onSelectConversation={handleSelectConversation}
              selectedId={selectedConversationId || undefined}
            />
          </Suspense>
        </motion.div>

        {/* Chat Window */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="md:col-span-2"
        >
          {selectedConversationId ? (
            <Suspense fallback={<ChatWindowSkeleton />}>
              <ChatWindow
                conversationId={selectedConversationId}
                otherUserId={selectedUserId || undefined}
                otherUserName={selectedUserId ? `User ${selectedUserId.slice(0, 8)}` : "User"}
              />
            </Suspense>
          ) : (
            <div className="h-[600px] border rounded-lg flex items-center justify-center bg-muted/20">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <p className="text-muted-foreground font-medium">Select a conversation</p>
                <p className="text-sm text-muted-foreground">
                  Choose a conversation from the list to start messaging
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

