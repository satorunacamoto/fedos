/**
 * Secure Runtime Alpha 908 ("Construction ID Authority") — Phase B of the
 * Alpha 891–930 Private Conversation Draft Construction and Readiness
 * Runtime Arc.
 *
 * A `private-group`/`direct` Conversation has no Board thread, so the
 * public `toFedosConversationId(boardId, threadId)` derivation
 * (`../fedos_conversation_id.ts`, Alpha 743, unmodified) does not apply.
 * This file supplies the SECOND, namespaced constructor a standalone
 * private draft needs — deterministic from an injected, opaque request id
 * (never caller-supplied, never a protocol-native id), mirroring
 * `toFedosConversationId`'s own "deterministic from an already-existing
 * value, `::`-joined, no random minting in this file" discipline exactly.
 *
 * The `"private-draft"` namespace prefix guarantees a private draft id
 * can NEVER collide with a public `boardId::threadId` id (a `FedosBoardId`
 * is a single `::`-free segment, so no public id begins with the literal
 * segment `"private-draft"` followed by `::` unless a board were named
 * exactly `"private-draft"`, which is itself a `::`-free board id whose
 * derived conversation id would be `private-draft::<threadId>` — still
 * distinct, because THIS constructor always emits a THREE-segment
 * `private-draft::<mode>::<requestId>` shape a two-segment public id can
 * never match).
 *
 * `../fedos_conversation_id.ts`'s own header reserves that file for
 * exactly two exports; this second, private-track constructor lives here
 * instead of widening that frozen file, and still returns the SAME
 * branded `FedosConversationId` so every mode-agnostic Membership /
 * Capability / Persistence authority (all confirmed to accept ANY
 * `FedosConversationId` with no mode check) keys off it unchanged.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";

export type FedosPrivateConversationMode = "private-group" | "direct";

/**
 * Deterministic — the same `(mode, requestId)` pair always yields the
 * identical id, giving construction idempotency for free (a retried
 * construction with the same request id re-derives the same Conversation
 * id, so `putDraft()` returns `"already-present"` rather than minting a
 * second record). `requestId` is an opaque, non-empty, `::`-free string
 * minted by an injected id generator (Alpha 908), never chosen by a
 * caller.
 */
export function toFedosPrivateConversationId(mode: FedosPrivateConversationMode, requestId: string): FedosConversationId {
  return `private-draft::${mode}::${requestId}` as FedosConversationId;
}

/** `true` iff `id` was produced by `toFedosPrivateConversationId` — used only for read-side classification, never for authorization. */
export function isFedosPrivateConversationId(id: FedosConversationId): boolean {
  return (id as string).startsWith("private-draft::");
}
