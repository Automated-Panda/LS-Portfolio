// lib/organizer/types.ts
// Shared types for the AI organizer. Used across intent parsing, validation,
// the deterministic planner, apply/undo flows, and the chat UI.

// ----- Vehicle filter (one criterion's targeting) -----

export type VehicleFilter = {
  tags?: string[];          // system tag ids — match vehicle_tag_links.tag_id
  custom_tags?: string[];   // user-defined tags — match user_owned_vehicles.custom_tags
  classes?: string[];       // formatted class names ("Super", "Sports")
  manufacturers?: string[]; // manufacturer ids
};

// ----- Parsed intent (LLM output, post-validation) -----

export type ParsedIntent = {
  criteria: Array<{
    description: string;                          // human-readable label
    filter: VehicleFilter;
    target: {
      property_id: string;                        // user_owned_properties.id
      upgrade_id?: string;                        // optional — null/missing = planner picks
    };
  }>;
  unmatched_handling: "leave" | "consolidate-to-target";
};

// ----- Plan step (one move or unassignment) -----

export type PlanStep = {
  index: number;
  type: "move" | "unassign";
  owned_vehicle_id: string;
  vehicle_label: string;
  from: { property_id: string; upgrade_id: string | null; label: string };
  to:   { property_id: string | null; upgrade_id: string | null; label: string };
  reason: "user-asked" | "displaced";
  completed_at: string | null;
};

// ----- Plan summary (rendered above the step list) -----

export type PlanSummary = {
  total_steps: number;
  cars_moved: number;
  cars_unassigned: number;
  displacements: number;
  conflicts: string[];
};

// ----- Undo snapshot (pre-apply state of touched vehicles) -----

export type UndoSnapshot = {
  vehicles: Array<{
    owned_vehicle_id: string;
    stored_in_property_id: string | null;
    assigned_upgrade_id: string | null;
  }>;
};

// ----- Planner inputs / outputs -----

export type PlannerFailure =
  | {
      reason: "insufficient-capacity";
      shortBy: number;
      suggestion?: Array<{ id: string; display_name: string; capacity: number }>;
    }
  | {
      reason: "target-not-built";
      missingUpgradeIds: string[];
    };

export type PlannerResult =
  | { ok: true; steps: PlanStep[]; summary: PlanSummary }
  | { ok: false; failure: PlannerFailure };

// ----- Clarification (LLM round-trip when prompt is ambiguous) -----

export type Clarification = {
  question: string;
  suggestions: string[];
};

// ----- Conversation turn (used when the user replies to a clarification) -----

export type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; clarification: Clarification };

// ----- Rendered transcript entry (one request + its plan), UI-side -----

export type TranscriptEntry = {
  planId: string;
  prompt: string;
  steps: PlanStep[];
  summary: PlanSummary;
  status: string; // organizer_plan_status
};
