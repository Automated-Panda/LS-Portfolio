// lib/email/templates/credits-adjusted.test.ts
import { describe, it, expect } from "vitest";
import { creditsAdjustedEmail } from "./credits-adjusted";

describe("creditsAdjustedEmail", () => {
  it("uses a gift subject + shows the amount and new balance for a positive delta", () => {
    const { subject, html } = creditsAdjustedEmail({ delta: 50, newBalance: 80 });
    expect(subject).toContain("received");
    expect(html).toContain("50");
    expect(html).toContain("80");
  });
  it("uses a neutral subject for a negative delta", () => {
    const { subject } = creditsAdjustedEmail({ delta: -20, newBalance: 10 });
    expect(subject).not.toContain("received");
  });
  it("escapes a note to prevent HTML injection", () => {
    const { html } = creditsAdjustedEmail({ delta: 5, newBalance: 5, note: "<script>x</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
