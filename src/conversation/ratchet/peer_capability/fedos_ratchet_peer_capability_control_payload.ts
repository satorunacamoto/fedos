/**
 * Secure Runtime Alpha 5721–5800 (FedOS Ratchet Peer Notification and
 * Capability Advertisement Arc) — Phase F: the protocol-neutral internal
 * control payload carried through the EXISTING authenticated private-
 * message architecture.
 *
 * Phase A found the correct, real integration seam:
 * `FedosPrivateTransport.sendMailboxNip17Control(controlId, conversationId,
 * plaintext, createdAt)` (`../../transport/fedos_private_transport.ts`) is
 * already generic over any control plaintext plus a caller-chosen
 * `controlId`, requires the plain `"nostr-nip17-v1"` Gift Wrap route (real
 * NIP-17/NIP-59 encryption for one recipient, unchanged), and already
 * enforces non-empty input. This file's own closed, explicit-discriminator
 * envelope (`kind: "peer-capability-advertisement" | "peer-lifecycle-notification"`)
 * is the plaintext this Arc puts on that wire — a NEW, SEPARATE codec from
 * the Ratchet's own frozen `fedos_direct_ratchet_nip17_payload.ts`, never a
 * third `kind` added there (that would conflate an unrelated wire format
 * with the Ratchet message codec — see the Phase A reconciliation report).
 *
 * This payload is NEVER imported as a Conversation chat message and is
 * NEVER mixed with ordinary user-visible message plaintext — it is
 * dispatched at the `FedosConversationRuntime.receiveNip17Rumor()` call
 * site (the ONE inbound entry point Phase A identified), tried as its own
 * distinct attempt before the legacy chat-message fallback ever sees the
 * Rumor.
 */
import {
  isWellFormedFedosRatchetPeerCapabilityAdvertisementV1,
  type FedosRatchetPeerCapabilityAdvertisementV1,
} from "./fedos_ratchet_peer_capability_advertisement.js";
import {
  isWellFormedFedosRatchetPeerLifecycleNotificationV1,
  type FedosRatchetPeerLifecycleNotificationV1,
} from "./fedos_ratchet_peer_lifecycle_notification.js";

export const FEDOS_RATCHET_PEER_CAPABILITY_CONTROL_PAYLOAD_SCHEMA_VERSION = 1 as const;

/** A concrete size bound on the encoded control plaintext, enforced by the decoder before any JSON.parse (Phase F's own "size bounds" requirement). */
export const FEDOS_RATCHET_PEER_CAPABILITY_CONTROL_PAYLOAD_MAX_BYTES = 65536;

export type FedosRatchetPeerCapabilityControlPayloadV1 =
  | { readonly schemaVersion: 1; readonly kind: "peer-capability-advertisement"; readonly advertisement: FedosRatchetPeerCapabilityAdvertisementV1 }
  | { readonly schemaVersion: 1; readonly kind: "peer-lifecycle-notification"; readonly notification: FedosRatchetPeerLifecycleNotificationV1 };

const ADVERTISEMENT_FIELDS = new Set(["schemaVersion", "kind", "advertisement"]);
const NOTIFICATION_FIELDS = new Set(["schemaVersion", "kind", "notification"]);

/** Total, never-throwing structural classifier — exact field set per `kind`, unknown `kind` or unknown/extra field fails closed to `null`. */
export function isWellFormedFedosRatchetPeerCapabilityControlPayload(
  candidate: unknown,
): candidate is FedosRatchetPeerCapabilityControlPayloadV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== FEDOS_RATCHET_PEER_CAPABILITY_CONTROL_PAYLOAD_SCHEMA_VERSION) return false;
  if (r.kind === "peer-capability-advertisement") {
    const keys = Object.keys(r);
    if (keys.length !== ADVERTISEMENT_FIELDS.size || !keys.every((k) => ADVERTISEMENT_FIELDS.has(k))) return false;
    return isWellFormedFedosRatchetPeerCapabilityAdvertisementV1(r.advertisement);
  }
  if (r.kind === "peer-lifecycle-notification") {
    const keys = Object.keys(r);
    if (keys.length !== NOTIFICATION_FIELDS.size || !keys.every((k) => NOTIFICATION_FIELDS.has(k))) return false;
    return isWellFormedFedosRatchetPeerLifecycleNotificationV1(r.notification);
  }
  return false;
}

/** Encodes to the `Uint8Array` shape `FedosPrivateTransport.sendMailboxNip17Control()`'s own `plaintext` parameter requires. */
export function encodeFedosRatchetPeerCapabilityControlPayload(payload: FedosRatchetPeerCapabilityControlPayloadV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

/**
 * Total, never-throwing decode from an already-unwrapped Rumor's own
 * `content: string` (mirrors `decodeFedosDirectRatchetNip17PayloadFromContent()`'s
 * exact signature/convention — Rumor content is plain-text JSON, never
 * raw bytes, by the time it reaches this layer). `null` on oversize
 * input, invalid JSON, or any structural mismatch — fail closed. This is
 * the FIRST gate a candidate control payload must pass before any
 * signature/identity check is attempted.
 */
export function decodeFedosRatchetPeerCapabilityControlPayloadFromContent(content: string): FedosRatchetPeerCapabilityControlPayloadV1 | null {
  if (typeof content !== "string" || content.length === 0 || content.length > FEDOS_RATCHET_PEER_CAPABILITY_CONTROL_PAYLOAD_MAX_BYTES) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  return isWellFormedFedosRatchetPeerCapabilityControlPayload(parsed) ? parsed : null;
}
