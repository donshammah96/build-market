"use client";

import { useState } from "react";
import { ConversationsList } from "@/components/shared/ConversationsList";
import ChatWindow from "@/components/shared/ChatWindow";
import { motion } from "framer-motion";

export default function MessagesPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleSelectConversation = (conversationId: string, otherUserId: string) => {
    setSelectedConversationId(conversationId);
    setSelectedUserId(otherUserId);
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="grid md:grid-cols-3 gap-4">
        {/* Conversations List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="md:col-span-1"
        >
          <ConversationsList
            onSelectConversation={handleSelectConversation}
            selectedId={selectedConversationId || undefined}
          />
        </motion.div>

        {/* Chat Window */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="md:col-span-2"
        >
          {selectedConversationId ? (
            <ChatWindow
              conversationId={selectedConversationId}
              otherUserId={selectedUserId || undefined}
              otherUserName={selectedUserId ? `User ${selectedUserId.slice(0, 8)}` : "User"}
            />
          ) : (
            <div className="h-[600px] border rounded-lg flex items-center justify-center bg-muted/20">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <p className="text-muted-foreground font-medium">Select a conversation</p>
                <p className="text-sm text-muted-foreground">
                  Choose a conversation from the list to start messaging
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

