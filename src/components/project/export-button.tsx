"use client"

import { useState } from "react"
import { Loader2Icon, ChevronDownIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ExportButtonProps {
  projectId: string
}

type ExportFormat = "xlsx" | "csv"

export function ExportButton({ projectId }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport(format: ExportFormat) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, format }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Export failed with status ${res.status}`)
      }

      const { url } = await res.json()
      window.open(url, "_blank")
    } catch (err) {
      console.error("[ExportButton] Export failed:", err)
      setError(err instanceof Error ? err.message : "Export failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <Button variant="outline" disabled={loading}>
            {loading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                Export
                <ChevronDownIcon className="size-4" />
              </>
            )}
          </Button>
        } />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={loading}
            onClick={() => handleExport("xlsx")}
          >
            <FileSpreadsheetIcon className="size-4 text-green-600" />
            Export Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={loading}
            onClick={() => handleExport("csv")}
          >
            <FileTextIcon className="size-4 text-blue-600" />
            Export CSV (.csv)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
