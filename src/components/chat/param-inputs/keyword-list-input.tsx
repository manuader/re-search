"use client";

import { useState, type KeyboardEvent } from "react";
import type { ParamInputProps } from "./index";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { XIcon } from "lucide-react";

export function KeywordListInput({
  param,
  value,
  onChange,
  locale,
  error,
  disabled,
}: ParamInputProps) {
  const loc = (record: Record<string, string>) =>
    record[locale] ?? record.en ?? "";

  const items = (value as string[]) ?? [];
  const [draft, setDraft] = useState("");

  function addItems(raw: string) {
    const newItems = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !items.includes(s));
    if (newItems.length > 0) {
      onChange([...items, ...newItems]);
    }
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addItems(draft);
    }
  }

  function remove(item: string) {
    onChange(items.filter((v) => v !== item));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={param.id}>{loc(param.label)}</Label>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1">
              {item}
              <button
                type="button"
                onClick={() => remove(item)}
                disabled={disabled}
                className="inline-flex items-center rounded-full p-0.5 hover:bg-foreground/10"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        id={param.id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => draft.trim() && addItems(draft)}
        placeholder={param.placeholder ? loc(param.placeholder) : undefined}
        disabled={disabled}
        aria-invalid={!!error}
      />
      {param.description && (
        <p className="text-xs text-muted-foreground">{loc(param.description)}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
