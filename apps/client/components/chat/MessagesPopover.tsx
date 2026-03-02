"use client";

import { useState } from "react";
import { MessageSquare, Loader2, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { messagingClient } from "@/lib/messaging-client";
import { useUser } from "@clerk/nextjs";
import type { Conversation } from "@build/types";
import { useProfileStatus } from "@/hooks/useProfileStatus";
import { getOtherParticipantId } from "@/hooks/useMessaging";

export function MessagesPopover() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { user } = useUser();
  const { user: profileUser } = useProfileStatus();
  const currentUserDbId = profileUser?.id ?? "";

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const result = await messagingClient.getConversations();
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error("Failed to fetch conversations");
    },
    enabled: !!user,
    // Refetch every minute to keep messages fresh
    refetchInterval: 60000,
  });

  const getUnreadCount = () => {
    if (!conversations || !currentUserDbId) return 0;
    return conversations.reduce((acc, conv) => {
      const count =
        (conv.unreadCount as Record<string, number>)?.[currentUserDbId] || 0;
      return acc + count;
    }, 0);
  };

  const unreadCount = getUnreadCount();

  const handleConversationClick = (conversationId: string) => {
    setOpen(false);
    router.push(
      `/professional-portal/messages?conversationId=${conversationId}`,
    );
  };

  const handleViewAllAndRedirect = () => {
    setOpen(false);
    router.push("/professional-portal/messages");
  };

  // Helper to get conversation partner info (uses db user IDs)
  const getPartnerInfo = (conv: Conversation) => {
    const partnerId = getOtherParticipantId(conv, currentUserDbId) || "?";
    return {
      name: `User ${partnerId.slice(0, 8)}`,
      initials: partnerId.slice(0, 2).toUpperCase() || "?",
    };
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-500 hover:text-zinc-900 relative"
        >
          <MessageSquare className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-emerald-500 rounded-full border border-white" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <h4 className="font-semibold text-sm">Messages</h4>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-20 text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : conversations?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-500 text-sm px-4 text-center">
              <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
              <p>No messages yet</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {conversations?.slice(0, 5).map((conv) => {
                const partner = getPartnerInfo(conv);
                const isUnread =
                  ((conv.unreadCount as Record<string, number>)?.[
                    currentUserDbId
                  ] || 0) > 0;

                return (
                  <button
                    key={conv.id}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors flex gap-3",
                      isUnread && "bg-emerald-50/30",
                    )}
                    onClick={() => handleConversationClick(conv.id)}
                  >
                    <Avatar className="h-9 w-9 border border-zinc-100">
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="text-xs bg-zinc-100 text-zinc-600">
                        {partner.initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-sm font-medium truncate",
                            isUnread ? "text-zinc-900" : "text-zinc-700",
                          )}
                        >
                          {partner.name}
                        </span>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] text-zinc-400">
                            {formatDistanceToNow(new Date(conv.lastMessageAt), {
                              addSuffix: false,
                            })}
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          "text-xs line-clamp-1",
                          isUnread
                            ? "text-zinc-800 font-medium"
                            : "text-zinc-500",
                        )}
                      >
                        {conv.lastMessage || "No messages"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t border-zinc-100">
          <Button
            variant="ghost"
            className="w-full text-xs h-8 text-zinc-500 hover:text-zinc-900 justify-between"
            onClick={handleViewAllAndRedirect}
          >
            View All Messages
            <ArrowRight className="h-3 w-3 ml-2" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
