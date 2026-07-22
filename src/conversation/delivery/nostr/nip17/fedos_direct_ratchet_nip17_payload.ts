/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — Phase D/F: the strict, closed
 * inner payload this Arc carries through NIP-17/NIP-59's own UNMODIFIED
 * Rumor -> Seal -> Gift Wrap outer framing (`../nip17/fedos_nip17_rumor.ts`/
 * `fedos_nip59_seal.ts`/`fedos_nip59_gift_wrap.ts`, all UNCHANGED by this
 * Arc). NIP-17's own Rumor `.content` MUST be plain text (that adapter's
 * own header) — this file's `encode*()` functions produce exactly that
 * (a JSON string, itself valid UTF-8 plain text), and `decode*()`/
 * `isWellFormed*()` are the strict, total, never-throwing readers the
 * inbound side uses to tell "this is one of OUR ratchet payloads" apart
 * from an ordinary human chat message BEFORE ever touching ratchet
 * session state (Phase G step 4 — "classify the inner route/payload").
 *
 * FedOS ratchet payload carried through NIP-17/NIP-59 framing — NOT a
 * new NIP, NOT a new public event kind, and NOT a claim that a standard
 * NIP-17 client can understand this inner shape (a compliant client
 * still sees valid `kind:14` plain-text content; it simply cannot make
 * sense of it as a ratchet message, exactly like any other
 * application-specific inner payload convention).
 *
 * TWO closed payload kinds, a discriminated union — NEVER conflated:
 *   - `"session-init"` (Phase D): ONLY public initialization facts. Every
 *     field is either already-public Device/account/Conversation/suite/
 *     generation binding metadata, or the freshly-generated LOCAL ratchet
 *     PUBLIC key (`ratchetPublicKeyHex`) — never a private key, never a
 *     root/chain/message key, never a Master Seed, never a sealing key,
 *     never a raw `SecretHandle`. Structurally impossible for this type
 *     to carry a secret: it has no field capable of holding one.
 *   - `"message"` (Phase F): the ratchet WIRE MESSAGE (header + ciphertext,
 *     already an OPAQUE, encrypted blob produced by
 *     `FedosDirectRatchetCryptographicSession.encrypt()`,
 *     `../../../ratchet/fedos_direct_ratchet_cryptographic_session.js`) —
 *     base64-encoded verbatim, never decomposed, never re-derived here.
 *
 * A ratchet payload is NEVER mislabeled as a static/legacy NIP-17 chat
 * message: `isWellFormedFedosDirectRatchetNip17Payload()` requires an
 * EXACT closed field set at every level (mirrors
 * `fedos_direct_ratchet_session_record.ts`'s own `hasExactFields()`
 * discipline) — ordinary human chat text essentially never parses as
 * valid JSON matching this exact shape, and the inbound coordinator
 * (Phase G) always tries this decode FIRST, falling through to the
 * legacy plain-chat path only on a decode failure — never the reverse.
 */
import type { FedosDeviceBindingAccountRef } from "../../../../device/fedos_device_binding.js";
import type { FedosDirectRatchetSuite } from "../../../ratchet/fedos_direct_ratchet_session_id.js";

// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";

const SCHEMA_VERSION = 1;
const MAX_ID_FIELD_LENGTH = 512;
/** Bounded — a real ratchet wire message (secp256k1 header + short chat ciphertext) is always well under this; never unbounded. */
const MAX_WIRE_MESSAGE_BASE64_LENGTH = 65536;
const NOSTR_HEX_PUBLIC_KEY_PATTERN = /^[0-9a-f]{64}$/;

function isSafeIdField(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_FIELD_LENGTH;
}

function isValidBase64(value: unknown, maxLength: number): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0;
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
  return (
    isSafeIdField(r.authority) &&
    isSafeIdField(r.publicIdentifier) &&
    (r.identityId === null || isSafeIdField(r.identityId))
  );
}

/**
 * Phase D — public initialization facts ONLY. See this file's own header
 * for the hard guarantee that no field here can ever carry secret
 * material.
 */
export interface FedosDirectRatchetSessionInitPayloadV1 {
  readonly schemaVersion: 1;
  readonly kind: "session-init";
  readonly suite: FedosDirectRatchetSuite;
  readonly generation: number;
  /** The SENDER's own account/Device — from the RECEIVER's perspective, this is "remote". */
  readonly senderAccountRef: FedosDeviceBindingAccountRef;
  readonly senderDeviceRef: string;
  /** The RECEIVER's own account/Device, as the sender resolved them — validated against the receiver's own local config before trust (Phase D — "Device bound", "recipient bound"). */
  readonly recipientAccountRef: FedosDeviceBindingAccountRef;
  readonly recipientDeviceRef: string;
  readonly conversationId: string;
  /** The sender's freshly-generated ratchet DH PUBLIC key — public by definition, never a private key. */
  readonly ratchetPublicKeyHex: string;
}

