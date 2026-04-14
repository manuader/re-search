import { useTranslations } from "next-intl";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  creditBalance: number;
}

export function Sidebar({ creditBalance }: SidebarProps) {
  const t = useTranslations();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-muted/30 p-4">
      <div className="mb-6 px-2 text-lg font-bold">
        {t("common.appName")}
      </div>

      <Link href="/projects/new" className={buttonVariants({ variant: "default", className: "mb-6" })}>
        + {t("dashboard.newResearch")}
      </Link>

      <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("dashboard.recentProjects")}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Project list will be populated in Phase 2 */}
      </div>

      <Separator className="my-2" />

      <div className="space-y-1 px-2 text-sm">
        <div className="text-muted-foreground">
          {t("billing.credits")}: ${creditBalance.toFixed(2)}
        </div>
      </div>
    </aside>
  );
}
