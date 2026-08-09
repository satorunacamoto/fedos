/**
 * Secure Runtime Alpha 7081-7160 — the protocol-neutral control payload
 * carried through the EXISTING authenticated private-message
 * architecture, mirroring `fedos_ratchet_peer_capability_control_payload.ts`'s
 * own established seam exactly:
 * `FedosPrivateTransport.sendMailboxNip17Control(controlId, conversationId,
 * plaintext, createdAt)` is already generic over any control plaintext
 * plus a caller-chosen `controlId`. This file's own closed, single-
 * discriminator envelope (`kind: "conversation-invitation"`) is the
 * plaintext this Arc puts on that wire — a NEW, SEPARATE codec, never
 * folded into the Ratchet's own frozen NIP-17 payload codec or Peer
 * Capability's own control payload union (a distinct `kind` value in a
 * SIBLING file, not a fourth arm on that existing union, since this
 * record kind belongs to a different domain entirely).
 *
 * This payload is NEVER imported as a Conversation chat message — it is
 * dispatched at `FedosConversationRuntime.receiveNip17Rumor()` (the ONE
 * inbound entry point), tried as its own distinct attempt before the
 * legacy chat-message fallback ever sees the Rumor.
 */
import {
  isWellFormedFedosConversationInvitationAdvertisementV1,
  type FedosConversationInvitationAdvertisementV1,
} from "../../../../conversation/invitation_bootstrap/fedos_conversation_invitation_advertisement.js";

export const FEDOS_CONVERSATION_INVITATION_CONTROL_PAYLOAD_SCHEMA_VERSION = 1 as const;

/** A concrete size bound on the encoded control plaintext, enforced by the decoder before any `JSON.parse`. */
export const FEDOS_CONVERSATION_INVITATION_CONTROL_PAYLOAD_MAX_BYTES = 65536;

export interface FedosConversationInvitationControlPayloadV1 {
  readonly schemaVersion: 1;
  readonly kind: "conversation-invitation";
  readonly invitation: FedosConversationInvitationAdvertisementV1;
}

const PAYLOAD_FIELDS = new Set(["schemaVersion", "kind", "invitation"]);

/** Total, never-throwing structural classifier — exact field set, unknown `kind` or unknown/extra field fails closed to `false`. */
export function isWellFormedFedosConversationInvitationControlPayload(
  candidate: unknown,
): candidate is FedosConversationInvitationControlPayloadV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== FEDOS_CONVERSATION_INVITATION_CONTROL_PAYLOAD_SCHEMA_VERSION) return false;
  if (r.kind !== "conversation-invitation") return false;
  const keys = Object.keys(r);
  if (keys.length !== PAYLOAD_FIELDS.size || !keys.every((k) => PAYLOAD_FIELDS.has(k))) return false;
  return isWellFormedFedosConversationInvitationAdvertisementV1(r.invitation);
}

/** Encodes to the `Uint8Array` shape `FedosPrivateTransport.sendMailboxNip17Control()`'s own `plaintext` parameter requires. */
export function encodeFedosConversationInvitationControlPayload(payload: FedosConversationInvitationControlPayloadV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

/**
 * Total, never-throwing decode from an already-unwrapped Rumor's own
 * `content: string`. `null` on oversize input, invalid JSON, or any
 * structural mismatch — fail closed. This is the FIRST gate a candidate
 * control payload must pass before any signature/identity check is
 * attempted.
 */
export function decodeFedosConversationInvitationControlPayloadFromContent(content: string): FedosConversationInvitationControlPayloadV1 | null {
  if (typeof content !== "string" || content.length === 0 || content.length > FEDOS_CONVERSATION_INVITATION_CONTROL_PAYLOAD_MAX_BYTES) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  return isWellFormedFedosConversationInvitationControlPayload(parsed) ? parsed : null;
}
