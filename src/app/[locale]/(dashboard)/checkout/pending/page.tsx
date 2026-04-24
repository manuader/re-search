import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default async function CheckoutPendingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order_id?: string; external_reference?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const orderId = sp.order_id ?? sp.external_reference;
  const t = await getTranslations("checkout.pending");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  let projectId: string | null = null;

  if (orderId) {
    const { data: order } = await supabase
      .from("research_orders")
      .select("project_id")
      .eq("id", orderId)
      .single();

    projectId = order?.project_id ?? null;
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
          <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
        {projectId && (
          <Link
            href={`/${locale}/projects/${projectId}`}
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            {t("viewProject")}
          </Link>
        )}
      </Card>
    </div>
  );
}
