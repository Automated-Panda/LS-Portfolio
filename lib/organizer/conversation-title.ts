// Derives a clean conversation title from a parsed intent, e.g.
// "Drift cars → Mission Row". No extra API call — reuses the parse we already
// did. Falls back to a tidied prompt when the intent has no usable criteria.
import type { ParsedIntent } from "./types";

const MAX_TITLE = 80;

function sentenceCase(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** Tidy a raw prompt as a fallback title: sentence-case, collapse whitespace, cap length. */
export function titleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  const capped = clean.length > MAX_TITLE ? `${clean.slice(0, MAX_TITLE - 1).trimEnd()}…` : clean;
  return sentenceCase(capped) || "New plan";
}

/**
 * Build a structured title from the parsed intent + a property-id→name map.
 * One criterion → "Drift cars → Mission Row". Two → joined with " · ".
 * Three or more → "<first> +N more". Unknown targets fall back to the prompt.
 */
export function conversationTitle(
  intent: ParsedIntent,
  propertyNameById: Map<string, string>,
  prompt: string,
): string {
  const parts = intent.criteria
    .map((c) => {
      const what = sentenceCase(c.description.trim());
      const where = propertyNameById.get(c.target.property_id);
      if (!what) return null;
      return where ? `${what} → ${where}` : what;
    })
    .filter((p): p is string => Boolean(p));

  if (parts.length === 0) return titleFromPrompt(prompt);

  let title: string;
  if (parts.length === 1) title = parts[0];
  else if (parts.length === 2) title = `${parts[0]} · ${parts[1]}`;
  else title = `${parts[0]} +${parts.length - 1} more`;

  return title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1).trimEnd()}…` : title;
}
