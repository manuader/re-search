"use client";

import type { ParamInputProps } from "./index";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function EnumInput({
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
      <Select
        value={value as string | undefined}
        onValueChange={(val) => onChange(val)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" aria-invalid={!!error}>
          <SelectValue placeholder={param.placeholder ? loc(param.placeholder) : undefined} />
        </SelectTrigger>
        <SelectContent>
          {param.options?.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {loc(opt.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {param.description && (
        <p className="text-xs text-muted-foreground">{loc(param.description)}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
