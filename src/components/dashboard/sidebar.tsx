"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
] as const;

interface Project {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

interface SidebarProps {
  projects: Project[];
  userEmail: string;
}

const STATUS_EMOJI: Record<string, string> = {
  draft: "📝",
  configured: "⚙️",
  running: "🔄",
  completed: "✅",
  failed: "❌",
};

export function Sidebar({ projects, userEmail }: SidebarProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  async function handleSwitchLocale(newLocale: string) {
    if (newLocale === locale) return;
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase.from("profiles").update({ locale: newLocale }).eq("id", authUser.id);
    }
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
    router.refresh();
  }

  async function handleRename(projectId: string) {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
    setEditingId(null);
    router.refresh();
  }

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
          <div key={project.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors">
            <span className="shrink-0">
              {STATUS_EMOJI[project.status] ?? "📝"}
            </span>
            {editingId === project.id ? (
              <Input
                autoFocus
                className="h-6 text-sm px-1"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => handleRename(project.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(project.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
            ) : (
              <Link
                href={`/${locale}/projects/${project.id}`}
                className="truncate flex-1"
                onDoubleClick={(e) => {
                  e.preventDefault();
                  setEditingId(project.id);
                  setEditTitle(project.title);
                }}
              >
                {project.title}
              </Link>
            )}
          </div>
        ))}
      </div>

      <Separator className="my-2" />

      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted transition-colors">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <span className="truncate text-muted-foreground">{userEmail}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <DropdownMenuItem onClick={() => router.push(`/${locale}/billing`)}>
            {t("billing.title")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {LANGUAGES.find((l) => l.code === locale)?.flag ?? "🌐"}{" "}
              {LANGUAGES.find((l) => l.code === locale)?.label ?? "Language"}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => handleSwitchLocale(lang.code)}
                >
                  {lang.flag} {lang.label}
                  {lang.code === locale && " ✓"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              router.push(`/${locale}/login`);
            }}
          >
            {t("auth.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}
