"use client";

import { useState } from "react";
import type { ToolParam } from "@/lib/apify/tool-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

interface ParamInputProps {
  param: ToolParam;
  value: unknown;
  onChange: (value: unknown) => void;
  locale: string;
  error?: string;
  disabled?: boolean;
}

export interface DateBucket {
  label: string;
  start: string;
  end: string;
  percentage: number;
}

export interface DateDistributionValue {
  preset: string;
  buckets: DateBucket[];
}

const PRESETS: Record<string, { label: Record<string, string>; buckets: (now: Date) => DateBucket[] }> = {
  recent_only: {
    label: { en: "Recent only", es: "Solo recientes" },
    buckets: (now) => {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return [{ label: "Last 30 days", start: fmt(start), end: fmt(now), percentage: 100 }];
    },
  },
  balanced: {
    label: { en: "Balanced distribution", es: "Distribucion balanceada" },
    buckets: (now) => {
      const m1 = sub(now, 30);
      const m6 = sub(now, 180);
      const y1 = sub(now, 365);
      const y3 = sub(now, 1095);
      return [
        { label: "Last month", start: fmt(m1), end: fmt(now), percentage: 40 },
        { label: "1-6 months", start: fmt(m6), end: fmt(m1), percentage: 30 },
        { label: "6-12 months", start: fmt(y1), end: fmt(m6), percentage: 20 },
        { label: "1-3 years", start: fmt(y3), end: fmt(y1), percentage: 10 },
      ];
    },
  },
  temporal_full: {
    label: { en: "Full temporal analysis", es: "Analisis temporal completo" },
    buckets: (now) => {
      const q1 = sub(now, 90);
      const q2 = sub(now, 180);
      const q3 = sub(now, 270);
      const y1 = sub(now, 365);
      return [
        { label: "Q1 (0-3mo)", start: fmt(q1), end: fmt(now), percentage: 25 },
        { label: "Q2 (3-6mo)", start: fmt(q2), end: fmt(q1), percentage: 25 },
        { label: "Q3 (6-9mo)", start: fmt(q3), end: fmt(q2), percentage: 25 },
        { label: "Q4 (9-12mo)", start: fmt(y1), end: fmt(q3), percentage: 25 },
      ];
    },
  },
};

const MAX_BUCKETS = 24;

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

function sub(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - days);
  return r;
}

function loc(record: Record<string, string>, locale: string): string {
  return record[locale] ?? record.en ?? "";
}

export function DateDistributionInput({
  param,
  value,
  onChange,
  locale,
  error,
  disabled,
}: ParamInputProps) {
  const dist = value as DateDistributionValue | undefined;
  const [activePreset, setActivePreset] = useState(dist?.preset ?? "");

  const applyPreset = (key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;
    const buckets = preset.buckets(new Date());
    setActivePreset(key);
    onChange({ preset: key, buckets });
  };

  const updateBucket = (index: number, field: keyof DateBucket, val: string | number) => {
    if (!dist) return;
    const buckets = [...dist.buckets];
    buckets[index] = { ...buckets[index], [field]: val };
    setActivePreset("custom");
    onChange({ preset: "custom", buckets });
  };

  const removeBucket = (index: number) => {
    if (!dist) return;
    const buckets = dist.buckets.filter((_, i) => i !== index);
    setActivePreset("custom");
    onChange({ preset: "custom", buckets });
  };

  const addBucket = () => {
    if (!dist) {
      onChange({
        preset: "custom",
        buckets: [{ label: "New bucket", start: fmt(sub(new Date(), 30)), end: fmt(new Date()), percentage: 100 }],
      });
      setActivePreset("custom");
      return;
    }
    if (dist.buckets.length >= MAX_BUCKETS) return;
    const buckets = [
      ...dist.buckets,
      { label: `Bucket ${dist.buckets.length + 1}`, start: "", end: "", percentage: 0 },
    ];
    setActivePreset("custom");
    onChange({ preset: "custom", buckets });
  };

  const totalPct = dist?.buckets.reduce((s, b) => s + b.percentage, 0) ?? 0;
  const pctError = dist && totalPct !== 100;

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium">
        {loc(param.label, locale)}
      </Label>
      <p className="text-[11px] text-muted-foreground">
        {loc(param.description, locale)}
      </p>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(PRESETS).map(([key, preset]) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => applyPreset(key)}
            className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
              activePreset === key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {loc(preset.label, locale)}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={addBucket}
          className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
            activePreset === "custom"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          {locale === "es" ? "Personalizado" : "Custom"}
        </button>
      </div>

      {/* Buckets */}
      {dist && dist.buckets.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border p-2">
          {/* Visual bar */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {dist.buckets.map((b, i) => (
              <div
                key={i}
                className="h-full transition-all"
                style={{
                  width: `${b.percentage}%`,
                  backgroundColor: `hsl(${(i * 60 + 200) % 360}, 60%, 55%)`,
                }}
                title={`${b.label}: ${b.percentage}%`}
              />
            ))}
          </div>

          {/* Bucket rows */}
          {dist.buckets.map((bucket, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px]">
              <Input
                value={bucket.label}
                onChange={(e) => updateBucket(i, "label", e.target.value)}
                className="h-7 w-20 text-[11px]"
                disabled={disabled}
              />
              <Input
                type="date"
                value={bucket.start}
                onChange={(e) => updateBucket(i, "start", e.target.value)}
                className="h-7 w-[110px] text-[11px]"
                disabled={disabled}
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                value={bucket.end}
                onChange={(e) => updateBucket(i, "end", e.target.value)}
                className="h-7 w-[110px] text-[11px]"
                disabled={disabled}
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={bucket.percentage}
                onChange={(e) => updateBucket(i, "percentage", Number(e.target.value))}
                className="h-7 w-14 text-[11px]"
                disabled={disabled}
              />
              <span className="text-muted-foreground">%</span>
              <button
                type="button"
                onClick={() => removeBucket(i)}
                disabled={disabled}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          {/* Total + add button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {dist.buckets.length < MAX_BUCKETS && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-[11px]"
                  onClick={addBucket}
                  disabled={disabled}
                >
                  <Plus className="size-3" />
                  {locale === "es" ? "Agregar" : "Add"}
                </Button>
              )}
            </div>
            <Badge variant={pctError ? "destructive" : "secondary"} className="text-[10px]">
              {totalPct}% / 100%
            </Badge>
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
