import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get credit balance and recent projects in parallel
  let creditBalance = 0;
  let projects: { id: string; title: string; status: string; created_at: string }[] = [];

  if (user) {
    const [balanceResult, projectsResult] = await Promise.all([
      supabase.rpc("get_credit_balance", { p_user_id: user.id }),
      supabase
        .from("research_projects")
        .select("id, title, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    creditBalance = balanceResult.data ?? 0;
    projects = projectsResult.data ?? [];
  }

  return (
    <div className="flex h-screen">
      <Sidebar creditBalance={creditBalance} projects={projects} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
