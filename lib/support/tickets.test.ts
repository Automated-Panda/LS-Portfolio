// lib/support/tickets.test.ts
import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  STATUSES,
  PRIORITIES,
  isValidCategory,
  isValidStatus,
  isValidPriority,
  categoryLabel,
  statusLabel,
  priorityLabel,
  validateFeedback,
} from "./tickets";

describe("option lists", () => {
  it("expose the six categories, five statuses (Closed retired), three priorities", () => {
    expect(CATEGORIES).toHaveLength(6);
    expect(STATUSES).toHaveLength(5);
    expect(STATUSES.map((s) => s.value)).not.toContain("closed");
    expect(PRIORITIES).toHaveLength(3);
  });
});

describe("validators", () => {
  it("accept known values and reject unknown", () => {
    expect(isValidCategory("bug")).toBe(true);
    expect(isValidCategory("nope")).toBe(false);
    expect(isValidStatus("in_review")).toBe(true);
    expect(isValidStatus("nope")).toBe(false);
    expect(isValidPriority("high")).toBe(true);
    expect(isValidPriority("nope")).toBe(false);
  });
});

describe("labels", () => {
  it("map values to human labels, falling back to the value", () => {
    expect(categoryLabel("bug")).toBe("Bug report");
    expect(statusLabel("in_review")).toBe("In review");
    expect(priorityLabel("high")).toBe("High");
    expect(statusLabel("unknown")).toBe("unknown");
  });

  it("uses the neutral umbrella label for terminal states without a category", () => {
    expect(statusLabel("fixed")).toBe("Completed");
    expect(statusLabel("rejected")).toBe("Rejected");
  });

  it("uses category-specific wording for terminal states when given a category", () => {
    expect(statusLabel("fixed", "bug")).toBe("Fixed");
    expect(statusLabel("fixed", "feature")).toBe("Done");
    expect(statusLabel("fixed", "complaint")).toBe("Resolved");
    expect(statusLabel("rejected", "bug")).toBe("Won't fix");
    expect(statusLabel("rejected", "feature")).toBe("Declined");
    // Non-terminal states ignore category.
    expect(statusLabel("new", "feature")).toBe("New");
  });

  it("still labels legacy 'closed' rows", () => {
    expect(statusLabel("closed")).toBe("Closed");
  });
});

describe("validateFeedback", () => {
  it("accepts a valid submission", () => {
    expect(validateFeedback({ category: "bug", message: "It broke" })).toEqual({ ok: true });
  });
  it("rejects an unknown category", () => {
    expect(validateFeedback({ category: "x", message: "hi" }).ok).toBe(false);
  });
  it("rejects an empty message", () => {
    expect(validateFeedback({ category: "bug", message: "   " }).ok).toBe(false);
  });
  it("rejects an over-long message", () => {
    expect(validateFeedback({ category: "bug", message: "a".repeat(2001) }).ok).toBe(false);
  });
  it("rejects an over-long related item", () => {
    expect(
      validateFeedback({ category: "bug", message: "ok", relatedItem: "a".repeat(201) }).ok,
    ).toBe(false);
  });
});
