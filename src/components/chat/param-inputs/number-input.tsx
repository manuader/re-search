"use client";

import type { ParamInputProps } from "./index";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NumberInput({
  param,
  value,
  onChange,
  locale,
  error,
  disabled,
}: ParamInputProps) {
  const loc = (record: Record<string, string>) =>
    record[locale] ?? record.en ?? "";

  const constraints: string[] = [];
  if (param.min !== undefined) constraints.push(`Min: ${param.min}`);
  if (param.max !== undefined) constraints.push(`Max: ${param.max}`);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={param.id}>{loc(param.label)}</Label>
      <Input
        id={param.id}
        type="number"
        value={value !== undefined && value !== null ? String(value) : ""}
        onChange={(e) => onChange(Number(e.target.value))}
        min={param.min}
        max={param.max}
        placeholder={param.placeholder ? loc(param.placeholder) : undefined}
        disabled={disabled}
        aria-invalid={!!error}
      />
      {param.description && (
        <p className="text-xs text-muted-foreground">{loc(param.description)}</p>
      )}
      {constraints.length > 0 && (
        <p className="text-xs text-muted-foreground">{constraints.join(" | ")}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
