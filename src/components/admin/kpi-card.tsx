import { Card } from "@/components/ui/card";

interface KPICardProps {
  title: string;
  value: string | number;
  currency?: boolean;
  locale?: string;
}

export function KPICard({ title, value, currency, locale = "en" }: KPICardProps) {
  const formatted =
    currency && typeof value === "number"
      ? new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "USD",
        }).format(value)
      : String(value);

  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{formatted}</p>
    </Card>
  );
}
