// lib/notifications/messages.test.ts
import { describe, it, expect } from "vitest";
import { creditAdjustmentNotification } from "./messages";

describe("creditAdjustmentNotification", () => {
  it("frames a positive delta as a gift", () => {
    const n = creditAdjustmentNotification(50, 80);
    expect(n.type).toBe("credit_adjustment");
    expect(n.title).toContain("received");
    expect(n.body).toContain("50");
    expect(n.body).toContain("80");
    expect(n.data).toEqual({ delta: 50, newTotal: 80 });
  });
  it("frames a negative delta as an adjustment, not a gift", () => {
    const n = creditAdjustmentNotification(-20, 10);
    expect(n.title).not.toContain("received");
    expect(n.body).toContain("-20");
  });
});
