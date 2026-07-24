/**
 * Secure Runtime Alpha 7401–7480 (FedOS Direct Conversation Route Binding
 * and NIP-17 Inbound Isolation Arc) — the closed, versioned route-binding
 * envelope for the PLAIN `nostr-nip17-v1` Direct-message route.
 *
 * Mirrors `./fedos_direct_ratchet_nip17_payload.ts`'s own established
 * discipline exactly (Alpha 5561–5640, UNMODIFIED file, reused as the
 * precedent this codec extends to the plain route): NIP-17's own Rumor
 * `.content` MUST be plain text — this file's `encode()` produces exactly
 * that (a JSON string, itself valid UTF-8 plain text), and `decode()` is
 * a strict, total, never-throwing reader. NOT a new NIP, NOT a new public
 * event kind, NOT a claim that a standard NIP-17 client can make sense of
 * this inner shape (it still sees valid `kind:14` plain-text content).
 *
 * Before this Arc, this route's own `Rumor.content` was the user's RAW
 * plaintext with zero structure — every inbound Rumor on this route is
 * therefore either (a) this NEW, closed envelope, or (b) genuinely
 * pre-existing raw plaintext with no route-binding, handled as
 * `"legacy"` by the caller (`fedos_nip17_inbound_import_coordinator.ts`),
 * per this Arc's own Legacy and Migration Policy — this codec's own
 * `decode()` returning `null` is precisely that fallthrough signal,
 * exactly mirroring `decodeFedosDirectRatchetNip17PayloadFromContent()`'s
 * own "decode failure falls through to the legacy path" convention.
 */
import type { FedosDeviceBindingAccountRef } from "../../../../device/fedos_device_binding.js";

const SCHEMA_VERSION = 1;
const MAX_ID_FIELD_LENGTH = 512;
/** Bounded — mirrors this codebase's own established message-body bound (`MAX_MESSAGE_BODY_CHARS`-class limits elsewhere); generous for real chat text, never unbounded. */
const MAX_BODY_LENGTH = 8192;

function isSafeIdField(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_FIELD_LENGTH;
}

function hasExactFields(value: unknown, fields: ReadonlySet<string>): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

const ACCOUNT_REF_FIELDS = new Set<string>(["authority", "publicIdentifier", "identityId"]);

function isWellFormedAccountRef(candidate: unknown): candidate is FedosDeviceBindingAccountRef {
  if (!hasExactFields(candidate, ACCOUNT_REF_FIELDS)) return false;
  const r = candidate as Record<string, unknown>;
  return isSafeIdField(r.authority) && isSafeIdField(r.publicIdentifier) && (r.identityId === null || isSafeIdField(r.identityId));
}

/**
 * The closed route-binding envelope for a plain Direct message. `body` is
 * the ACTUAL user-authored message text (this route's own established
 * "content is the message" semantics, unchanged) — `conversationId`/
 * `senderAccountRef`/`recipientAccountRef` are the new, authenticated
 * (transitively, via the real Seal signature this content is only ever
 * obtained by decrypting) route binding this Arc adds.
 */
export interface FedosDirectConversationPlainMessagePayloadV1 {
  readonly schemaVersion: 1;
  readonly conversationId: string;
  readonly senderAccountRef: FedosDeviceBindingAccountRef;
  readonly recipientAccountRef: FedosDeviceBindingAccountRef;
  readonly body: string;
}

const PAYLOAD_FIELDS = new Set<string>(["schemaVersion", "conversationId", "senderAccountRef", "recipientAccountRef", "body"]);

function isWellFormed(candidate: unknown): candidate is FedosDirectConversationPlainMessagePayloadV1 {
  if (!hasExactFields(candidate, PAYLOAD_FIELDS)) return false;
  const p = candidate as Record<string, unknown>;
  if (p.schemaVersion !== SCHEMA_VERSION) return false;
  if (!isSafeIdField(p.conversationId)) return false;
  if (!isWellFormedAccountRef(p.senderAccountRef)) return false;
  if (!isWellFormedAccountRef(p.recipientAccountRef)) return false;
  if (typeof p.body !== "string" || p.body.length > MAX_BODY_LENGTH) return false;
  return true;
}

/** Plain `JSON.stringify` — mirrors `encodeFedosDirectRatchetNip17PayloadToPlaintext()`'s own identical discipline. */
export function encodeFedosDirectConversationPlainMessagePayload(payload: FedosDirectConversationPlainMessagePayloadV1): string {
  return JSON.stringify(payload);
}

/**
 * Total, never throws. A THREE-WAY closed result (Secure Runtime Alpha
 * 7401-7480's own Phase H outcome vocabulary needs `"absent"` and
 * `"malformed"` to be distinguishable, unlike the Ratchet payload
 * codec's own simpler nullable `decode()`): content that is not even
 * valid JSON is genuinely pre-existing, unbound legacy plaintext
 * (`"absent"` — the caller falls through to the Legacy Policy); content
 * that IS valid JSON but does not exactly match this closed shape is a
 * malformed binding attempt (`"malformed"` — the caller fails closed,
 * never falls through to legacy for this case, since something WAS
 * clearly attempted and produced/tampered content that does not parse).
 */
export type FedosDirectConversationPlainMessagePayloadDecodeResult =
  | { readonly outcome: "ok"; readonly payload: FedosDirectConversationPlainMessagePayloadV1 }
  | { readonly outcome: "absent" }
  | { readonly outcome: "malformed" };

export function decodeFedosDirectConversationPlainMessagePayload(content: string): FedosDirectConversationPlainMessagePayloadDecodeResult {
  if (typeof content !== "string" || content.length === 0) return { outcome: "absent" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { outcome: "absent" };
  }
  if (typeof parsed !== "object" || parsed === null) return { outcome: "absent" };
  return isWellFormed(parsed) ? { outcome: "ok", payload: parsed } : { outcome: "malformed" };
}
