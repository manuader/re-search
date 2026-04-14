import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCreditBalance(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data } = await supabase.rpc("get_credit_balance", {
    p_user_id: userId,
  });
  return data ?? 0;
}

export async function getTransactionHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
) {
  const { data } = await supabase
    .from("transactions")
    .select("id, amount, type, description, project_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
