"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface KeywordChecklistProps {
  toolId: string;
  toolName: string;
  keywords: string[];
  costPerKeyword: number;
  onSelectionChange: (toolId: string, selected: string[]) => void;
}

export function KeywordChecklist({
  toolId,
  toolName,
  keywords,
  costPerKeyword,
  onSelectionChange,
}: KeywordChecklistProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(keywords));

  function toggle(keyword: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      onSelectionChange(toolId, Array.from(next));
      return next;
    });
  }

  function selectAll() {
    const all = new Set(keywords);
    setSelected(all);
    onSelectionChange(toolId, keywords);
  }

  function deselectAll() {
    setSelected(new Set());
    onSelectionChange(toolId, []);
  }

  const totalCost = selected.size * costPerKeyword;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{toolName} — Keywords</CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectAll}>
            Select all
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={deselectAll}>
            Deselect all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 pb-2">
        {keywords.map((kw) => (
          <label key={kw} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
            <Checkbox
              checked={selected.has(kw)}
              onCheckedChange={() => toggle(kw)}
            />
            <span>{kw}</span>
          </label>
        ))}
      </CardContent>
      <CardFooter className="pt-2 border-t">
        <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
          <span>{selected.size} of {keywords.length} keywords</span>
          <span className="font-medium text-foreground">~${totalCost.toFixed(2)}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
