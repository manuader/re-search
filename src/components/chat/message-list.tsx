"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";

interface MessageListProps {
  messages: UIMessage[];
  onKeywordSelectionChange?: (toolId: string, selected: string[]) => void;
}

export function MessageList({ messages, onKeywordSelectionChange }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 h-0 min-h-0">
      <div className="flex flex-col gap-4 p-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onKeywordSelectionChange={onKeywordSelectionChange} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
