"use client"

import { useState } from "react"
import { ReportViewer } from "@/components/project/report-viewer"

interface ReportClientProps {
  projectId: string
  initialHtmlContent: string | null
}

export function ReportClient({ projectId, initialHtmlContent }: ReportClientProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(initialHtmlContent)
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json()
      if (res.ok) {
        setHtmlContent(data.htmlContent ?? null)
      } else {
        console.error("[report] Generation failed:", data.error)
        alert(data.error ?? "Report generation failed")
      }
    } catch (err) {
      console.error("[report] Network error:", err)
      alert("Failed to connect to report API")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      {htmlContent && (
        <div className="flex items-center justify-end border-b px-4 py-2">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            {loading ? "Regenerating..." : "Regenerate report"}
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ReportViewer
          htmlContent={htmlContent}
          loading={loading}
          onGenerate={handleGenerate}
        />
      </div>
    </div>
  )
}
