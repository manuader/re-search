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

  // Get credit balance
  let creditBalance = 0;
  if (user) {
    const { data } = await supabase.rpc("get_credit_balance", {
      p_user_id: user.id,
    });
    creditBalance = data ?? 0;
  }

  return (
    <div className="flex h-screen">
      <Sidebar creditBalance={creditBalance} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
