import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTransition, logTransition } from "@/lib/orders/state-machine";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership via RLS
  const { data: order, error } = await supabase
    .from("research_orders")
    .select("id, status, user_id, project_id")
    .eq("id", id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    assertTransition(order.status, "expired");
  } catch {
    return NextResponse.json(
      { error: `Cannot cancel order in status "${order.status}"` },
      { status: 409 }
    );
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("research_orders")
    .update({ status: "expired" })
    .eq("id", id)
    .eq("status", "pending_payment"); // optimistic lock

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to cancel order" },
      { status: 500 }
    );
  }

  logTransition({
    orderId: id,
    userId: user.id,
    projectId: order.project_id,
    fromStatus: "pending_payment",
    toStatus: "expired",
  });

  return NextResponse.json({ status: "expired" });
}
