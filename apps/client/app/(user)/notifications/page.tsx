"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  CheckCircle2,
  Package,
  MessageSquare,
  Calendar,
  AlertCircle,
  Clock,
  Check,
} from "lucide-react";

import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useMarkNotificationRead,
} from "@/hooks/useNotifications";
import type { NotificationListItem } from "@/lib/facades/notifications-client";

type NotificationTypeKey =
  | "order"
  | "message"
  | "project"
  | "system"
  | "alert"
  | "default";

function mapApiTypeToKey(type: string): NotificationTypeKey {
  const map: Record<string, NotificationTypeKey> = {
    PROJECT: "project",
    MESSAGE: "message",
    PAYMENT: "order",
    SYSTEM: "system",
    ALERT: "alert",
    LEAD: "project",
  };
  return map[type] ?? "default";
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useNotifications({
    unreadOnly: filter === "unread",
    limit: 50,
  });
  const markReadMutation = useMarkNotificationRead();

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleMarkAllRead = () => {
    markReadMutation.mutate({ id: "all" });
  };

  const handleMarkAsRead = (id: string) => {
    markReadMutation.mutate({ id, isRead: true });
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col">
      <ClientNavbar />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-8 pt-24 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight flex items-center gap-3">
              Notifications
              {unreadCount > 0 && (
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 h-6 px-2 rounded-full text-xs">
                  {unreadCount} new
                </Badge>
              )}
            </h1>
            <p className="text-zinc-500 mt-1">
              Stay updated on your projects, orders, and messages.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-white border border-zinc-200 rounded-lg p-1 flex">
              <button
                onClick={() => setFilter("all")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                  filter === "all"
                    ? "bg-zinc-100 text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700",
                )}
              >
                All
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                  filter === "unread"
                    ? "bg-zinc-100 text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700",
                )}
              >
                Unread
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-9 border-zinc-200 text-zinc-600 hover:text-emerald-600 hover:border-emerald-200"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || markReadMutation.isPending}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {isLoading ? (
            <NotificationsSkeleton />
          ) : notifications.length > 0 ? (
            <AnimatePresence>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => handleMarkAsRead(notification.id)}
                />
              ))}
            </AnimatePresence>
          ) : (
            <EmptyState />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// --- Sub-Components ---

function NotificationItem({
  notification,
  onRead,
}: {
  notification: NotificationListItem;
  onRead: () => void;
}) {
  const typeKey = mapApiTypeToKey(notification.type);
  const getIcon = (type: NotificationTypeKey) => {
    switch (type) {
      case "order":
        return <Package className="h-5 w-5 text-blue-600" />;
      case "message":
        return <MessageSquare className="h-5 w-5 text-indigo-600" />;
      case "project":
        return <Calendar className="h-5 w-5 text-emerald-600" />;
      case "alert":
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      default:
        return <Bell className="h-5 w-5 text-zinc-600" />;
    }
  };

  const getBackground = (type: NotificationTypeKey) => {
    switch (type) {
      case "order":
        return "bg-blue-50 border-blue-100";
      case "message":
        return "bg-indigo-50 border-indigo-100";
      case "project":
        return "bg-emerald-50 border-emerald-100";
      case "alert":
        return "bg-amber-50 border-amber-100";
      default:
        return "bg-zinc-50 border-zinc-100";
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative p-4 rounded-xl border transition-all duration-200",
        notification.isRead
          ? "bg-white border-zinc-200"
          : "bg-white border-emerald-200 shadow-sm ring-1 ring-emerald-500/10",
      )}
    >
      <div className="flex gap-4">
        <div
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0 border",
            getBackground(typeKey),
          )}
        >
          {getIcon(typeKey)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3
                className={cn(
                  "text-sm font-semibold",
                  notification.isRead ? "text-zinc-700" : "text-zinc-900",
                )}
              >
                {notification.title}
              </h3>
              <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
                {notification.message}
              </p>
            </div>
            {!notification.isRead && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-emerald-600 -mr-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={onRead}
                title="Mark as read"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center text-xs text-zinc-400">
              <Clock className="h-3 w-3 mr-1" />
              {formatDistanceToNow(new Date(notification.createdAt), {
                addSuffix: true,
              })}
            </span>
            {notification.link && (
              <a
                href={notification.link}
                className="text-xs font-medium text-emerald-600 hover:underline"
              >
                View Details
              </a>
            )}
          </div>
        </div>
      </div>

      {!notification.isRead && (
        <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-emerald-500" />
      )}
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
        <Bell className="h-8 w-8 text-zinc-300" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-900">All caught up!</h3>
      <p className="text-zinc-500 max-w-sm mt-1">
        You have no new notifications at the moment. Check back later for
        updates on your projects.
      </p>
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-zinc-200 bg-white flex gap-4"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
