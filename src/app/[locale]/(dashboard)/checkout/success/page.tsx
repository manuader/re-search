import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order_id?: string; external_reference?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const orderId = sp.order_id ?? sp.external_reference;
  const t = await getTranslations("checkout.success");

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
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
        {projectId && (
          <Link
            href={`/${locale}/projects/${projectId}`}
            className={buttonVariants({ className: "w-full" })}
          >
            {t("viewProject")}
          </Link>
        )}
      </Card>
    </div>
  );
}
