"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  DollarSign,
  Users,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface AdminSidebarProps {
  adminEmail: string;
}

export function AdminSidebar({ adminEmail }: AdminSidebarProps) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const pathname = usePathname();

  const navItems = [
    { href: `/${locale}/admin`, icon: LayoutDashboard, label: t("nav.overview") },
    { href: `/${locale}/admin/costs`, icon: DollarSign, label: t("nav.costs") },
    { href: `/${locale}/admin/users`, icon: Users, label: t("nav.users") },
    { href: `/${locale}/admin/orders`, icon: FileText, label: t("nav.orders") },
  ];

  function isActive(href: string): boolean {
    if (href === `/${locale}/admin`) {
      return pathname === `/${locale}/admin`;
    }
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-muted/30 p-4">
      <div className="mb-4 px-2">
        <p className="text-sm font-bold text-red-600 dark:text-red-400">
          {t("nav.title")}
        </p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
              isActive(item.href)
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>

      <Separator className="my-2" />

      <div className="space-y-2">
        <Link
          href={`/${locale}/dashboard`}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {t("nav.backToApp")}
        </Link>
        <p className="px-2 text-xs text-muted-foreground truncate">
          {adminEmail}
        </p>
      </div>
    </aside>
  );
}
