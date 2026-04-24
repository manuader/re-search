"use client";

import type { ParamInputProps } from "./index";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TextInput({
  param,
  value,
  onChange,
  locale,
  error,
  disabled,
}: ParamInputProps) {
  const loc = (record: Record<string, string>) =>
    record[locale] ?? record.en ?? "";

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={param.id}>{loc(param.label)}</Label>
      <Input
        id={param.id}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
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
