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
    <div className="h-full w-full">
      <ReportViewer
        htmlContent={htmlContent}
        loading={loading}
        onGenerate={handleGenerate}
      />
    </div>
  )
}
