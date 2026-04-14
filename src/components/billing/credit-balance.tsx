"use client"

interface CreditBalanceProps {
  balance: number
}

export function CreditBalance({ balance }: CreditBalanceProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 p-6 text-white">
      <p className="text-sm opacity-80">Available Credits</p>
      <p className="my-2 text-4xl font-bold">${balance.toFixed(2)}</p>
      <p className="text-xs opacity-70">~{Math.max(1, Math.floor(balance / 7))} research projects</p>
    </div>
  )
}
