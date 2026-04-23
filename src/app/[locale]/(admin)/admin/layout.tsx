import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const metadata = {
  robots: "noindex, nofollow",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, email")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) notFound();

  return (
    <div className="flex h-screen">
      <AdminSidebar adminEmail={profile.email ?? user.email ?? ""} />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="border-b border-red-500/30 bg-red-500/5 px-4 py-1.5 text-center text-xs font-medium text-red-600 dark:text-red-400">
          ADMIN MODE
        </div>
        {children}
      </main>
    </div>
  );
}
