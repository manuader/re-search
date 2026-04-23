"use client"

import { useState, useRef, useCallback } from "react"
import { ReportViewer } from "@/components/project/report-viewer"
import { useTranslations } from "next-intl"
import type { ReportLevel } from "@/lib/reports/types"

interface ReportClientProps {
  projectId: string
  initialHtmlContent: string | null
}

const POLL_INTERVAL = 5000
const MAX_POLLS = 60

const LEVEL_LABELS: Record<ReportLevel, string> = {
  executive: "Executive",
  professional: "Professional",
  technical: "Technical",
}

export function ReportClient({ projectId, initialHtmlContent }: ReportClientProps) {
  const t = useTranslations("project.reportGen")
  const tc = useTranslations("common")
  const [htmlContent, setHtmlContent] = useState<string | null>(initialHtmlContent)
  const [loading, setLoading] = useState(false)
  const [showLevelPicker, setShowLevelPicker] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initialCreatedAt = useRef<string | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  async function handleGenerate(level: ReportLevel) {
    setShowLevelPicker(false)
    setLoading(true)

    try {
      const statusRes = await fetch(`/api/report/status?projectId=${projectId}`)
      const statusData = await statusRes.json()
      initialCreatedAt.current = statusData.createdAt ?? null
    } catch {
      initialCreatedAt.current = null
    }

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, level }),
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
        // keep polling
      }
    }, POLL_INTERVAL)
  }

  if (showLevelPicker) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center justify-end border-b px-4 py-2">
          <button
            onClick={() => setShowLevelPicker(false)}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            {tc("cancel")}
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <ReportViewer htmlContent={null} loading={false} onGenerate={handleGenerate} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      {htmlContent && (
        <div className="flex items-center justify-end border-b px-4 py-2">
          <button
            onClick={() => setShowLevelPicker(true)}
            disabled={loading}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            {loading ? t("generating") : t("regenerate")}
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
