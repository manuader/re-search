"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const PRESET_AMOUNTS = [5, 10, 25, 50]

export function BuyCredits() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveAmount = customAmount
    ? parseFloat(customAmount)
    : selectedAmount

  async function handleBuyCredits() {
    if (!effectiveAmount || effectiveAmount <= 0) {
      setError("Please select or enter a valid amount.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/payments/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: effectiveAmount }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? "Failed to create payment preference.")
      }

      const { initPoint } = await res.json()
      window.location.href = initPoint
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="mb-2">Select amount</Label>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_AMOUNTS.map((amount) => (
            <Button
              key={amount}
              variant={selectedAmount === amount && !customAmount ? "default" : "outline"}
              onClick={() => {
                setSelectedAmount(amount)
                setCustomAmount("")
                setError(null)
              }}
            >
              ${amount}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="custom-amount" className="mb-2">
          Custom amount
        </Label>
        <Input
          id="custom-amount"
          type="number"
          min="1"
          step="0.01"
          placeholder="Enter amount..."
          value={customAmount}
          onChange={(e) => {
            setCustomAmount(e.target.value)
            setSelectedAmount(null)
            setError(null)
          }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleBuyCredits}
        disabled={loading || !effectiveAmount || effectiveAmount <= 0}
        className="w-full"
      >
        {loading ? "Processing..." : "Buy Credits"}
      </Button>
    </div>
  )
}
