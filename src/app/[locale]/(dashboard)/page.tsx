import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-5xl">🔬</div>
        <h2 className="mb-2 text-xl font-medium">{t("emptyState")}</h2>
        <p className="text-muted-foreground">{t("emptyStateDescription")}</p>
      </div>
    </div>
  );
}
