import { describe, it, expect } from "vitest";
import { planCost, messageCost, TWEAK_COST, CHAT_COST } from "./constants";

describe("planCost", () => {
  it("charges the base cost for a single intent", () => {
    expect(planCost(1)).toBe(5);
  });
  it("adds 2 credits per extra intent", () => {
    expect(planCost(3)).toBe(9); // 5 + 2 + 2
  });
  it("charges nothing for zero / invalid intent counts", () => {
    expect(planCost(0)).toBe(0);
    expect(planCost(-2)).toBe(0);
  });
});

describe("messageCost (with 1-credit conversation floor)", () => {
  it("charges the plan cost when a plan is produced", () => {
    expect(messageCost(1)).toBe(5);
    expect(messageCost(3)).toBe(9);
  });
  it("falls back to a 1-credit floor when no plan is produced", () => {
    expect(messageCost(0)).toBe(1); // clarifying question / failed parse
  });
});

describe("fixed costs", () => {
  it("tweak is 1, chat is 2", () => {
    expect(TWEAK_COST).toBe(1);
    expect(CHAT_COST).toBe(2);
  });
});
