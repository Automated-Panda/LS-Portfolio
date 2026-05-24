// lib/organizer/format-failure.ts
// One extra LLM call: rewrites the planner's structured failure into a
// friendly user-facing message. Adds ~$0.001 per failed plan generation.
// Uses Haiku 4.5 for cost; no prompt caching needed (rare event, small input).

import Anthropic from "@anthropic-ai/sdk";

import type { PlannerFailure } from "./types";

const MODEL = "claude-haiku-4-5";

export type FormatFailureInput = {
  failure: PlannerFailure;
  promptText: string;        // the user's original prompt for context
};

export async function formatFailure(
  input: FormatFailureInput,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fall back to a generic message if API key is missing.
    return defaultMessage(input.failure);
  }

  const client = new Anthropic({ apiKey });

  const failureSummary =
    input.failure.reason === "insufficient-capacity"
      ? `Total fleet exceeds total storage by ${input.failure.shortBy} cars. Suggestions: ${
          input.failure.suggestion
            ?.map((s) => `${s.display_name} (${s.capacity})`)
            .join(", ") ?? "none"
        }`
      : `Target requires uninstalled upgrades: ${input.failure.missingUpgradeIds.join(", ")}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `The user asked: "${input.promptText}"\n\nThe planner failed with: ${failureSummary}\n\nWrite a friendly 2-3 sentence message explaining the problem and what they can do next. Be specific about counts and properties. End with a one-line suggested next step.`,
        },
      ],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    return textBlock?.text ?? defaultMessage(input.failure);
  } catch {
    return defaultMessage(input.failure);
  }
}

function defaultMessage(failure: PlannerFailure): string {
  if (failure.reason === "insufficient-capacity") {
    return `Can't fit that one — you need about ${failure.shortBy} more storage slot${failure.shortBy === 1 ? "" : "s"}. Try browsing /properties for a bigger garage.`;
  }
  return `That target needs an upgrade that isn't installed yet. Install it from /my-properties first.`;
}
