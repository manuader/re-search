"use client"

import { Loader2Icon, BarChart3Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface ReportViewerProps {
  htmlContent: string | null
  loading: boolean
  onGenerate: () => void
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
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <BarChart3Icon className="size-6 text-muted-foreground" />
          </div>
          <CardTitle>No Report Yet</CardTitle>
          <CardDescription>
            Generate an interactive report with charts and insights from your research data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onGenerate} className="w-full">
            Generate Report
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
