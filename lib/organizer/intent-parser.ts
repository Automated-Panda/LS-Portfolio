// lib/organizer/intent-parser.ts
// Calls Claude Haiku 4.5 to parse a relocation prompt into structured intent
// OR a clarification request. Uses prompt caching on the static + per-user
// taxonomy blocks so repeated queries within the same fleet/property state
// cost ~10% of the full input rate.

import Anthropic from "@anthropic-ai/sdk";

import type { Clarification, ParsedIntent, Turn } from "./types";

const MODEL = "claude-haiku-4-5";

// Behavior block — static, cached.
const BEHAVIOR_INSTRUCTIONS = `You are an intent parser for GT Vault, a GTA Online asset tracker. The user describes how they want their vehicles relocated across the properties they own. Your only job is to call the parse_intent tool.

You MUST:
- Use the parse_intent tool to respond (never plain text).
- Provide EITHER \`intent\` OR \`clarification\` in your tool input — never both.
- Only use property_id, upgrade_id, tag id, custom_tag, class, and manufacturer values that appear in the USER PORTFOLIO block below.
- If a request is ambiguous (target unclear, multiple matches, etc.), provide a clarification with 2-4 short suggestions.
- For compound requests like "put X in A and Y in B", emit multiple criteria in one intent.
- For "favourite"/"favourites"/"starred"/"my favorites" cars, set filter.favourites = true (combine with other fields as needed, e.g. favourite Supers).
- "leave the rest" or no mention of other cars → unmatched_handling = "leave".
- "and consolidate the rest" or similar → unmatched_handling = "consolidate-to-target".

NEVER invent ids. NEVER guess. When in doubt, clarify.`;

// Tool definition — static, cached.
const PARSE_INTENT_TOOL: Anthropic.Tool = {
  name: "parse_intent",
  description: "Parse the relocation request OR ask for clarification.",
  input_schema: {
    type: "object",
    properties: {
      intent: {
        type: "object",
        properties: {
          criteria: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                filter: {
                  type: "object",
                  properties: {
                    tags: { type: "array", items: { type: "string" } },
                    custom_tags: { type: "array", items: { type: "string" } },
                    classes: { type: "array", items: { type: "string" } },
                    manufacturers: { type: "array", items: { type: "string" } },
                    favourites: { type: "boolean" },
                  },
                },
                target: {
                  type: "object",
                  properties: {
                    property_id: { type: "string" },
                    upgrade_id: { type: "string" },
                  },
                  required: ["property_id"],
                },
              },
              required: ["description", "filter", "target"],
            },
          },
          unmatched_handling: { type: "string", enum: ["leave", "consolidate-to-target"] },
        },
        required: ["criteria", "unmatched_handling"],
      },
      clarification: {
        type: "object",
        properties: {
          question: { type: "string" },
          suggestions: { type: "array", items: { type: "string" } },
        },
        required: ["question"],
      },
    },
  },
};

export type IntentParserInput = {
  prompt: string;
  portfolioContext: string;          // built by portfolio-context.ts
  clarifyingHistory?: Turn[];        // prior turns when answering a clarification
};

export type IntentParserResult =
  | { ok: true; intent: ParsedIntent }
  | { ok: false; clarification: Clarification }
  | { error: string };

/**
 * Build the Anthropic message list from the operative prompt + the prior
 * clarification round-trip. The conversation MUST start with a user turn,
 * alternate roles, and end with `prompt` (the latest user message) so the
 * model treats it as the authoritative request. `clarifyingHistory` is
 * therefore expected to be well-ordered (user-first, alternating) — see
 * buildClarifyReply, which constructs it.
 */
export function buildMessages(
  prompt: string,
  clarifyingHistory?: Turn[],
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];
  for (const turn of clarifyingHistory ?? []) {
    if (turn.role === "user") {
      messages.push({ role: "user", content: turn.content });
    } else {
      // Assistant clarification — represent as plain assistant text describing
      // the prior question (the suggestions aren't needed to re-establish context).
      messages.push({
        role: "assistant",
        content: `Previously I asked: "${turn.clarification.question}"`,
      });
    }
  }
  messages.push({ role: "user", content: prompt });
  return messages;
}

export async function parseIntent(
  input: IntentParserInput,
): Promise<IntentParserResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY not configured." };

  const client = new Anthropic({ apiKey });

  const messages = buildMessages(input.prompt, input.clarifyingHistory);

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        // Behavior + tool schema block — static, cached.
        {
          type: "text",
          text: BEHAVIOR_INSTRUCTIONS,
          cache_control: { type: "ephemeral" },
        },
        // Portfolio taxonomy block — per-user, cached.
        {
          type: "text",
          text: input.portfolioContext,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [PARSE_INTENT_TOOL],
      tool_choice: { type: "tool", name: "parse_intent" },
      messages,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  // Extract the tool_use block.
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) return { error: "Model did not call parse_intent tool." };

  const inp = toolUse.input as {
    intent?: ParsedIntent;
    clarification?: Clarification;
  };

  if (inp.intent) return { ok: true, intent: inp.intent };
  if (inp.clarification) return { ok: false, clarification: inp.clarification };
  return { error: "Tool input contained neither intent nor clarification." };
}
