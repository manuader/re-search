import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  executing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed_partial: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  refunded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  refund_pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  expired: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  // Actor health
  healthy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  degraded: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  down: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  unknown: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <Badge
      className={STATUS_STYLES[status] ?? STATUS_STYLES.unknown}
      variant="outline"
    >
      {label ?? status}
    </Badge>
  );
}
