"use client"

import { Loader2Icon, BarChart3Icon, BriefcaseIcon, LineChartIcon, FlaskConicalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ReportLevel } from "@/lib/reports/types"

const LEVELS: {
  value: ReportLevel
  icon: typeof BriefcaseIcon
  title: string
  description: string
}[] = [
  {
    value: "executive",
    icon: BriefcaseIcon,
    title: "Executive",
    description: "High-level summary for decision makers. Clear KPIs, minimal charts, plain language.",
  },
  {
    value: "professional",
    icon: LineChartIcon,
    title: "Professional",
    description: "Balanced analysis with charts, insights, and recommendations. Best for most use cases.",
  },
  {
    value: "technical",
    icon: FlaskConicalIcon,
    title: "Technical",
    description: "Full statistical deep-dive. Correlations, percentiles, distributions, raw data tables.",
  },
]

interface ReportViewerProps {
  htmlContent: string | null
  loading: boolean
  onGenerate: (level: ReportLevel) => void
}

export function ReportViewer({ htmlContent, loading, onGenerate }: ReportViewerProps) {
  if (htmlContent) {
    return (
      <iframe
        sandbox="allow-scripts allow-same-origin"
        srcDoc={htmlContent}
        className="h-full w-full border-0"
        title="Research Report"
      />
    )
  }

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">
            Generating report... This may take a moment
          </p>
        </div>
        <div className="w-full max-w-2xl space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <BarChart3Icon className="size-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">Generate Report</h2>
          <p className="text-sm text-muted-foreground">
            Choose the level of detail for your research report
          </p>
        </div>
        <div className="grid gap-3">
          {LEVELS.map((level) => {
            const Icon = level.icon
            return (
              <Card
                key={level.value}
                className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/40"
                onClick={() => onGenerate(level.value)}
              >
                <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{level.title}</CardTitle>
                    <CardDescription className="text-xs">
                      {level.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
