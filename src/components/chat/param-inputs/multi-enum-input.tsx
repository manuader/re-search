"use client";

import type { ParamInputProps } from "./index";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function MultiEnumInput({
  param,
  value,
  onChange,
  locale,
  error,
  disabled,
}: ParamInputProps) {
  const loc = (record: Record<string, string>) =>
    record[locale] ?? record.en ?? "";

  const selected = (value as string[]) ?? [];

  function toggle(optionValue: string) {
    const updated = selected.includes(optionValue)
      ? selected.filter((v) => v !== optionValue)
      : [...selected, optionValue];
    onChange(updated);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{loc(param.label)}</Label>
      <div className="flex flex-col gap-2">
        {param.options?.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <Checkbox
              checked={selected.includes(opt.value)}
              onCheckedChange={() => toggle(opt.value)}
              disabled={disabled}
            />
            {loc(opt.label)}
          </label>
        ))}
      </div>
      {param.description && (
        <p className="text-xs text-muted-foreground">{loc(param.description)}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
