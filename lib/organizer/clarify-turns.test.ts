import { describe, expect, it } from "vitest";

import { buildClarifyReply } from "./clarify-turns";
import { buildMessages } from "./intent-parser";
import type { Clarification, Turn } from "./types";

const CLAR: Clarification = {
  question: "I don't see Apt 30 in your portfolio. Which apartment did you mean?",
  suggestions: ["Eclipse Towers, Apt 3", "Eclipse Towers, Apt 12"],
};

describe("buildClarifyReply", () => {
  it("makes the user's answer the operative prompt, not the original", () => {
    const { parsePrompt } = buildClarifyReply({
      history: [],
      originalPrompt: "Move all Pegassi cars to Eclipse Towers, Apt 30",
      clarification: CLAR,
      answer: "Eclipse Towers, Apt 12",
    });

    // The whole point: the answer wins. Re-sending the ambiguous original is
    // exactly what made the organizer loop ("I don't see Apt 30") forever.
    expect(parsePrompt).toBe("Eclipse Towers, Apt 12");
  });

  it("replays the round-trip user-first and alternating", () => {
    const { priorTurns } = buildClarifyReply({
      history: [],
      originalPrompt: "Move all Pegassi cars to Eclipse Towers, Apt 30",
      clarification: CLAR,
      answer: "Eclipse Towers, Apt 12",
    });

    // Anthropic requires the first message to be a user turn.
    expect(priorTurns[0]?.role).toBe("user");
    // The original (ambiguous) prompt is the opening user turn...
    expect(priorTurns[0]).toEqual({
      role: "user",
      content: "Move all Pegassi cars to Eclipse Towers, Apt 30",
    });
    // ...followed by the assistant's clarification.
    expect(priorTurns[1]).toEqual({ role: "assistant", clarification: CLAR });
  });

  it("produces a well-formed message list ending in the answer", () => {
    const { parsePrompt, priorTurns } = buildClarifyReply({
      history: [],
      originalPrompt: "Move all Pegassi cars to Eclipse Towers, Apt 30",
      clarification: CLAR,
      answer: "Eclipse Towers, Apt 12",
    });

    const messages = buildMessages(parsePrompt, priorTurns);

    expect(messages[0]?.role).toBe("user");
    // Roles strictly alternate user/assistant/user...
    for (let i = 1; i < messages.length; i++) {
      expect(messages[i].role).not.toBe(messages[i - 1].role);
    }
    // ...and the model's final, authoritative message is the user's answer.
    const last = messages[messages.length - 1];
    expect(last.role).toBe("user");
    expect(last.content).toBe("Eclipse Towers, Apt 12");
  });

  it("accumulates across a second clarification round", () => {
    // Round 1 produced CLAR for the original prompt; user answered "Apt 12",
    // which the model STILL found ambiguous and asked CLAR2.
    const round1 = buildClarifyReply({
      history: [],
      originalPrompt: "Move all Pegassi cars to Eclipse Towers, Apt 30",
      clarification: CLAR,
      answer: "Eclipse Towers, Apt 12",
    });
    const CLAR2: Clarification = {
      question: "You own two Apt 12 units — high-end or mid?",
      suggestions: ["High-end", "Mid"],
    };

    const round2 = buildClarifyReply({
      history: round1.priorTurns,
      originalPrompt: round1.parsePrompt, // "Eclipse Towers, Apt 12"
      clarification: CLAR2,
      answer: "High-end",
    });

    const messages = buildMessages(round2.parsePrompt, round2.priorTurns);
    const roles = messages.map((m) => m.role);

    expect(roles).toEqual(["user", "assistant", "user", "assistant", "user"]);
    expect(messages[messages.length - 1].content).toBe("High-end");
  });
});
