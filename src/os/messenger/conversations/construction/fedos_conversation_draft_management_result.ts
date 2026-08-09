/**
 * Secure Runtime Alpha 1001 ("Draft Management Result Vocabulary") — Phase C of
 * the Alpha 991–1050 Conversation Invitation Transport & Draft Management Arc.
 *
 * Closed, fail-closed outcome vocabularies for the Draft Manager's two
 * mutating operations (delete/restore), mirroring every other result type in
 * this codebase (a union of `{ outcome: "..." }` shapes, never a boolean,
 * never a raw `Error`). A successful delete/restore carries the resulting
 * immutable draft summary so a caller sees the new managed state without a
 * second read.
 */

import type { FedosConversationDraftSummary } from "../../../../conversation/construction/fedos_conversation_managed_draft_state.js";

/**
 * Result of deleting (tombstoning) a draft.
 *   - `"deleted"`         — the draft's managed state is now `"tombstoned"`.
 *   - `"already-deleted"` — it was already tombstoned (idempotent).
 *   - `"not-found"`       — no durable draft record exists for this id.
 *   - `"unauthorized"`    — the actor may not manage this draft.
 *   - `"conflict"`        — a concurrent management write occupied the next
 *                           revision with different content.
 *   - `"unavailable"`     — a dependency/port was not available.
 */
export type FedosConversationDraftDeleteResult =
  | { readonly outcome: "deleted"; readonly summary: FedosConversationDraftSummary }
  | { readonly outcome: "already-deleted"; readonly summary: FedosConversationDraftSummary }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "conflict" }
  | { readonly outcome: "unavailable" };

/**
 * Result of restoring a tombstoned draft back to `"draft"`.
 *   - `"restored"`     — the draft's managed state is now `"draft"`.
 *   - `"not-deleted"`  — it was not tombstoned, so there is nothing to restore.
 *   - `"not-found"`    — no durable draft record exists for this id.
 *   - `"unauthorized"` — the actor may not manage this draft.
 *   - `"conflict"`     — a concurrent management write occupied the next
 *                        revision with different content.
 *   - `"unavailable"`  — a dependency/port was not available.
 */
export type FedosConversationDraftRestoreResult =
  | { readonly outcome: "restored"; readonly summary: FedosConversationDraftSummary }
  | { readonly outcome: "not-deleted"; readonly summary: FedosConversationDraftSummary }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "conflict" }
  | { readonly outcome: "unavailable" };
