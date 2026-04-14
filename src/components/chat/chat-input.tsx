"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-4">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Describe your research goal..."
        disabled={disabled}
        className="flex-1"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !input.trim()}
        aria-label="Send message"
      >
        <Send className="size-4" />
      </Button>
    </form>
  );
}
