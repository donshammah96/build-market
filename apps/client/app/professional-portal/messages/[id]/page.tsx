"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Loader2,
  Trash2,
  AlertCircle,
  Clock,
  Building2,
  ExternalLink,
  Users,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useConversation,
  useMessages,
  useDeleteConversation,
} from "@/hooks/useMessaging";
import { useProfileStatus } from "@/hooks/useProfileStatus";

interface ConversationDetail {
  id: string;
  participants: string[]; // Keep as string array to match Conversation type
  lastMessage?: string | null;
  lastMessageAt?: Date | null;
  unreadCount?: Record<string, number>;
  projectId?: string;
  createdAt: Date;
  updatedAt: Date;
  project?: {
    id: string;
    title: string;
    status?: string;
  } | null;
  messageCount?: number;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { user: profileUser } = useProfileStatus();
  const id = params.id as string;
  const currentUserDbId = profileUser?.id ?? "";
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Fetch conversation
  const {
    data: conversationData,
    isLoading,
    error,
  } = useConversation(id, !!id && !!user);

  // Fetch messages for statistics
  const { data: messagesData } = useMessages({
    conversationId: id,
    limit: 1000,
    enabled: !!id && !!user,
  });

  const conversation = useMemo((): ConversationDetail | undefined => {
    if (!conversationData) return undefined;
    const rawParticipants = (conversationData as { participants?: unknown[] })
      .participants;
    const participantIds = (
      Array.isArray(rawParticipants) ? rawParticipants : []
    ).map((p: unknown) =>
      typeof p === "string" ? p : ((p as { userId?: string }).userId ?? ""),
    );
    return {
      ...conversationData,
      participants: participantIds,
      messageCount: messagesData?.items?.length ?? 0,
    } as ConversationDetail;
  }, [conversationData, messagesData?.items?.length]);

  // Delete conversation
  const deleteConversationMutation = useDeleteConversation({
    onSuccess: () => {
      toast.success("Conversation deleted successfully");
      router.push("/professional-portal/messages");
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete conversation",
      );
    },
  });

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!messagesData?.items) {
      return {
        totalMessages: 0,
        unreadMessages: 0,
        firstMessageDate: null,
        lastMessageDate: null,
      };
    }

    const messages = messagesData.items || [];
    const unreadCount =
      conversation?.unreadCount && currentUserDbId
        ? ((conversation.unreadCount as Record<string, number>)[
            currentUserDbId
          ] ?? 0)
        : 0;

    return {
      totalMessages: messages.length,
      unreadMessages: unreadCount,
      firstMessageDate:
        messages.length > 0 && messages[0]
          ? new Date(messages[0].createdAt)
          : null,
      lastMessageDate: conversation?.lastMessageAt
        ? new Date(conversation.lastMessageAt)
        : null,
    };
  }, [messagesData, conversation, currentUserDbId]);

  const handleDelete = () => {
    deleteConversationMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-zinc-200 animate-pulse rounded" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-zinc-200 animate-pulse rounded" />
            <div className="h-4 w-32 bg-zinc-200 animate-pulse rounded" />
          </div>
        </div>
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <span className="ml-3 text-zinc-500">Loading conversation...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <Button variant="ghost" asChild>
          <Link href="/professional-portal/messages">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Messages
          </Link>
        </Button>
        <Card className="p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Conversation Not Found
            </h2>
            <p className="text-zinc-500 mb-4">
              {error instanceof Error
                ? error.message
                : "The conversation you're looking for doesn't exist."}
            </p>
            <Button asChild>
              <Link href="/professional-portal/messages">Back to Messages</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start border-b border-zinc-100 pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/professional-portal/messages">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
                Conversation Details
              </h1>
              {statistics.unreadMessages > 0 && (
                <Badge variant="default" className="bg-blue-600">
                  {statistics.unreadMessages} unread
                </Badge>
              )}
            </div>
            <p className="text-zinc-500 mt-1">
              Conversation #{conversation.id.substring(0, 8).toUpperCase()} •
              Created {new Date(conversation.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="border-zinc-200">
            <Link href={`/professional-portal/messages?conversationId=${id}`}>
              <MessageSquare className="mr-2 h-4 w-4" /> Open Chat
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsDeleteOpen(true)}
            disabled={deleteConversationMutation.isPending}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            {deleteConversationMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Conversation Information */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Conversation Information
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Total Messages
                  </label>
                  <p className="text-2xl font-bold text-zinc-900">
                    {statistics.totalMessages}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last Message
                  </label>
                  <p className="text-zinc-900 font-medium">
                    {statistics.lastMessageDate
                      ? new Date(statistics.lastMessageDate).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : "No messages yet"}
                  </p>
                </div>
              </div>

              {conversation.lastMessage && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block">
                      Last Message Preview
                    </label>
                    <p className="text-zinc-900 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                      {conversation.lastMessage}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created
                  </label>
                  <p className="text-zinc-900">
                    {new Date(conversation.createdAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Last Updated
                  </label>
                  <p className="text-zinc-900">
                    {new Date(conversation.updatedAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
              </div>

              {statistics.firstMessageDate && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      First Message
                    </label>
                    <p className="text-zinc-900">
                      {statistics.firstMessageDate.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Participants */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {conversation.participants &&
              conversation.participants.length > 0 ? (
                conversation.participants.map((participantId) => {
                  const isCurrentUser = participantId === currentUserDbId;
                  return (
                    <div
                      key={participantId}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 transition-colors"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={undefined} />
                        <AvatarFallback>
                          {participantId.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-900 truncate">
                          {isCurrentUser
                            ? "You"
                            : `User ${participantId.substring(0, 8)}`}
                        </p>
                        {isCurrentUser && (
                          <p className="text-xs text-zinc-500">Current user</p>
                        )}
                      </div>
                      {isCurrentUser && (
                        <Badge variant="outline" className="text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500 text-center py-4">
                  No participants found
                </p>
              )}
            </div>
          </Card>

          {/* Related Project */}
          {conversation.project && (
            <Card className="border border-zinc-200 shadow-sm bg-white">
              <div className="p-6 border-b border-zinc-100">
                <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Related Project
                </h2>
              </div>
              <div className="p-6">
                <p className="font-semibold text-zinc-900 mb-2">
                  {conversation.project.title}
                </p>
                {conversation.project.status && (
                  <Badge variant="outline" className="mb-3">
                    {conversation.project.status}
                  </Badge>
                )}
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link
                    href={`/professional-portal/projects/${conversation.project.id}`}
                  >
                    View Project
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </Card>
          )}

          {/* Statistics */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900">
                Statistics
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Total Messages</span>
                <span className="font-semibold text-zinc-900">
                  {statistics.totalMessages}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Unread Messages</span>
                <Badge
                  variant={
                    statistics.unreadMessages > 0 ? "default" : "outline"
                  }
                  className={statistics.unreadMessages > 0 ? "bg-blue-600" : ""}
                >
                  {statistics.unreadMessages}
                </Badge>
              </div>
              {statistics.firstMessageDate && statistics.lastMessageDate && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500">Duration</span>
                    <span className="font-semibold text-zinc-900 text-xs">
                      {Math.ceil(
                        (statistics.lastMessageDate.getTime() -
                          statistics.firstMessageDate.getTime()) /
                          (1000 * 60 * 60 * 24),
                      )}{" "}
                      days
                    </span>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action
              cannot be undone. All messages in this conversation will be
              permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConversationMutation.isPending}
            >
              {deleteConversationMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
