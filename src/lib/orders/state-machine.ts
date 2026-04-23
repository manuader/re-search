export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "executing"
  | "completed"
  | "completed_partial"
  | "failed"
  | "refunded"
  | "refund_pending"
  | "expired";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "expired"],
  paid: ["executing", "refund_pending"],
  executing: ["completed", "completed_partial", "failed", "refund_pending"],
  completed: [],
  completed_partial: [],
  failed: ["refund_pending"],
  refund_pending: ["refunded"],
  refunded: [],
  expired: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid order transition: "${from}" → "${to}". Allowed from "${from}": [${VALID_TRANSITIONS[from].join(", ")}]`
    );
  }
}

export interface TransitionLog {
  orderId: string;
  userId: string;
  projectId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  actualCost?: number;
  priceCharged?: number;
  margin?: number;
  capTriggered?: boolean;
  durationMs?: number;
}

export function logTransition(log: TransitionLog): void {
  console.log(
    JSON.stringify({
      event: "order.transition",
      ...log,
      timestamp: new Date().toISOString(),
    })
  );
}
