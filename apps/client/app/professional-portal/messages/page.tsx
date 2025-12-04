"use client";

import { useState } from "react";
import { ConversationsList } from "@/components/chat/ConversationsList";
import ChatWindow from "@/components/chat/ChatWindow";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function MessagesPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(undefined);
  const [otherUserId, setOtherUserId] = useState<string | undefined>(undefined);
  // In a real app, we'd fetch these details based on the selected conversation
  const [otherUserName, setOtherUserName] = useState<string>("User"); 
  const [otherUserAvatar, setOtherUserAvatar] = useState<string | undefined>(undefined);

  const handleSelectConversation = (conversationId: string, userId: string) => {
    setSelectedConversationId(conversationId);
    setOtherUserId(userId);
    // Reset these for now, or fetch them if available in the conversation object passed up
    setOtherUserName(`User ${userId.slice(0, 4)}`); 
    setOtherUserAvatar(undefined);
  };

  return (
    <div className="h-[calc(100vh-8rem)] max-w-[1600px] mx-auto">
      <div className="flex flex-col h-full gap-6">
        
        {/* --- Header --- */}
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Messages</h1>
          <p className="text-zinc-500 mt-1 text-sm">
            Communicate with clients and manage inquiries.
          </p>
        </div>

        {/* --- Chat Layout --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
          
          {/* List */}
          <div className="lg:col-span-1 h-full min-h-0">
            <ConversationsList 
              onSelectConversation={handleSelectConversation}
              selectedId={selectedConversationId}
            />
          </div>

          {/* Window */}
          <div className="lg:col-span-2 h-full min-h-0">
            {selectedConversationId && otherUserId ? (
              <ChatWindow 
                conversationId={selectedConversationId}
                otherUserId={otherUserId}
                otherUserName={otherUserName}
                otherUserAvatar={otherUserAvatar}
              />
            ) : (
              <Card className="h-full flex items-center justify-center bg-zinc-50/50 border-dashed">
                <CardContent className="text-center p-6">
                  <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="h-8 w-8 text-zinc-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900">No conversation selected</h3>
                  <p className="text-zinc-500 mt-2 max-w-xs mx-auto">
                    Select a conversation from the list to start messaging or view history.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
