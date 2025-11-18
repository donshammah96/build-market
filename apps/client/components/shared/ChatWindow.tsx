"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { messagingClient } from "@/lib/messaging-client";
import type { Message, Conversation } from "@repo/types";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

// Icons
import {
  Send,
  Loader2,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Paperclip,
} from "lucide-react";

interface ChatWindowProps {
  conversationId: string;
  otherUserId?: string;
  otherUserName?: string;
  otherUserAvatar?: string;
}

export default function ChatWindow({
  conversationId,
  otherUserId,
  otherUserName = "User",
  otherUserAvatar,
}: ChatWindowProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch conversation details
  const { data: conversation } = useQuery<Conversation>({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const result = await messagingClient.getConversation(conversationId);
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error || "Failed to fetch conversation");
    },
    enabled: !!conversationId,
  });

  // Fetch messages with pagination
  const {
    data: messagesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const result = await messagingClient.getMessages(conversationId, 1, 100);
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error("Failed to fetch messages");
    },
    enabled: !!conversationId,
    refetchOnWindowFocus: false,
  });

  const messages = messagesData?.items || [];

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!session?.user?.id) {
        throw new Error("User not authenticated");
      }
      const result = await messagingClient.sendMessage({
        conversationId,
        senderId: session.user.id,
        content,
        type: "text",
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to send message");
      }
      return result.data;
    },
    onMutate: async (content) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["messages", conversationId] });
      const previousMessages = queryClient.getQueryData(["messages", conversationId]);

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        conversationId,
        senderId: session?.user?.id || "",
        content,
        type: "text",
        readBy: [session?.user?.id || ""],
        attachments: [],
        encrypted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queryClient.setQueryData(["messages", conversationId], (old: any) => ({
        ...old,
        items: [...(old?.items || []), optimisticMessage],
      }));

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", conversationId], context.previousMessages);
      }
      toast({
        variant: "destructive",
        title: "Failed to send message",
        description: err instanceof Error ? err.message : "Please try again",
      });
    },
    onSuccess: () => {
      // Refetch to get real message with ID
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // Mark conversation as read
  const markAsReadMutation = useMutation({
    mutationFn: () =>
      messagingClient.markConversationAsRead(conversationId, {
        userId: session?.user?.id,
      }),
  });

  // WebSocket setup
  useEffect(() => {
    if (!session?.accessToken) return;

    const SOCKET_URL = process.env.NEXT_PUBLIC_MESSAGING_SERVICE_URL || "http://localhost:3010";
    const newSocket = io(SOCKET_URL, {
      auth: {
        token: session.accessToken,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected");
      newSocket.emit("join:conversation", conversationId);
    });

    newSocket.on("authenticated", (data: { userId: string; conversationCount: number }) => {
      console.log("Socket authenticated:", data);
    });

    // New message received
    newSocket.on("message:new", ({ message }: { message: Message; conversation: Conversation }) => {
      queryClient.setQueryData(["messages", conversationId], (old: any) => ({
        ...old,
        items: [...(old?.items || []), message],
      }));

      // Play notification sound (optional)
      if (message.senderId !== session.user?.id) {
        // new Audio('/notification.mp3').play().catch(() => {});
      }
    });

    // Typing indicators
    newSocket.on("typing:start", ({ userId }: { conversationId: string; userId: string }) => {
      if (userId !== session.user?.id) {
        setOtherUserTyping(true);
      }
    });

    newSocket.on("typing:stop", ({ userId }: { conversationId: string; userId: string }) => {
      if (userId !== session.user?.id) {
        setOtherUserTyping(false);
      }
    });

    // Messages marked as read
    newSocket.on("messages:read", ({ userId }: { conversationId: string; userId: string }) => {
      if (userId !== session.user?.id) {
        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      }
    });

    newSocket.on("error", ({ message }: { message: string }) => {
      console.error("Socket error:", message);
      toast({
        variant: "destructive",
        title: "Connection error",
        description: message,
      });
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit("leave:conversation", conversationId);
      newSocket.disconnect();
    };
  }, [session?.accessToken, conversationId, queryClient, toast, session?.user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Mark as read when viewing
  useEffect(() => {
    if (messages.length > 0 && session?.user?.id) {
      markAsReadMutation.mutate();
    }
  }, [messages.length, session?.user?.id]);

  // Handle typing
  const handleTyping = (value: string) => {
    setNewMessage(value);

    if (!socket || !session?.user?.id) return;

    // Emit typing start
    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
      socket.emit("typing:start", {
        conversationId,
        userId: session.user.id,
      });
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Emit typing stop after 2 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("typing:stop", {
        conversationId,
        userId: session.user.id,
      });
    }, 2000);
  };

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || sendMutation.isPending) return;

    const messageToSend = newMessage.trim();
    setNewMessage("");
    inputRef.current?.focus();

    // Stop typing indicator
    if (socket && session?.user?.id) {
      socket.emit("typing:stop", {
        conversationId,
        userId: session.user.id,
      });
      setIsTyping(false);
    }

    await sendMutation.mutateAsync(messageToSend);
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if message is read by other user
  const isMessageRead = (message: Message) => {
    return message.readBy.some((id) => id !== session?.user?.id);
  };

  if (error) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-2">Failed to load conversation</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["messages", conversationId] })}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      {/* Header */}
      <CardHeader className="border-b py-3">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={otherUserAvatar} alt={otherUserName} />
            <AvatarFallback>{getInitials(otherUserName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-lg">{otherUserName}</CardTitle>
            <AnimatePresence mode="wait">
              {otherUserTyping && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs text-muted-foreground"
                >
                  typing...
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <Badge variant="outline" className="text-xs">
            {messages.length} messages
          </Badge>
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-4 space-y-4">
            {isLoading ? (
              // Loading skeleton
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-4 w-[150px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="text-6xl mb-4">💬</div>
                <p className="text-muted-foreground">No messages yet</p>
                <p className="text-sm text-muted-foreground">Send a message to start the conversation</p>
              </div>
            ) : (
              // Messages list
              <AnimatePresence initial={false}>
                {messages.map((message: Message, index: number) => {
                  const isOwn = message.senderId === session?.user?.id;
                  const showAvatar = index === 0 || messages[index - 1]?.senderId !== message.senderId;
                  const isRead = isMessageRead(message);

                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={`flex gap-2 ${isOwn ? "justify-end" : "justify-start"}`}
                    >
                      {!isOwn && showAvatar && (
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={otherUserAvatar} alt={otherUserName} />
                          <AvatarFallback className="text-xs">
                            {getInitials(otherUserName)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {!isOwn && !showAvatar && <div className="w-8" />}

                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className={`max-w-[70%] ${isOwn ? "order-1" : "order-2"}`}
                      >
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm break-words">{message.content}</p>
                        </div>
                        <div className={`flex items-center gap-1 mt-1 px-2 ${isOwn ? "justify-end" : "justify-start"}`}>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isOwn && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.1 }}
                            >
                              {isRead ? (
                                <CheckCheck className="w-3 h-3 text-blue-500" />
                              ) : (
                                <Check className="w-3 h-3 text-muted-foreground" />
                              )}
                            </motion.div>
                          )}
                        </div>
                      </motion.div>

                      {isOwn && showAvatar && (
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={session?.user?.image || undefined} alt="You" />
                          <AvatarFallback className="text-xs">
                            {getInitials(session?.user?.name || "You")}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {isOwn && !showAvatar && <div className="w-8" />}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}

            {/* Typing indicator */}
            <AnimatePresence>
              {otherUserTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center gap-2"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={otherUserAvatar} alt={otherUserName} />
                    <AvatarFallback className="text-xs">
                      {getInitials(otherUserName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-2xl px-4 py-2">
                    <div className="flex gap-1">
                      <motion.div
                        className="w-2 h-2 bg-muted-foreground rounded-full"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                      />
                      <motion.div
                        className="w-2 h-2 bg-muted-foreground rounded-full"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                      />
                      <motion.div
                        className="w-2 h-2 bg-muted-foreground rounded-full"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>

      {/* Input */}
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <div className="flex-1 flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder="Type a message..."
              disabled={sendMutation.isPending}
              className="flex-1"
              maxLength={1000}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled
              className="shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled
              className="shrink-0"
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
          </div>
          <Button
            type="submit"
            disabled={!newMessage.trim() || sendMutation.isPending}
            className="shrink-0"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send • {newMessage.length}/1000
        </p>
      </div>
    </Card>
  );
}
