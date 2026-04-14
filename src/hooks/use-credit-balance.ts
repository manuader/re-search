"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCreditBalance() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchBalance() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.rpc("get_credit_balance", {
        p_user_id: user.id,
      });
      setBalance(data ?? 0);
      setLoading(false);
    }

    fetchBalance();
  }, []);

  return { balance, loading };
}
