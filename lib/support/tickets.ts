// lib/support/tickets.ts
// Pure support-ticket domain: allowed values, labels, and feedback validation.
// The value strings here MUST match the check constraints in
// supabase/migrations/0028_support_tickets.sql.

export type Option = { value: string; label: string };

export const CATEGORIES: Option[] = [
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "data", label: "Incorrect data" },
  { value: "suggestion", label: "Suggestion" },
  { value: "general", label: "General feedback" },
  { value: "complaint", label: "Complaint" },
];

export const STATUSES: Option[] = [
  { value: "new", label: "New" },
  { value: "in_review", label: "In review" },
  { value: "planned", label: "Planned" },
  { value: "fixed", label: "Fixed" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
];

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
export const statusLabel = (v: string): string => label(STATUSES, v);
export const priorityLabel = (v: string): string => label(PRIORITIES, v);

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
