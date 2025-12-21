"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ConversationsList } from "@/components/chat/ConversationsList";
import ChatWindow from "@/components/chat/ChatWindow";
import { Card } from "@/components/ui/card";

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get("conversationId");

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId);
  const [otherUserId, setOtherUserId] = useState<string | undefined>(undefined);

  // When a conversation is selected from the list
  const handleSelectConversation = (conversationId: string, otherId: string) => {
    setSelectedConversationId(conversationId);
    setOtherUserId(otherId);
  };

  // Sync with URL param if it changes
  useEffect(() => {
    if (initialConversationId && initialConversationId !== selectedConversationId) {
        // We might not have otherUserId if just coming from URL, 
        // but ChatWindow fetches details if conversationId is present.
        setSelectedConversationId(initialConversationId);
    }
  }, [initialConversationId, selectedConversationId]);


  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6">
      
      {/* Left Pane: Conversation List */}
      <div className={`${selectedConversationId ? 'hidden md:block' : 'block'} w-full md:w-1/3 lg:w-1/4 h-full`}>
        <ConversationsList 
            onSelectConversation={handleSelectConversation} 
            selectedId={selectedConversationId || undefined}
        />
      </div>

      {/* Right Pane: Chat Window */}
      <div className={`${!selectedConversationId ? 'hidden md:block' : 'block'} w-full md:w-2/3 lg:w-3/4 h-full`}>
        {selectedConversationId ? (
          <ChatWindow 
            conversationId={selectedConversationId} 
            otherUserId={otherUserId}
          />
        ) : (
          <Card className="h-full flex items-center justify-center text-zinc-400 bg-zinc-50 border-dashed">
            <div className="text-center">
                <p>Select a conversation to start chatting</p>
            </div>
          </Card>
        )}
      </div>

    </div>
  );
}
