import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * @deprecated Credits system replaced by pay-per-use orders.
 * Always returns 0. Kept temporarily to detect stale callers.
 */
export async function getCreditBalance(
  _supabase: SupabaseClient,
  _userId: string
): Promise<number> {
  console.warn(
    "[DEPRECATED] getCreditBalance called — credits system has been replaced by pay-per-use"
  );
  return 0;
}

/**
 * @deprecated Use research_orders table instead.
 */
export async function getTransactionHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
) {
  console.warn(
    "[DEPRECATED] getTransactionHistory called — use research_orders instead"
  );
  const { data } = await supabase
    .from("transactions")
    .select("id, amount, type, description, project_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
