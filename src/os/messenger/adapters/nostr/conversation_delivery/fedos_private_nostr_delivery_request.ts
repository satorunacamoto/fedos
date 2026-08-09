/**
 * Secure Runtime Alpha 1399/1404 ("Private Delivery Request" / "Nostr
 * Private Outbox Intent") — Phase B of the Alpha 1391–1470 Nostr Private
 * Direct and Pairwise Fanout Delivery Arc.
 *
 * The durable transport INTENT — deliberately a NEW, parallel record
 * rather than a forced fit into `FedosBoardOutboxIntent`
 * (`../../../board/outbox/fedos_board_outbox_types.ts`), which is
 * structurally keyed by `FedosBoardPostId`/`FedosBoardOutboundProtocol`
 * and has no field for an Envelope/recipient pair. This follows the SAME
 * "adapt the ESTABLISHED PATTERN, not the literal class" precedent the
 * Alpha 1321–1390 Group Arc already set when it built its own Fanout
 * Delivery persistence rather than forcing itself into Board Outbox.
 * Delivery STATE (queued/publishing/accepted/rejected/failed) is
 * deliberately NOT tracked here — this record is the IMMUTABLE intent
 * only; state reuses the EXISTING `FedosDeliveryObservationRepository`
 * (`../../../board/observation/`, Alpha 710+), keyed by this record's own
 * deterministic id as an opaque `subjectId` (Alpha 1408/1409/1413/1414
 * satisfied via direct reuse, not a second state vocabulary).
 *
 * Carries NO plaintext, NO raw key (Alpha 1404's own explicit
 * prohibition) — only references into already-durable Envelope/Payload
 * storage plus non-secret transport metadata.
 */

import { FEDOS_PRIVATE_NOSTR_DELIVERY_MODES, type FedosPrivateNostrDeliveryMode } from "./fedos_private_nostr_delivery_mode.js";

const MAX_ID_FIELD_LENGTH = 512;

export interface FedosPrivateNostrDeliveryRequest {
  readonly id: string;
  readonly conversationId: string;
  readonly envelopeId: string;
  readonly recipientMembershipId: string;
  readonly recipientPublicKeyHex: string;
  readonly relayUrls: readonly string[];
  readonly mode: FedosPrivateNostrDeliveryMode;
  /** Non-authoritative retention INTENT only (Alpha 1396) — never proof of deletion, never copied into local canonical retention state. */
  readonly expiresAt: number | null;
  readonly createdAt: number;
}

/** Deterministic — mirrors `toFedosGroupDirectPathId()`'s own `::`-joined idempotency-key discipline (Alpha 1331). No cross-recipient overwrite (Alpha 1412). */
export function toFedosPrivateNostrDeliveryRequestId(
  conversationId: string,
  envelopeId: string,
  recipientMembershipId: string,
): string {
  return `private-nostr-delivery::${conversationId}::${envelopeId}::${recipientMembershipId}`;
}

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

function isSafeIdField(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_FIELD_LENGTH;
}

/** Fails closed to `null` on any invalid field — never throws. */
export function createFedosPrivateNostrDeliveryRequest(input: {
  readonly conversationId: string;
  readonly envelopeId: string;
  readonly recipientMembershipId: string;
  readonly recipientPublicKeyHex: string;
  readonly relayUrls: readonly string[];
  readonly mode: FedosPrivateNostrDeliveryMode;
  readonly expiresAt: number | null;
  readonly createdAt: number;
}): FedosPrivateNostrDeliveryRequest | null {
  if (!isSafeIdField(input.conversationId)) return null;
  if (!isSafeIdField(input.envelopeId)) return null;
  if (!isSafeIdField(input.recipientMembershipId)) return null;
  if (!NOSTR_PUBLIC_KEY_HEX_PATTERN.test(input.recipientPublicKeyHex)) return null;
  if (!Array.isArray(input.relayUrls) || input.relayUrls.length === 0) return null;
  for (const url of input.relayUrls) {
    if (typeof url !== "string" || url.length === 0) return null;
  }
  if (!FEDOS_PRIVATE_NOSTR_DELIVERY_MODES.includes(input.mode)) return null;
  if (input.expiresAt !== null && (!Number.isInteger(input.expiresAt) || input.expiresAt < 0)) return null;
  if (!Number.isInteger(input.createdAt) || input.createdAt < 0) return null;

  return Object.freeze({
    id: toFedosPrivateNostrDeliveryRequestId(input.conversationId, input.envelopeId, input.recipientMembershipId),
    conversationId: input.conversationId,
    envelopeId: input.envelopeId,
    recipientMembershipId: input.recipientMembershipId,
    recipientPublicKeyHex: input.recipientPublicKeyHex,
    relayUrls: Object.freeze([...input.relayUrls]),
    mode: input.mode,
    expiresAt: input.expiresAt,
    createdAt: input.createdAt,
  });
}

export type FedosPrivateNostrDeliveryRequestPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosPrivateNostrDeliveryRequestPersistence {
  putRequest(record: FedosPrivateNostrDeliveryRequest): FedosPrivateNostrDeliveryRequestPersistenceWriteResult;
  getRequest(id: string): FedosPrivateNostrDeliveryRequest | null;
  listRequestsForEnvelope(conversationId: string, envelopeId: string): readonly FedosPrivateNostrDeliveryRequest[];
}

export function fedosPrivateNostrDeliveryRequestsAreEqual(
  a: FedosPrivateNostrDeliveryRequest,
  b: FedosPrivateNostrDeliveryRequest,
): boolean {
  return (
    a.id === b.id &&
    a.conversationId === b.conversationId &&
    a.envelopeId === b.envelopeId &&
    a.recipientMembershipId === b.recipientMembershipId &&
    a.recipientPublicKeyHex === b.recipientPublicKeyHex &&
    a.relayUrls.length === b.relayUrls.length &&
    a.relayUrls.every((url, i) => url === b.relayUrls[i]) &&
    a.mode === b.mode &&
    a.expiresAt === b.expiresAt &&
    a.createdAt === b.createdAt
  );
}
