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
      if (res.ok) {
        const data = await res.json()
        setHtmlContent(data.html_content ?? null)
      }
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
