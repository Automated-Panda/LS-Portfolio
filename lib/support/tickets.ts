// lib/support/tickets.ts
// Pure support-ticket domain: allowed values, labels, colours, and feedback
// validation. The value strings here MUST match the check constraints in
// supabase/migrations/0028_support_tickets.sql (+ 0045 read_at).

export type Option = { value: string; label: string };

export const CATEGORIES: Option[] = [
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "data", label: "Incorrect data" },
  { value: "suggestion", label: "Suggestion" },
  { value: "general", label: "General feedback" },
  { value: "complaint", label: "Complaint" },
];

// Emoji marker per category (used in the inbox tabs + rows).
export const CATEGORY_ICON: Record<string, string> = {
  bug: "🐞",
  feature: "✨",
  data: "🗃️",
  suggestion: "💡",
  general: "💬",
  complaint: "⚠️",
};

// Workflow statuses offered in the UI. 'closed' was retired (it overlapped with
// the two terminal states and just added clutter) — it stays valid in the DB
// for legacy rows but is never offered for new selection. The two terminal
// states (fixed/rejected) carry NEUTRAL umbrella labels here; per-category
// wording lives in CATEGORY_STATUS_LABEL below.
export const STATUSES: Option[] = [
  { value: "new", label: "New" },
  { value: "in_review", label: "In review" },
  { value: "planned", label: "Planned" },
  { value: "fixed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

// Active = shown by default; resolved = hidden until the "show resolved" toggle.
// 'closed' is legacy-only and counts as resolved so old rows still hide.
export const ACTIVE_STATUSES = ["new", "in_review", "planned"] as const;
export const RESOLVED_STATUSES = ["fixed", "rejected", "closed"] as const;
export function isResolvedStatus(v: string): boolean {
  return (RESOLVED_STATUSES as readonly string[]).includes(v);
}

// Per-category wording for the two states that read differently by category.
// Anything not listed falls back to the neutral umbrella label in STATUSES.
const CATEGORY_STATUS_LABEL: Record<string, Record<string, string>> = {
  bug: { fixed: "Fixed", rejected: "Won't fix" },
  feature: { fixed: "Done", rejected: "Declined" },
  data: { fixed: "Corrected", rejected: "Won't change" },
  suggestion: { fixed: "Done", rejected: "Declined" },
  general: { fixed: "Noted", rejected: "Declined" },
  complaint: { fixed: "Resolved", rejected: "Dismissed" },
};

export const PRIORITIES: Option[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

const MAX_MESSAGE = 2000;
const MAX_RELATED = 200;

function has(options: Option[], value: string): boolean {
  return options.some((o) => o.value === value);
}
function label(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export const isValidCategory = (v: string): boolean => has(CATEGORIES, v);
export const isValidStatus = (v: string): boolean => has(STATUSES, v);
export const isValidPriority = (v: string): boolean => has(PRIORITIES, v);

export const categoryLabel = (v: string): string => label(CATEGORIES, v);
export const priorityLabel = (v: string): string => label(PRIORITIES, v);

/**
 * Human label for a status. Pass the ticket's category to get category-specific
 * wording for the terminal states (a bug is "Fixed", a feature is "Done"); omit
 * it for the neutral umbrella label used in the mixed "All" view.
 */
export function statusLabel(v: string, category?: string): string {
  if (v === "closed") return "Closed"; // legacy rows only
  if (category) {
    const specific = CATEGORY_STATUS_LABEL[category]?.[v];
    if (specific) return specific;
  }
  return label(STATUSES, v);
}

// Visual treatment per status. Tailwind classes are spelled out in full (static
// strings) so they survive purge. `accent` is a raw hex for inline use (dots,
// left borders) where a dynamic class won't do.
export type StatusStyle = {
  accent: string;
  dot: string;
  chip: string;
};
export const STATUS_STYLE: Record<string, StatusStyle> = {
  new: { accent: "#f59e0b", dot: "bg-amber-400", chip: "bg-amber-500/15 text-amber-300 border border-amber-500/40" },
  in_review: { accent: "#3b82f6", dot: "bg-blue-400", chip: "bg-blue-500/15 text-blue-300 border border-blue-500/40" },
  planned: { accent: "#8b5cf6", dot: "bg-violet-400", chip: "bg-violet-500/15 text-violet-300 border border-violet-500/40" },
  fixed: { accent: "#22c55e", dot: "bg-green-400", chip: "bg-green-500/15 text-green-300 border border-green-500/40" },
  rejected: { accent: "#f43f5e", dot: "bg-rose-400", chip: "bg-rose-500/15 text-rose-300 border border-rose-500/40" },
  closed: { accent: "#71717a", dot: "bg-zinc-400", chip: "bg-zinc-500/15 text-zinc-300 border border-zinc-500/40" },
};
export function statusStyle(v: string): StatusStyle {
  return STATUS_STYLE[v] ?? STATUS_STYLE.closed;
}

export type FeedbackInput = {
  category: string;
  message: string;
  relatedItem?: string | null;
};

export function validateFeedback(
  input: FeedbackInput,
): { ok: true } | { ok: false; error: string } {
  if (!isValidCategory(input.category)) return { ok: false, error: "Pick a category." };
  const msg = input.message.trim();
  if (!msg) return { ok: false, error: "Please enter a message." };
  if (msg.length > MAX_MESSAGE) return { ok: false, error: "Message is too long." };
  if ((input.relatedItem ?? "").length > MAX_RELATED) {
    return { ok: false, error: "Related item is too long." };
  }
  return { ok: true };
}
