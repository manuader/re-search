import { createClient } from "@/lib/supabase/server";
import { AdminError } from "./types";

/**
 * Verify that the current request comes from an authenticated admin.
 * Returns the admin's user ID on success.
 * Throws AdminError(404) on failure — 404 intentionally hides the route's existence.
 *
 * This is the SECOND layer of defense (middleware is the first).
 * Each API handler must call this even though middleware already checked.
 */
export async function assertAdmin(): Promise<{ adminId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AdminError(401, "unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new AdminError(404, "not_found");
  }

  return { adminId: user.id };
}
