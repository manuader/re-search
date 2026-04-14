# Phase 7: Payments + Credits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the credit purchase system with Mercado Pago Checkout Pro, webhook handling, billing page with balance + transaction history, and credit balance display.

**Architecture:** User selects credit amount → POST creates MP preference → redirect to MP checkout → user pays → MP webhook verifies signature and inserts transaction → user redirected back to billing. Balance = SUM(transactions).

**Tech Stack:** Mercado Pago SDK (mercadopago), Supabase, shadcn/ui, Next.js API routes

---

## File Structure

```
src/
├── lib/
│   └── payments/
│       ├── mercadopago.ts              # NEW: MP SDK wrapper — create preference
│       └── credits.ts                  # NEW: credit balance helpers
├── app/
│   ├── api/
│   │   ├── payments/
│   │   │   └── create-preference/route.ts  # NEW: POST — create MP checkout preference
│   │   └── webhooks/
│   │       └── mercadopago/route.ts    # NEW: POST — MP webhook handler
│   └── [locale]/(dashboard)/
│       └── billing/page.tsx            # NEW: billing page
├── components/
│   └── billing/
│       ├── credit-balance.tsx          # NEW: balance card
│       ├── buy-credits.tsx             # NEW: purchase form with amount selection
│       └── transaction-history.tsx     # NEW: transaction list
```

---

### Task 1: Install Mercado Pago SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install mercadopago
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install mercadopago SDK"
```

---

### Task 2: Mercado Pago Client + Credits Helper

**Files:**
- Create: `src/lib/payments/mercadopago.ts`
- Create: `src/lib/payments/credits.ts`

- [ ] **Step 1: Fetch latest Mercado Pago SDK docs via context7 MCP**

Look up the `mercadopago` npm package — specifically:
- How to initialize the client with access token
- How to create a Checkout Pro preference
- The preference structure (items, back_urls, notification_url)

- [ ] **Step 2: Create MP client wrapper**

Create `src/lib/payments/mercadopago.ts`:

```typescript
import { MercadoPagoConfig, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

interface CreatePreferenceParams {
  userId: string;
  amount: number;
  locale: string;
  appUrl: string;
}

export async function createCreditPreference({
  userId,
  amount,
  locale,
  appUrl,
}: CreatePreferenceParams) {
  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: [
        {
          id: "credits",
          title: locale === "es" ? "Creditos ResearchBot" : "ResearchBot Credits",
          quantity: 1,
          unit_price: amount,
          currency_id: "ARS", // or USD depending on config
        },
      ],
      back_urls: {
        success: `${appUrl}/${locale}/billing?status=success`,
        failure: `${appUrl}/${locale}/billing?status=failure`,
        pending: `${appUrl}/${locale}/billing?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
      metadata: {
        user_id: userId,
        amount: amount,
      },
      external_reference: userId,
    },
  });

  return result;
}
```

- [ ] **Step 3: Create credits helper**

Create `src/lib/payments/credits.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

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
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/payments/
git commit -m "feat: add Mercado Pago client + credit balance helpers"
```

---

### Task 3: Create Preference API Route

**Files:**
- Create: `src/app/api/payments/create-preference/route.ts`

- [ ] **Step 1: Create the route**

POST endpoint:
1. Auth check
2. Receive `{ amount }` from body (validate: min $5, max $500)
3. Get user's locale from profile
4. Call `createCreditPreference()` 
5. Return `{ preferenceId: result.id, initPoint: result.init_point }`

`init_point` is the URL the client redirects to for MP Checkout.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/payments/
git commit -m "feat: add create-preference API route for Mercado Pago"
```

---

### Task 4: Webhook Handler

**Files:**
- Create: `src/app/api/webhooks/mercadopago/route.ts`

- [ ] **Step 1: Create webhook route**

POST endpoint:
1. Parse the webhook body — MP sends payment notifications
2. Verify the webhook is authentic (check `x-signature` header with HMAC using `MERCADOPAGO_WEBHOOK_SECRET`)
3. If payment type is "payment" and status is "approved":
   - Extract `metadata.user_id` and `metadata.amount` from the payment
   - Fetch payment details from MP API to confirm amount
   - INSERT transaction: `{ user_id, amount: +amount, type: 'credit_purchase', description: 'Credit purchase via Mercado Pago' }`
4. Return 200 OK (MP retries on non-200)

For the webhook verification, MP sends:
- `x-signature` header with format `ts=TIMESTAMP,v1=HASH`
- Verify: HMAC-SHA256 of `id:PAYMENT_ID;request-id:REQUEST_ID;ts:TIMESTAMP;` with webhook secret

Use `createAdminClient()` for DB operations (webhook has no user session).

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/
git commit -m "feat: add Mercado Pago webhook handler — verifies signature, inserts credit transaction"
```

---

### Task 5: Billing UI Components

**Files:**
- Create: `src/components/billing/credit-balance.tsx`
- Create: `src/components/billing/buy-credits.tsx`
- Create: `src/components/billing/transaction-history.tsx`

- [ ] **Step 1: Create credit balance card**

`credit-balance.tsx` — "use client":
- Props: `balance: number`
- Gradient card (blue→purple) showing balance
- Subtitle: "~X research projects" (rough estimate: balance / 7)

- [ ] **Step 2: Create buy credits form**

`buy-credits.tsx` — "use client":
- Preset buttons: $5, $10, $25, $50
- Custom amount input
- "Buy Credits" button
- On click: POST to `/api/payments/create-preference` with amount
- On success: redirect to `initPoint` URL (MP checkout)
- Loading state while creating preference

- [ ] **Step 3: Create transaction history**

`transaction-history.tsx`:
- Props: `transactions: { id, amount, type, description, created_at }[]`
- Table with: date, description, amount (green for positive, red for negative)
- Type badges: credit_purchase, scraping_reserve, scraping_cost, ai_cost, refund

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/billing/
git commit -m "feat: add billing components — balance card, buy credits, transaction history"
```

---

### Task 6: Billing Page

**Files:**
- Create: `src/app/[locale]/(dashboard)/billing/page.tsx`

- [ ] **Step 1: Create billing page**

Server component:
1. Auth check
2. Fetch credit balance via `getCreditBalance()`
3. Fetch transaction history via `getTransactionHistory()`
4. Check URL search params for `status` (success/failure/pending from MP redirect)
5. Render: CreditBalance + BuyCredits side by side, TransactionHistory below
6. Show success/failure toast based on URL status param

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/(dashboard)/billing/"
git commit -m "feat: add billing page — credit balance, purchase, transaction history"
```

---

### Task 7: Add Billing i18n Messages

**Files:**
- Modify: `src/messages/en.json`
- Modify: `src/messages/es.json`

Add any missing billing-related translation keys needed by the new components. Check what keys are already in the messages files and add only what's missing.

- [ ] **Step 1: Check existing messages and add missing keys**

Read en.json and es.json, then add keys for:
- Payment status messages (success, failure, pending)
- Buy credits labels
- Transaction type labels

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/messages/
git commit -m "feat: add billing i18n messages — payment status, transaction types"
```

---

### Task 8: Final Build Verification

- [ ] **Step 1: Full build**

```bash
npm run build
```

Verify new routes:
- `/[locale]/billing` — billing page
- `/api/payments/create-preference` — MP preference creation
- `/api/webhooks/mercadopago` — webhook handler

- [ ] **Step 2: Verify git log**

```bash
git log --oneline | head -12
```
