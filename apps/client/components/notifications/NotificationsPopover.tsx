"use client";

import { useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  useNotifications,
  useMarkNotificationRead,
} from "@/hooks/useNotifications";
import type { NotificationListItem } from "@/lib/notifications-client";

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { data, isLoading } = useNotifications({
    limit: 20,
    unreadOnly: false,
  });
  const markAsReadMutation = useMarkNotificationRead();

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleNotificationClick = (notification: NotificationListItem) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate({ id: notification.id });
    }
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

  const handleMarkAllRead = () => {
    markAsReadMutation.mutate({ id: "all" });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-500 hover:text-zinc-900 relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-red-500 rounded-full border border-white" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900"
              onClick={handleMarkAllRead}
              disabled={markAsReadMutation.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-20 text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : notifications?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-500 text-sm px-4 text-center">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {notifications?.map((notification) => (
                <button
                  key={notification.id}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors flex gap-3",
                    !notification.isRead && "bg-blue-50/30",
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div
                    className={cn(
                      "h-2 w-2 mt-1.5 rounded-full flex-shrink-0",
                      !notification.isRead ? "bg-blue-500" : "bg-transparent",
                    )}
                  />
                  <div className="flex-1 space-y-1">
                    <p
                      className={cn(
                        "text-sm font-medium leading-none",
                        !notification.isRead
                          ? "text-zinc-900"
                          : "text-zinc-600",
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="text-xs text-zinc-500 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
