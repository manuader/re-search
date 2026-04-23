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

  let projects: { id: string; title: string; status: string; created_at: string }[] = [];

  if (user) {
    const { data } = await supabase
      .from("research_projects")
      .select("id, title, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    projects = data ?? [];
  }

  return (
    <div className="flex h-screen">
      <Sidebar projects={projects} userEmail={user?.email ?? ""} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
