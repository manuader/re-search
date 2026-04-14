import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCreditPreference } from "@/lib/payments/mercadopago";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { amount } = body;

  if (typeof amount !== "number" || amount < 5 || amount > 500) {
    return NextResponse.json(
      { error: "Amount must be a number between 5 and 500" },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Could not retrieve user profile" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const result = await createCreditPreference({
    userId: user.id,
    amount,
    locale: profile.locale,
    appUrl,
  });

  return NextResponse.json({
    preferenceId: result.id,
    initPoint: result.init_point,
  });
}
