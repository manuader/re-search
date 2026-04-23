"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { ChevronUpIcon, ChevronDownIcon, ChevronsUpDownIcon, CopyIcon, CheckIcon, XIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslations } from "next-intl"

interface DataTableProps {
  data: {
    columns: string[]
    rows: Record<string, unknown>[]
  }
  loading: boolean
}

const ROWS_PER_PAGE = 20

function flattenRecord(record: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenRecord(value as Record<string, unknown>, fullKey))
    } else {
      result[fullKey] = value
    }
  }
  return result
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function CellDetail({ value, onClose, cellValueLabel, copyLabel, copiedLabel }: { value: string; onClose: () => void; cellValueLabel: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [onClose])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [value])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div ref={ref} className="mx-4 flex max-h-[70vh] w-full max-w-lg flex-col rounded-lg border border-border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-medium">{cellValueLabel}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1 text-xs">
              {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
              {copied ? copiedLabel : copyLabel}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
              <XIcon className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <pre className="whitespace-pre-wrap break-all text-sm text-foreground/90">{value}</pre>
        </div>
      </div>
    </div>
  )
}

export function DataTable({ data, loading }: DataTableProps) {
  const t = useTranslations("project.dataTable")
  const [search, setSearch] = useState("")
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const [selectedCell, setSelectedCell] = useState<string | null>(null)

  const flattenedRows = useMemo(
    () => data.rows.map((row) => flattenRecord(row)),
    [data.rows]
  )

  const columns = useMemo(() => {
    if (data.columns.length > 0) return data.columns
    const colSet = new Set<string>()
    for (const row of flattenedRows) {
      for (const key of Object.keys(row)) {
        colSet.add(key)
      }
    }
    return Array.from(colSet)
  }, [data.columns, flattenedRows])

  const filteredRows = useMemo(() => {
    if (!search.trim()) return flattenedRows
    const q = search.toLowerCase()
    return flattenedRows.filter((row) =>
      columns.some((col) => formatCellValue(row[col]).toLowerCase().includes(q))
    )
  }, [flattenedRows, columns, search])

  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows
    return [...filteredRows].sort((a, b) => {
      const av = formatCellValue(a[sortCol])
      const bv = formatCellValue(b[sortCol])
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" })
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filteredRows, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / ROWS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = sortedRows.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  )

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortCol(col)
      setSortDir("asc")
    }
    setPage(1)
  }

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  const isAiCol = (col: string) => col.startsWith("ai_")

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-3 py-2">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Search */}
      <div className="flex items-center gap-2">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="max-w-xs"
        />
        {search && (
          <span className="text-xs text-muted-foreground">
            {t("resultCount", { count: sortedRows.length })}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
        <table className="w-full min-w-max text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/70 backdrop-blur-sm">
              <th className="whitespace-nowrap px-3 py-2 text-center font-medium text-muted-foreground w-12">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="group cursor-pointer whitespace-nowrap px-3 py-2 text-left font-medium text-foreground hover:bg-muted transition-colors"
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1.5">
                    {isAiCol(col) ? (
                      <Badge
                        variant="secondary"
                        className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800 text-xs font-medium"
                      >
                        {col}
                      </Badge>
                    ) : (
                      <span>{col}</span>
                    )}
                    <span className="text-muted-foreground">
                      {sortCol === col ? (
                        sortDir === "asc" ? (
                          <ChevronUpIcon className="size-3.5" />
                        ) : (
                          <ChevronDownIcon className="size-3.5" />
                        )
                      ) : (
                        <ChevronsUpDownIcon className="size-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-3 py-12 text-center text-sm text-muted-foreground"
                >
                  {t("noData")}
                </td>
              </tr>
            ) : (
              pagedRows.map((row, i) => {
                const globalIndex = (currentPage - 1) * ROWS_PER_PAGE + i + 1
                return (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-center text-xs text-muted-foreground tabular-nums">
                      {globalIndex}
                    </td>
                    {columns.map((col) => {
                      const cellValue = formatCellValue(row[col])
                      return (
                        <td
                          key={col}
                          className="max-w-[280px] truncate whitespace-nowrap px-3 py-2 text-foreground/80 cursor-pointer hover:bg-muted/60 transition-colors"
                          onClick={() => cellValue && setSelectedCell(cellValue)}
                        >
                          {cellValue}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedCell !== null && (
        <CellDetail value={selectedCell} onClose={() => setSelectedCell(null)} cellValueLabel={t("cellValue")} copyLabel={t("copy")} copiedLabel={t("copied")} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("pagination", { current: currentPage, total: totalPages, rows: sortedRows.length })}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