/** Phase F — the ratchet wire message (header + ciphertext), opaque and already-encrypted. */
export interface FedosDirectRatchetMessagePayloadV1 {
  readonly schemaVersion: 1;
  readonly kind: "message";
  readonly suite: FedosDirectRatchetSuite;
  readonly generation: number;
  readonly sessionId: string;
  /** The ratchet send-chain message number this wire message consumed — safe, public metadata (review §10 §2), used ONLY for safe/import observability at this layer; replay rejection is the Rust ratchet core's own job (`decrypt()`). */
  readonly messageNumber: number;
  readonly wireMessageBase64: string;
}

export type FedosDirectRatchetNip17PayloadV1 = FedosDirectRatchetSessionInitPayloadV1 | FedosDirectRatchetMessagePayloadV1;

const SESSION_INIT_FIELDS = new Set<string>([
  "schemaVersion",
  "kind",
  "suite",
  "generation",
  "senderAccountRef",
  "senderDeviceRef",
  "recipientAccountRef",
  "recipientDeviceRef",
  "conversationId",
  "ratchetPublicKeyHex",
]);

const MESSAGE_FIELDS = new Set<string>([
  "schemaVersion",
  "kind",
  "suite",
  "generation",
  "sessionId",
  "messageNumber",
  "wireMessageBase64",
]);

function isWellFormedSessionInit(candidate: unknown): candidate is FedosDirectRatchetSessionInitPayloadV1 {
  if (!hasExactFields(candidate, SESSION_INIT_FIELDS)) return false;
  const p = candidate as Record<string, unknown>;
  if (p.schemaVersion !== SCHEMA_VERSION) return false;
  if (p.kind !== "session-init") return false;
  if (typeof p.suite !== "string" || p.suite.length === 0) return false;
  if (!Number.isInteger(p.generation) || (p.generation as number) < 0) return false;
  if (!isWellFormedAccountRef(p.senderAccountRef)) return false;
  if (!isSafeIdField(p.senderDeviceRef)) return false;
  if (!isWellFormedAccountRef(p.recipientAccountRef)) return false;
  if (!isSafeIdField(p.recipientDeviceRef)) return false;
  if (!isSafeIdField(p.conversationId)) return false;
  if (typeof p.ratchetPublicKeyHex !== "string" || !NOSTR_HEX_PUBLIC_KEY_PATTERN.test(p.ratchetPublicKeyHex)) return false;
  return true;
}

function isWellFormedMessage(candidate: unknown): candidate is FedosDirectRatchetMessagePayloadV1 {
  if (!hasExactFields(candidate, MESSAGE_FIELDS)) return false;
  const p = candidate as Record<string, unknown>;
  if (p.schemaVersion !== SCHEMA_VERSION) return false;
  if (p.kind !== "message") return false;
  if (typeof p.suite !== "string" || p.suite.length === 0) return false;
  if (!Number.isInteger(p.generation) || (p.generation as number) < 0) return false;
  if (!isSafeIdField(p.sessionId)) return false;
  if (!Number.isInteger(p.messageNumber) || (p.messageNumber as number) < 0) return false;
  if (!isValidBase64(p.wireMessageBase64, MAX_WIRE_MESSAGE_BASE64_LENGTH)) return false;
  return true;
}

/** Total, never throws. Requires the EXACT closed shape of one of the two kinds — no unknown field, no missing field, no cross-kind field bleed. */
export function isWellFormedFedosDirectRatchetNip17Payload(candidate: unknown): candidate is FedosDirectRatchetNip17PayloadV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const kind = (candidate as Record<string, unknown>).kind;
  if (kind === "session-init") return isWellFormedSessionInit(candidate);
  if (kind === "message") return isWellFormedMessage(candidate);
  return false;
}

/** Plain `JSON.stringify` — private content only this Arc's own strict decoder ever parses back (mirrors `serializeFedosNip17RumorForEncryption()`'s own identical discipline, `../nip17/fedos_nip17_rumor.js`). */
export function encodeFedosDirectRatchetNip17PayloadToPlaintext(payload: FedosDirectRatchetNip17PayloadV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

/**
 * Fail-closed, never throws. `null` for invalid UTF-8, invalid JSON, or a
 * shape that does not EXACTLY match one of the two closed payload kinds
 * — this is the ONE gate that lets an inbound coordinator (Phase G)
 * distinguish "this Rumor carries one of OUR ratchet payloads" from
 * "this is an ordinary legacy/static NIP-17 chat message", tried BEFORE
 * any ratchet session state is ever touched.
 */
export function decodeFedosDirectRatchetNip17PayloadFromContent(content: string): FedosDirectRatchetNip17PayloadV1 | null {
  if (typeof content !== "string" || content.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  return isWellFormedFedosDirectRatchetNip17Payload(parsed) ? parsed : null;
}

export function wireMessageBytesToBase64(wireMessage: Uint8Array): string {
  return Buffer.from(wireMessage).toString("base64");
}

/** `null` on any malformed base64 — untrusted network input, never throws. */
export function wireMessageBytesFromBase64(base64: string): Uint8Array | null {
  if (!isValidBase64(base64, MAX_WIRE_MESSAGE_BASE64_LENGTH)) return null;
  try {
    return new Uint8Array(Buffer.from(base64, "base64"));
  } catch {
    return null;
  }
}
