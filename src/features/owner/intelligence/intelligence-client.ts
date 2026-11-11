// The one place the assistant's interface talks to its backend.
//
// There is no backend yet. When the secure Edge Function exists, implement
// `askSherovIntelligence` here (send the conversation with the owner's
// Supabase session, return the reply) and flip `INTELLIGENCE_CONNECTED`. The
// chat panel needs no changes.
//
// Never put an AI provider key or any database credential in this file or
// anywhere else in the browser code: the key belongs in the Edge Function's
// secrets, and the function itself must check that the caller is the owner.

export type ChatRole = 'owner' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  at: string
}

export type AssistantReply =
  | { ok: true; text: string }
  /** No backend to ask: the interface shows its "not connected" notice. */
  | { ok: false; reason: 'not_connected' }
  /** The backend was asked and failed; `message` is safe to show. */
  | { ok: false; reason: 'error'; message: string }

/** Whether a backend is wired up. The panel shows its status from this. */
export const INTELLIGENCE_CONNECTED = false

/**
 * Asks the assistant. Today this always answers "not connected": it sends
 * nothing anywhere and never invents a reply.
 */
export async function askSherovIntelligence(history: readonly ChatMessage[]): Promise<AssistantReply> {
  void history
  return { ok: false, reason: 'not_connected' }
}
