import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCreditBalance, getTransactionHistory } from "@/lib/payments/credits";
import { CreditBalance } from "@/components/billing/credit-balance";
import { BuyCredits } from "@/components/billing/buy-credits";
import { TransactionHistory } from "@/components/billing/transaction-history";

export default async function BillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const [balance, transactions] = await Promise.all([
    getCreditBalance(supabase, user.id),
    getTransactionHistory(supabase, user.id),
  ]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <div className="flex gap-6 flex-col md:flex-row">
        <div className="md:w-80">
          <CreditBalance balance={balance} />
          <div className="mt-4">
            <BuyCredits />
          </div>
        </div>
        <div className="flex-1">
          <TransactionHistory transactions={transactions} />
        </div>
      </div>
    </div>
  );
}
