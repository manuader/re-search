"use client";

import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("project");
  const params = useParams<{ id: string }>();

  const basePath = `/${locale}/projects/${params.id}`;

  const tabs = [
    { label: t("chat"), href: basePath },
    { label: t("data"), href: `${basePath}/data` },
    { label: t("report"), href: `${basePath}/report` },
  ];

  return (
    <div className="flex h-full flex-col">
      <nav className="flex border-b px-4">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== basePath && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
