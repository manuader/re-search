"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useRealtimeProgress } from "@/hooks/use-realtime-progress";

interface ProgressTrackerProps {
  projectId: string;
}

type JobStatus = "pending" | "running" | "completed" | "failed";

const statusStyles: Record<JobStatus, { border: string; text: string; label: string }> = {
  completed: { border: "border-l-green-500", text: "text-green-600", label: "Completed" },
  running: { border: "border-l-yellow-500", text: "text-yellow-600", label: "Running" },
  pending: { border: "border-l-gray-300", text: "text-gray-400", label: "Pending" },
  failed: { border: "border-l-red-500", text: "text-red-600", label: "Failed" },
};

function getQualityBadgeClass(score: string): string {
  const n = parseFloat(score);
  if (!isNaN(n)) {
    if (n >= 0.7) return "bg-green-100 text-green-700 border-green-200";
    if (n >= 0.4) return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-red-100 text-red-700 border-red-200";
  }
  if (score === "high") return "bg-green-100 text-green-700 border-green-200";
  if (score === "medium") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function getQualityLabel(score: string): string {
  const n = parseFloat(score);
  if (!isNaN(n)) {
    if (n >= 0.7) return "High";
    if (n >= 0.4) return "Medium";
    return "Low";
  }
  return score.charAt(0).toUpperCase() + score.slice(1);
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function JobCard({ job }: { job: {
  id: string;
  tool_id: string;
  tool_name: string;
  status: string;
  estimated_results: number | null;
  actual_results: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  quality_score: string | null;
  error_message: string | null;
}}) {
  const status = (job.status as JobStatus) in statusStyles ? (job.status as JobStatus) : "pending";
  const styles = statusStyles[status];

  const hasProgress = job.actual_results != null && job.estimated_results != null && job.estimated_results > 0;
  const progressPercent = hasProgress
    ? Math.min(100, Math.round(((job.actual_results ?? 0) / (job.estimated_results ?? 1)) * 100))
    : null;

  const displayCost =
    status === "completed" && job.actual_cost != null
      ? formatCost(job.actual_cost)
      : job.estimated_cost != null
      ? `~${formatCost(job.estimated_cost)}`
      : null;

  return (
    <div className={`border-l-4 ${styles.border} rounded-lg bg-card ring-1 ring-foreground/10 p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-card-foreground">{job.tool_name}</span>
        <span className={`text-xs font-medium ${styles.text}`}>{styles.label}</span>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          {progressPercent != null ? (
            <div
              className="h-full rounded-full bg-foreground/20 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          ) : (
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                status === "running"
                  ? "animate-pulse bg-yellow-400/60 w-full"
                  : status === "completed"
                  ? "bg-green-500 w-full"
                  : "bg-gray-200 w-0"
              }`}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {job.actual_results != null ? job.actual_results : 0}
            {job.estimated_results != null ? ` / ${job.estimated_results} results` : " results"}
          </span>
          {progressPercent != null && <span>{progressPercent}%</span>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Cost */}
        {displayCost && (
          <span className="text-xs text-muted-foreground">
            {status === "completed" ? "Cost: " : "Est. cost: "}
            <span className="font-medium text-card-foreground">{displayCost}</span>
          </span>
        )}

        {/* Quality badge */}
        {status === "completed" && job.quality_score != null && (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getQualityBadgeClass(job.quality_score)}`}
          >
            {getQualityLabel(job.quality_score)} quality
          </span>
        )}
      </div>

      {/* Error message */}
      {status === "failed" && job.error_message && (
        <p className="text-xs text-red-600 break-words">{job.error_message}</p>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48" />
      <Separator />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border-l-4 border-l-gray-200 p-4 ring-1 ring-foreground/10">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProgressTracker({ projectId }: ProgressTrackerProps) {
  const { jobs, projectStatus, loading } = useRealtimeProgress(projectId);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-4">
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  const headerText =
    projectStatus === "completed"
      ? "Research completed"
      : projectStatus === "failed"
      ? "Research failed"
      : projectStatus === "running"
      ? "Research in progress..."
      : "Research pending";

  const headerTextClass =
    projectStatus === "completed"
      ? "text-green-600"
      : projectStatus === "failed"
      ? "text-red-600"
      : projectStatus === "running"
      ? "text-yellow-600"
      : "text-muted-foreground";

  return (
    <Card>
      <CardHeader>
        <CardTitle className={`text-base ${headerTextClass}`}>{headerText}</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 flex flex-col gap-3">
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scraping jobs found.</p>
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} />)
        )}
      </CardContent>
    </Card>
  );
}
