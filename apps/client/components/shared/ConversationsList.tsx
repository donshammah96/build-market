"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { messagingClient } from "@/lib/messaging-client";
import type { Conversation } from "@repo/types";

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
}

export function ConversationsList({
  onSelectConversation,
  selectedId,
}: ConversationsListProps) {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const result = await messagingClient.getConversations();
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error("Failed to fetch conversations");
    },
    enabled: !!session,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Filter conversations by search query
  const filteredConversations = conversations?.filter((conv) => {
    // You might want to fetch user details and search by name
    return true; // Placeholder
  }) || [];

  // Get other user ID
  const getOtherUserId = (conv: Conversation) => {
    return conv.participants.find((id) => id !== session?.user?.id) || "";
  };

  // Get unread count for current user
  const getUnreadCount = (conv: Conversation) => {
    if (!session?.user?.id || !conv.unreadCount) return 0;
    const unreadData = conv.unreadCount as Record<string, number>;
    return unreadData[session.user.id] || 0;
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

  return (
    <Card className="h-[600px] flex flex-col">
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
        <ScrollArea className="h-full">
          {isLoading ? (
            // Loading skeleton
            <div className="p-2 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-3 w-[200px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <MessageSquare className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">No conversations yet</p>
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
                      onClick={() => onSelectConversation(conversation.id, otherUserId)}
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
                          <p className={`font-medium text-sm truncate ${unreadCount > 0 ? "font-semibold" : ""}`}>
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
                              <Badge variant="default" className="rounded-full h-5 min-w-5 px-1.5">
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
      </CardContent>
    </Card>
  );
}

