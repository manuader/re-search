import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
} from "@/lib/orders/state-machine";
import type { OrderStatus } from "@/lib/orders/state-machine";

describe("canTransition", () => {
  const validTransitions: [OrderStatus, OrderStatus][] = [
    ["pending_payment", "paid"],
    ["pending_payment", "expired"],
    ["paid", "executing"],
    ["paid", "refund_pending"],
    ["executing", "completed"],
    ["executing", "completed_partial"],
    ["executing", "failed"],
    ["executing", "refund_pending"],
    ["failed", "refund_pending"],
    ["refund_pending", "refunded"],
  ];

  for (const [from, to] of validTransitions) {
    it(`allows ${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(true);
    });
  }

  const invalidTransitions: [OrderStatus, OrderStatus][] = [
    ["pending_payment", "executing"],
    ["pending_payment", "completed"],
    ["paid", "expired"],
    ["paid", "completed"],
    ["executing", "paid"],
    ["completed", "refunded"],
    ["completed", "executing"],
    ["completed_partial", "refunded"],
    ["expired", "paid"],
    ["refunded", "refund_pending"],
  ];

  for (const [from, to] of invalidTransitions) {
    it(`blocks ${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(false);
    });
  }
});

describe("assertTransition", () => {
  it("does not throw for valid transitions", () => {
    expect(() => assertTransition("pending_payment", "paid")).not.toThrow();
  });

  it("throws for invalid transitions with descriptive message", () => {
    expect(() => assertTransition("completed", "executing")).toThrowError(
      /Invalid order transition.*completed.*executing/
    );
  });
});
