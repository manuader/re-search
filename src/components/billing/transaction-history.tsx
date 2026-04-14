import { Badge } from "@/components/ui/badge"

interface Transaction {
  id: string
  amount: number
  type: string
  description: string | null
  created_at: string
}

interface TransactionHistoryProps {
  transactions: Transaction[]
}

const TYPE_LABELS: Record<string, string> = {
  credit_purchase: "Credit Purchase",
  scraping_reserve: "Scraping Reserve",
  scraping_cost: "Scraping Cost",
  ai_cost: "AI Cost",
  refund: "Refund",
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

const TYPE_BADGE_CLASSES: Record<string, string> = {
  credit_purchase: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  scraping_reserve: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  scraping_cost: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  ai_cost: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  refund: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        <p className="font-medium">No transactions yet</p>
        <p className="mt-1 text-xs">Your transaction history will appear here.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {formatDate(tx.created_at)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={TYPE_BADGE_CLASSES[tx.type] ?? "bg-secondary text-secondary-foreground"}
                    variant={"outline" as BadgeVariant}
                  >
                    {TYPE_LABELS[tx.type] ?? tx.type}
                  </Badge>
                  {tx.description && (
                    <span className="text-muted-foreground truncate max-w-[200px]">
                      {tx.description}
                    </span>
                  )}
                </div>
              </td>
              <td className={`px-4 py-3 text-right font-medium tabular-nums ${tx.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {tx.amount >= 0 ? "+" : ""}
                {tx.amount.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
