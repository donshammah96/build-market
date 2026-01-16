"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ConversationsList } from "@/components/chat/ConversationsList";
import ChatWindow from "@/components/chat/ChatWindow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, MessageSquare } from "lucide-react";

/**
 * MessagesPage Component
 *
 * Enterprise-level messaging interface with:
 * - URL state synchronization
 * - Error boundaries
 * - Responsive layout
 * - Proper state management
 */
export default function MessagesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get initial conversation ID from URL
  const initialConversationId = searchParams.get("conversationId");

  // State management
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(initialConversationId);
  const [otherUserId, setOtherUserId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  // Handle conversation selection with URL sync
  const handleSelectConversation = useCallback(
    (conversationId: string, otherId: string) => {
      setSelectedConversationId(conversationId);
      setOtherUserId(otherId);
      setError(null); // Clear any previous errors

      // Update URL without causing a full page reload
      const newUrl = `/professional-portal/messages?conversationId=${conversationId}`;
      router.replace(newUrl, { scroll: false });
    },
    [router]
  );

  // Sync with URL param changes (e.g., browser back/forward)
  useEffect(() => {
    const urlConversationId = searchParams.get("conversationId");

    if (urlConversationId && urlConversationId !== selectedConversationId) {
      // URL changed, update state
      setSelectedConversationId(urlConversationId);
      // Note: otherUserId might not be available from URL alone,
      // but ChatWindow will fetch conversation details if needed
    } else if (!urlConversationId && selectedConversationId) {
      // URL cleared, clear selection
      setSelectedConversationId(null);
      setOtherUserId(undefined);
    }
  }, [searchParams, selectedConversationId]);

  // Memoize layout classes for performance
  const listPaneClasses = useMemo(
    () =>
      `${
        selectedConversationId ? "hidden md:block" : "block"
      } w-full md:w-1/3 lg:w-1/4 h-full`,
    [selectedConversationId]
  );

  const chatPaneClasses = useMemo(
    () =>
      `${
        !selectedConversationId ? "hidden md:block" : "block"
      } w-full md:w-2/3 lg:w-3/4 h-full`,
    [selectedConversationId]
  );

  // Render error state
  if (error) {
    return (
      <div className="h-[calc(100vh-140px)] flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-zinc-500 mb-4">{error.message}</p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setError(null);
                  setSelectedConversationId(null);
                  router.push("/professional-portal/messages");
                }}
              >
                Reset
              </Button>
              <Button onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6">
      {/* Left Pane: Conversation List */}
      <div className={listPaneClasses}>
        <ConversationsList
          onSelectConversation={handleSelectConversation}
          selectedId={selectedConversationId || undefined}
        />
      </div>

      {/* Right Pane: Chat Window or Empty State */}
      <div className={chatPaneClasses}>
        {selectedConversationId ? (
          <ChatWindow
            conversationId={selectedConversationId}
            otherUserId={otherUserId}
          />
        ) : (
          <Card className="h-full flex items-center justify-center text-zinc-400 bg-zinc-50 border-dashed">
            <div className="text-center p-8">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-zinc-300" />
              <p className="text-lg font-medium text-zinc-500 mb-2">
                No conversation selected
              </p>
              <p className="text-sm text-zinc-400">
                Select a conversation from the list to start chatting
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
