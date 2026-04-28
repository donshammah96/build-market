"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { useConversations, getOtherParticipantId } from "@/hooks/useMessaging";
import { useProfileStatus } from "@/hooks/useProfileStatus";
import type { Conversation } from "@build/types";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Icons
import { Search, MessageSquare, Plus } from "lucide-react";

interface ConversationsListProps {
  onSelectConversation: (conversationId: string, otherUserId: string) => void;
  selectedId?: string;
  /** When true, renders only the list content (no Card wrapper) for embedding in parent layout */
  embedded?: boolean;
  /** Optional: parent-controlled search (used when embedded) */
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}

export function ConversationsList({
  onSelectConversation,
  selectedId,
  embedded = false,
  searchQuery: externalSearch,
  onSearchChange,
}: ConversationsListProps) {
  const { user } = useUser();
  const { user: profileUser } = useProfileStatus();
  const [internalSearch, setInternalSearch] = useState("");
  const searchQuery =
    externalSearch !== undefined ? externalSearch : internalSearch;
  const setSearchQuery = onSearchChange ?? setInternalSearch;

  const currentUserDbId = profileUser?.id ?? "";

  const { data: conversations = [], isLoading } = useConversations(!!user);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      conv.lastMessage?.toLowerCase().includes(q) ||
      conv.subject?.toLowerCase().includes(q)
    );
  });

  // Get other participant ID (uses db user IDs from service)
  const getOtherUserId = (conv: Conversation) =>
    getOtherParticipantId(conv, currentUserDbId);

  // Get unread count for current user (keyed by db userId)
  const getUnreadCount = (conv: Conversation) => {
    if (!currentUserDbId || !conv.unreadCount) return 0;
    const unreadData = conv.unreadCount as Record<string, number>;
    return unreadData[currentUserDbId] ?? 0;
  };

  // Format timestamp
  const formatTime = (date?: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return d.toLocaleDateString([], { weekday: "short" });
    } else {
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const listContent = (
    <ScrollArea className="h-full">
      {isLoading ? (
        // Loading skeleton
        <div className="p-2 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-37.5" />
                <Skeleton className="h-3 w-50" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredConversations.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <MessageSquare className="w-16 h-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">
            No conversations yet
          </p>
          <p className="text-sm text-muted-foreground">
            Start a new conversation to get started
          </p>
        </div>
      ) : (
        // Conversations list
        <AnimatePresence initial={false}>
          {filteredConversations.map((conversation, index) => {
            const otherUserId = getOtherUserId(conversation);
            const unreadCount = getUnreadCount(conversation);
            const isSelected = selectedId === conversation.id;

            return (
              <motion.div
                key={conversation.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <motion.button
                  whileHover={{ backgroundColor: "rgba(0,0,0,0.05)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    onSelectConversation(conversation.id, otherUserId)
                  }
                  className={`w-full p-3 border-b flex items-center gap-3 text-left transition-colors ${
                    isSelected ? "bg-accent" : ""
                  }`}
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={undefined} alt="User" />
                    <AvatarFallback>
                      {otherUserId.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p
                        className={`font-medium text-sm truncate ${unreadCount > 0 ? "font-semibold" : ""}`}
                      >
                        User {otherUserId.slice(0, 8)}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-sm truncate ${
                          unreadCount > 0
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {conversation.lastMessage || "No messages yet"}
                      </p>
                      {unreadCount > 0 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="shrink-0"
                        >
                          <Badge
                            variant="default"
                            className="rounded-full h-5 min-w-5 px-1.5"
                          >
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Badge>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </ScrollArea>
  );

  if (embedded) {
    return listContent;
  }

  return (
    <Card className="h-150 flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Messages
          </CardTitle>
          <Button size="icon" variant="ghost">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        {listContent}
      </CardContent>
    </Card>
  );
}
