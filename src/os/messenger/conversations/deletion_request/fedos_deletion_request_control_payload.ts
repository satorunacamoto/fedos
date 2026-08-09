/**
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion Request
 * Private Transport and Local Policy Integration Arc) — Phase B: the
 * protocol-neutral internal control payload carried through the EXISTING
 * authenticated private-message architecture.
 *
 * Phase A reconciliation found the correct, real integration seam:
 * `FedosPrivateTransport.sendMailboxNip17Control(controlId, conversationId,
 * plaintext, createdAt)` (`../transport/fedos_private_transport.ts`) — the
 * SAME seam `d825aa0`'s own `fedos_ratchet_peer_capability_control_payload.ts`
 * already established a precedent for. This file reuses that precedent
 * exactly: a closed, explicit-discriminator envelope
 * (`kind: "deletion-request-v1" | "deletion-acknowledgement-v1"`) is the
 * plaintext put on that wire — a NEW, SEPARATE codec, never a third `kind`
 * added to the Ratchet's own frozen payload codec or the Peer Capability
 * domain's own codec.
 *
 * The envelope's own inner content is NEVER a fresh, redundant schema —
 * it is the ALREADY-REAL, ALREADY-SIGNED `FedosSignedDeletionRequestV1` /
 * `FedosSignedDeletionAcknowledgementV1` (`5641-5720`'s own real account
 * signing/verification boundary, unmodified). This file only wraps that
 * existing signed artifact for wire transit; it invents no new signature
 * format and performs no cryptographic verification itself (that remains
 * `verifyFedosSignedDeletionRequestV1`/`verifyFedosSignedDeletionAcknowledgementV1`'s
 * own job, run by the Inbound Coordinators AFTER this file's own
 * structural decode succeeds).
 *
 * This payload is NEVER imported as a Conversation chat message and is
 * NEVER mixed with ordinary user-visible message plaintext — dispatched
 * at the `FedosConversationRuntime.receiveNip17Rumor()` call site, tried
 * as its own distinct attempt (after the Ratchet's and Peer Capability's
 * own attempts, before the legacy chat-message fallback ever sees the
 * Rumor).
 */
import { isWellFormedFedosDeletionRequestRecordV1 } from "../../../../conversation/deletion_request/fedos_deletion_request_record.js";
import { isWellFormedFedosDeletionAcknowledgementRecordV1 } from "../../../../conversation/deletion_request/fedos_deletion_acknowledgement_record.js";
import type { FedosNostrWireEvent } from "../../../../desktop/fedos_nostr_wire_event.js";
import type { FedosSignedDeletionRequestV1 } from "../../../../conversation/deletion_request/fedos_deletion_request_signing.js";
import type { FedosSignedDeletionAcknowledgementV1 } from "../../../../conversation/deletion_request/fedos_deletion_acknowledgement_signing.js";

export const FEDOS_DELETION_REQUEST_CONTROL_PAYLOAD_SCHEMA_VERSION = 1 as const;

/** A concrete size bound on the encoded control plaintext, enforced by the decoder before any `JSON.parse` — mirrors `FEDOS_RATCHET_PEER_CAPABILITY_CONTROL_PAYLOAD_MAX_BYTES`'s own bound exactly. */
export const FEDOS_DELETION_REQUEST_CONTROL_PAYLOAD_MAX_BYTES = 65536;

export type FedosDeletionRequestControlPayloadV1 =
  | { readonly schemaVersion: 1; readonly kind: "deletion-request-v1"; readonly request: FedosSignedDeletionRequestV1 }
  | { readonly schemaVersion: 1; readonly kind: "deletion-acknowledgement-v1"; readonly acknowledgement: FedosSignedDeletionAcknowledgementV1 };

const REQUEST_ENVELOPE_FIELDS = new Set(["schemaVersion", "kind", "request"]);
const ACK_ENVELOPE_FIELDS = new Set(["schemaVersion", "kind", "acknowledgement"]);
const SIGNED_FIELDS = new Set(["record", "wireEvent"]);

/** Structural-only shape check (never cryptographic) — mirrors `FedosNostrWireEvent`'s own seven-field NIP-01 shape exactly, no renaming. */
function isWellFormedFedosNostrWireEventShape(candidate: unknown): candidate is FedosNostrWireEvent {
  if (typeof candidate !== "object" || candidate === null) return false;
  const e = candidate as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.pubkey === "string" &&
    typeof e.created_at === "number" &&
    typeof e.kind === "number" &&
    Array.isArray(e.tags) &&
    e.tags.every((tag) => Array.isArray(tag) && tag.every((t) => typeof t === "string")) &&
    typeof e.content === "string" &&
    typeof e.sig === "string"
  );
}

function isWellFormedSignedRequestShape(candidate: unknown): candidate is FedosSignedDeletionRequestV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.length !== SIGNED_FIELDS.size || !keys.every((k) => SIGNED_FIELDS.has(k))) return false;
  return isWellFormedFedosDeletionRequestRecordV1(r.record) && isWellFormedFedosNostrWireEventShape(r.wireEvent);
}

function isWellFormedSignedAcknowledgementShape(candidate: unknown): candidate is FedosSignedDeletionAcknowledgementV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.length !== SIGNED_FIELDS.size || !keys.every((k) => SIGNED_FIELDS.has(k))) return false;
  return isWellFormedFedosDeletionAcknowledgementRecordV1(r.record) && isWellFormedFedosNostrWireEventShape(r.wireEvent);
}

/** Total, never-throwing structural classifier — exact field set per `kind`, unknown `kind` or unknown/extra field fails closed to `false`. */
export function isWellFormedFedosDeletionRequestControlPayload(candidate: unknown): candidate is FedosDeletionRequestControlPayloadV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== FEDOS_DELETION_REQUEST_CONTROL_PAYLOAD_SCHEMA_VERSION) return false;
  if (r.kind === "deletion-request-v1") {
    const keys = Object.keys(r);
    if (keys.length !== REQUEST_ENVELOPE_FIELDS.size || !keys.every((k) => REQUEST_ENVELOPE_FIELDS.has(k))) return false;
    return isWellFormedSignedRequestShape(r.request);
  }
  if (r.kind === "deletion-acknowledgement-v1") {
    const keys = Object.keys(r);
    if (keys.length !== ACK_ENVELOPE_FIELDS.size || !keys.every((k) => ACK_ENVELOPE_FIELDS.has(k))) return false;
    return isWellFormedSignedAcknowledgementShape(r.acknowledgement);
  }
  return false;
}

/** Encodes to the `Uint8Array` shape `FedosPrivateTransport.sendMailboxNip17Control()`'s own `plaintext` parameter requires. */
export function encodeFedosDeletionRequestControlPayload(payload: FedosDeletionRequestControlPayloadV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

/**
 * Total, never-throwing decode from an already-unwrapped Rumor's own
 * `content: string` — mirrors
 * `decodeFedosRatchetPeerCapabilityControlPayloadFromContent()`'s exact
 * signature/convention. `null` on oversize input, invalid JSON, or any
 * structural mismatch — fail closed, BEFORE any signature/identity check
 * is ever attempted.
 */
export function decodeFedosDeletionRequestControlPayloadFromContent(content: string): FedosDeletionRequestControlPayloadV1 | null {
  if (typeof content !== "string" || content.length === 0 || content.length > FEDOS_DELETION_REQUEST_CONTROL_PAYLOAD_MAX_BYTES) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  return isWellFormedFedosDeletionRequestControlPayload(parsed) ? parsed : null;
}
