/**
 * Secure Runtime Alpha 1471–1540 ("Private Transport Boundary and
 * Multi-Relay Delivery Arc") — Mailbox Delivery's own durable Outbox.
 *
 * Mirrors `FedosBoardOutboxIntent`/`FedosBoardOutboxId`
 * (`../../board/outbox/fedos_board_outbox_types.ts`, Alpha 413/414)
 * field-for-field in SHAPE and semantics — delivery intent only, never a
 * Relay queue, never a retry/scheduling field, never ciphertext/plaintext
 * duplication (the ciphertext already lives in `FedosConversationPayloadStorage`,
 * referenced by the Envelope's own `payloadId` — this Outbox carries only
 * an `envelopeId` reference). NOT a re-export of the Board Outbox types:
 * `FedosBoardOutboxIntent.postId` is a `FedosBoardPostId`, a structurally
 * different domain, and Board's own file is intentionally left unmodified
 * (Arc instruction: reuse the ARCHITECTURE, never redesign the existing
 * Board-bound type).
 *
 * ONE intent per `envelopeId` — unlike the Board Outbox (one intent per
 * `(postId, target)` pair), Multi-Relay fan-out is NOT modeled as
 * multiple Outbox rows here: it is entirely the injected Publisher's own
 * concern (`fedos_conversation_transport_publisher.ts`) which relays it
 * fans out to for a single intent. `makeFedosConversationTransportOutboxId`
 * is therefore simply the envelope id itself, branded — still
 * deterministic, still idempotent (submitting the same envelope twice
 * yields the same id), for the identical reason Alpha 413 chose
 * determinism for the Board Outbox.
 *
 * HARD GUARDRAILS (mirrors Alpha 413/414 exactly):
 *   - No access token, private key, Relay socket, or free-form metadata
 *     bag anywhere in this file.
 *   - `createFedosConversationTransportOutboxIntent` is the ONLY
 *     constructor — fails closed (`null`) for anything malformed. Its
 *     result is `Object.freeze`d.
 *   - No mutation method, no setter, no scheduling field of any kind.
 */

import type { FedosConversationEnvelopeId } from "../../../conversations/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationId } from "../../../conversations/fedos_conversation_id.js";

export type FedosConversationTransportOutboxId = string & { readonly __brand: "FedosConversationTransportOutboxId" };

/** Deterministic — the envelope id itself, branded. Two calls for the same envelope always produce the identical id. */
export function makeFedosConversationTransportOutboxId(
  envelopeId: FedosConversationEnvelopeId,
): FedosConversationTransportOutboxId {
  return envelopeId as unknown as FedosConversationTransportOutboxId;
}

export interface FedosConversationTransportOutboxIntent {
  readonly id: FedosConversationTransportOutboxId;
  readonly envelopeId: FedosConversationEnvelopeId;
  readonly conversationId: FedosConversationId;
  readonly createdAt: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidCreatedAt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/**
 * The ONLY constructor of a `FedosConversationTransportOutboxIntent`.
 * Fails closed to `null` for a malformed `envelopeId`/`conversationId`/
 * `createdAt` — never throws.
 */
export function createFedosConversationTransportOutboxIntent(
  envelopeId: FedosConversationEnvelopeId,
  conversationId: FedosConversationId,
  createdAt: number,
): FedosConversationTransportOutboxIntent | null {
  if (!isNonEmptyString(envelopeId as unknown as string)) return null;
  if (!isNonEmptyString(conversationId as unknown as string)) return null;
  if (!isValidCreatedAt(createdAt)) return null;

  return Object.freeze({
    id: makeFedosConversationTransportOutboxId(envelopeId),
    envelopeId,
    conversationId,
    createdAt,
  });
}
