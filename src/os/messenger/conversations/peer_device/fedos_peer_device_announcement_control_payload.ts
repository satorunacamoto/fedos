/**
 * FedOS Peer Device Discovery Arc — the protocol-neutral internal control
 * payload carried through the EXISTING authenticated private-message
 * architecture. Mirrors
 * `../ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.ts`'s
 * own shape exactly, as its OWN separate envelope kind (never a fourth
 * variant merged into that file — a deliberately separate codec, per that
 * file's own established "a new `kind`, never a new Nostr kind" extension
 * pattern, but kept in this domain's own file since this is a genuinely
 * new, standalone Arc, not an extension of the Peer Capability Arc).
 *
 * Dispatched at the `FedosConversationRuntime.receiveNip17Rumor()` call
 * site, tried as its own distinct attempt (fifth, after Identity
 * Transition) before the legacy chat-message fallback ever sees the Rumor.
 */
import { isWellFormedFedosPeerDeviceAnnouncementV1, type FedosPeerDeviceAnnouncementV1 } from "./fedos_peer_device_announcement.js";

export const FEDOS_PEER_DEVICE_ANNOUNCEMENT_CONTROL_PAYLOAD_SCHEMA_VERSION = 1 as const;

/** A concrete size bound on the encoded control plaintext, enforced by the decoder before any JSON.parse. */
export const FEDOS_PEER_DEVICE_ANNOUNCEMENT_CONTROL_PAYLOAD_MAX_BYTES = 65536;

export type FedosPeerDeviceAnnouncementControlPayloadV1 = {
  readonly schemaVersion: 1;
  readonly kind: "peer-device-announcement";
  readonly announcement: FedosPeerDeviceAnnouncementV1;
};

const ANNOUNCEMENT_FIELDS = new Set(["schemaVersion", "kind", "announcement"]);

/** Total, never-throwing structural classifier. Fails closed. */
export function isWellFormedFedosPeerDeviceAnnouncementControlPayload(candidate: unknown): candidate is FedosPeerDeviceAnnouncementControlPayloadV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== FEDOS_PEER_DEVICE_ANNOUNCEMENT_CONTROL_PAYLOAD_SCHEMA_VERSION) return false;
  if (r.kind !== "peer-device-announcement") return false;
  const keys = Object.keys(r);
  if (keys.length !== ANNOUNCEMENT_FIELDS.size || !keys.every((k) => ANNOUNCEMENT_FIELDS.has(k))) return false;
  return isWellFormedFedosPeerDeviceAnnouncementV1(r.announcement);
}

/** Encodes to the `Uint8Array` shape `FedosPrivateTransport.sendMailboxNip17Control()`'s own `plaintext` parameter requires. */
export function encodeFedosPeerDeviceAnnouncementControlPayload(payload: FedosPeerDeviceAnnouncementControlPayloadV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

/** Total, never-throwing decode from an already-unwrapped Rumor's own `content: string`. `null` on oversize input, invalid JSON, or any structural mismatch — fail closed. */
export function decodeFedosPeerDeviceAnnouncementControlPayloadFromContent(content: string): FedosPeerDeviceAnnouncementControlPayloadV1 | null {
  if (typeof content !== "string" || content.length === 0 || content.length > FEDOS_PEER_DEVICE_ANNOUNCEMENT_CONTROL_PAYLOAD_MAX_BYTES) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  return isWellFormedFedosPeerDeviceAnnouncementControlPayload(parsed) ? parsed : null;
}
