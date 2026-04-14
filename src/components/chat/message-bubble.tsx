"use client";

import type { UIMessage } from "ai";
import { isTextUIPart, isToolUIPart, getToolName } from "ai";
import { ToolStatus } from "./tool-status";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-1.5",
          isUser ? "items-end" : "items-start"
        )}
      >
        {message.parts.map((part, i) => {
          if (isTextUIPart(part)) {
            if (!part.text.trim()) return null;
            return (
              <div
                key={`${message.id}-text-${i}`}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-sm leading-relaxed",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {part.text}
              </div>
            );
          }

          if (isToolUIPart(part)) {
            const name = getToolName(part);
            return (
              <ToolStatus
                key={`${message.id}-tool-${i}`}
                toolName={name}
                state={part.state}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
