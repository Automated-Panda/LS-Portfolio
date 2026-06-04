// lib/organizer/clarify-turns.ts
// Pure helper that builds the (parsePrompt, priorTurns) pair to send when the
// user answers a clarifying question. Extracted from the chat component so the
// conversation-shape invariant is unit-testable.

import type { Clarification, Turn } from "./types";

export type ClarifyReplyArgs = {
  /** Turns that preceded the prompt which produced this clarification. */
  history: Turn[];
  /** The prompt the model asked us to clarify. */
  originalPrompt: string;
  /** The clarifying question (+ suggestions) the model returned. */
  clarification: Clarification;
  /** What the user just answered (typed text or a clicked suggestion). */
  answer: string;
};

export type ClarifyReply = {
  /** The operative prompt — becomes the final user message to the model. */
  parsePrompt: string;
  /** The replayed prior conversation (must be user-first + alternating). */
  priorTurns: Turn[];
};

/**
 * Build the next parse request after the user answers a clarification.
 *
 * The answer must become the operative prompt (the LAST user message the model
 * sees), and the prior round-trip must be replayed user-first so the message
 * list is well-formed for the Anthropic API.
 */
export function buildClarifyReply(args: ClarifyReplyArgs): ClarifyReply {
  return {
    // The answer is the operative request — it becomes the final user message.
    parsePrompt: args.answer,
    // Replay the round-trip user-first: the original (ambiguous) prompt, then
    // the assistant's clarifying question. The answer is NOT included here; it
    // rides as parsePrompt so the model sees it last.
    priorTurns: [
      ...args.history,
      { role: "user", content: args.originalPrompt },
      { role: "assistant", clarification: args.clarification },
    ],
  };
}
