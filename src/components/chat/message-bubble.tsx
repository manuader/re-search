"use client";

import type { UIMessage } from "ai";
import { isTextUIPart, isToolUIPart, getToolName } from "ai";
import ReactMarkdown from "react-markdown";
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
                    : "bg-muted text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-table:text-xs prose-headings:text-sm prose-headings:font-semibold prose-headings:my-2"
                )}
              >
                {isUser ? (
                  part.text
                ) : (
                  <ReactMarkdown>{part.text}</ReactMarkdown>
                )}
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
