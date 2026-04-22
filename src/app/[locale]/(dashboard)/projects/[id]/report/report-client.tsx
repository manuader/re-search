"use client"

import { useState, useRef, useCallback } from "react"
import { ReportViewer } from "@/components/project/report-viewer"

interface ReportClientProps {
  projectId: string
  initialHtmlContent: string | null
}

const POLL_INTERVAL = 5000
const MAX_POLLS = 60 // 5 minutes max

export function ReportClient({ projectId, initialHtmlContent }: ReportClientProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(initialHtmlContent)
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initialCreatedAt = useRef<string | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  async function handleGenerate() {
    setLoading(true)

    // Remember the current latest report timestamp so we can detect a NEW one
    try {
      const statusRes = await fetch(`/api/report/status?projectId=${projectId}`)
      const statusData = await statusRes.json()
      initialCreatedAt.current = statusData.createdAt ?? null
    } catch {
      initialCreatedAt.current = null
    }

    // Dispatch to Inngest via API
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })

      const text = await res.text()
      let data: Record<string, unknown>
      try {
        data = JSON.parse(text)
      } catch {
        setLoading(false)
        alert("Report API returned invalid response")
        return
      }

      if (!res.ok) {
        setLoading(false)
        alert((data.error as string) ?? "Failed to start report generation")
        return
      }
    } catch (err) {
      setLoading(false)
      console.error("[report] Dispatch error:", err)
      alert("Failed to connect to report API")
      return
    }

    // Poll for completion
    let pollCount = 0
    stopPolling()
    pollRef.current = setInterval(async () => {
      pollCount++
      if (pollCount > MAX_POLLS) {
        stopPolling()
        setLoading(false)
        alert("Report generation timed out. Please refresh and try again.")
        return
      }

      try {
        const res = await fetch(`/api/report/status?projectId=${projectId}`)
        const data = await res.json()

        if (
          data.status === "ready" &&
          data.createdAt !== initialCreatedAt.current
        ) {
          stopPolling()
          setHtmlContent(data.htmlContent ?? null)
          setLoading(false)
        }
      } catch {
        // Network blip — keep polling
      }
    }, POLL_INTERVAL)
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
            {loading ? "Generating..." : "Regenerate report"}
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
