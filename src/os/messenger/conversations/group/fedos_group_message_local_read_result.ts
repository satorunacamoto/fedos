/**
 * Secure Runtime Alpha 3081-3160 ("Desktop Runtime Conversation Content
 * Accessor and Application Shell Activation Arc") — the closed, coarse
 * result vocabulary for
 * `FedosConversationGroupRuntime.resolveLocalGroupMessagePlaintext()`
 * (`./fedos_conversation_group_runtime.ts`).
 *
 * Reuses `FedosConversationDirectMessageReadResult`'s own outcomes verbatim
 * for every case that genuinely reduces to a Direct read (the local
 * participant's own fanned-out copy IS a Direct Envelope under the hood —
 * see `fedos_group_send_coordinator.ts`'s own header), plus exactly two
 * NEW outcomes this Group-specific composition needs:
 *
 *   - `"own-message"` — the local participant is the SENDER of this Group
 *     Message. `sendGroupMessage()` never fans a message out to its own
 *     sender (only to `recipientIds`, explicitly excluding the sender's own
 *     membership id), so no Envelope of the sender's own exists to decrypt.
 *     This is an honest, structural gap in this base's own architecture —
 *     never worked around here by inventing a self-Envelope or caching the
 *     plaintext at send time (which would be an undocumented durable
 *     plaintext cache, forbidden by this Arc's own Phase E).
 *   - `"not-a-recipient"` — the local participant holds no fan-out delivery
 *     record for this Group Message at all (never a member of the
 *     recipient set for whatever reason, or a stale/foreign message id).
 */

import type { FedosConversationDirectMessageReadResult } from "../../../../conversation/messaging/fedos_conversation_direct_message_read_result.js";

export type FedosGroupMessageLocalReadResult =
  | FedosConversationDirectMessageReadResult
  | { readonly outcome: "own-message" }
  | { readonly outcome: "not-a-recipient" }
  | { readonly outcome: "identity-unavailable" };
