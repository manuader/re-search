"use client";

import type { ParamInputProps } from "./index";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function BooleanInput({
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
      <div className="flex items-center justify-between">
        <Label htmlFor={param.id}>{loc(param.label)}</Label>
        <Switch
          id={param.id}
          checked={!!value}
          onCheckedChange={(checked) => onChange(checked)}
          disabled={disabled}
        />
      </div>
      {param.description && (
        <p className="text-xs text-muted-foreground">{loc(param.description)}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
