"use client";

import type { ParamInputProps } from "./index";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateRangeValue {
  start?: string;
  end?: string;
}

export function DateRangeInput({
  param,
  value,
  onChange,
  locale,
  error,
  disabled,
}: ParamInputProps) {
  const loc = (record: Record<string, string>) =>
    record[locale] ?? record.en ?? "";

  const range = (value as DateRangeValue) ?? {};

  function update(field: "start" | "end", val: string) {
    onChange({ ...range, [field]: val || undefined });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{loc(param.label)}</Label>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">From</span>
          <Input
            type="date"
            value={range.start ?? ""}
            onChange={(e) => update("start", e.target.value)}
            disabled={disabled}
            aria-invalid={!!error}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">To</span>
          <Input
            type="date"
            value={range.end ?? ""}
            onChange={(e) => update("end", e.target.value)}
            disabled={disabled}
            aria-invalid={!!error}
          />
        </div>
      </div>
      {param.description && (
        <p className="text-xs text-muted-foreground">{loc(param.description)}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
