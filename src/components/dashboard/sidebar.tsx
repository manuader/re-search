"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface Project {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

interface SidebarProps {
  creditBalance: number;
  projects: Project[];
}

const STATUS_EMOJI: Record<string, string> = {
  draft: "📝",
  configured: "⚙️",
  running: "🔄",
  completed: "✅",
  failed: "❌",
};

export function Sidebar({ creditBalance, projects }: SidebarProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  async function handleNewResearch() {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Research" }),
    });

    if (res.ok) {
      const { id } = await res.json();
      router.push(`/${locale}/projects/${id}`);
    }
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-muted/30 p-4">
      <div className="mb-6 px-2 text-lg font-bold">
        {t("common.appName")}
      </div>

      <button
        onClick={handleNewResearch}
        className={buttonVariants({ variant: "default", className: "mb-6" })}
      >
        + {t("dashboard.newResearch")}
      </button>

      <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("dashboard.recentProjects")}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/${locale}/projects/${project.id}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors truncate"
          >
            <span className="shrink-0">
              {STATUS_EMOJI[project.status] ?? "📝"}
            </span>
            <span className="truncate">{project.title}</span>
          </Link>
        ))}
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
