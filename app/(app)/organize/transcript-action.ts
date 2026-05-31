// app/(app)/organize/transcript-action.ts
"use server";

import { getConversationTranscript } from "@/lib/queries/organizer";
import type { TranscriptEntry } from "@/lib/organizer/types";

export async function getTranscript(conversationId: string): Promise<TranscriptEntry[]> {
  return getConversationTranscript(conversationId);
}
