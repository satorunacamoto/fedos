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
import { isWellFormedFedosDirectRatchetSessionResetReason, type FedosDirectRatchetSessionResetReason } from "../../../ratchet/fedos_direct_ratchet_session_reset_reason.js";
import { isWellFormedFedosDeviceSchnorrSignatureHex } from "../../../../device/crypto/fedos_device_signing_keypair.js";

// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";

const SCHEMA_VERSION = 1;
const MAX_ID_FIELD_LENGTH = 512;
/** Bounded — a real ratchet wire message (secp256k1 header + short chat ciphertext) is always well under this; never unbounded. */
const MAX_WIRE_MESSAGE_BASE64_LENGTH = 65536;
const NOSTR_HEX_PUBLIC_KEY_PATTERN = /^[0-9a-f]{64}$/;
/** Mirrors `fedos_device_binding_challenge.ts`'s own `NONCE_HEX_PATTERN` exactly — the same replay-protection nonce shape this codebase already established for an authenticated challenge/response artifact. */
const RESET_NONCE_HEX_PATTERN = /^[0-9a-f]{32,64}$/;

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
 *
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — four ADDITIVE fields turn this same shape into the
 * "authenticated Session Reset message"
 * `docs/reviews/fedos_ratchet_multidevice_identity_rotation_v1/09_session_reset_and_reestablishment.md`
 * named as PROPOSED, never a new control-message kind (that review's own
 * explicit instruction): `previousGeneration`/`resetReason` are `null` for
 * a tuple's very first session (`generation === 0`), and non-null for
 * every reset of an existing generation; `resetNonce` is ALWAYS present
 * (harmless, consistent replay-protection key even at generation `0`);
 * `deviceSignatureHex` is an OPTIONAL, additive Device-level signature —
 * present only when the caller supplied a `FedosDeviceSigningKeypair`
 * (`../../../../device/crypto/fedos_device_signing_keypair.ts`, Alpha
 * 3161–3240) at the moment of establishing/resetting — this file's own
 * codec never requires one, matching that review's own "no NEW
 * authentication mechanism is required" conclusion: the existing NIP-17
 * envelope (a real Nostr-signed Rumor) already authenticates the sending
 * ACCOUNT; this field is a strictly-optional, additive strengthening that
 * additionally authenticates the sending DEVICE when a verifiable key is
 * on file for it (`FedosDirectRatchetSessionResetAuthority`, in
 * `../../../ratchet/fedos_direct_ratchet_session_reset_authority.ts`,
 * decides how to weigh its presence/absence — never this codec's job).
 */
export interface FedosDirectRatchetSessionInitPayloadV1 {
  readonly schemaVersion: 1;
  readonly kind: "session-init";
  readonly suite: FedosDirectRatchetSuite;
  readonly generation: number;
  /** `null` iff `generation === 0` (this tuple's very first session) — non-null names the EXACT generation this session-init supersedes. Structural-only here; `FedosDirectRatchetSessionResetAuthority` is the one place that checks it actually equals `generation - 1` and matches a real prior local record. */
  readonly previousGeneration: number | null;
  /** `null` iff `previousGeneration` is `null` — a reset always names why; a fresh, first-ever session never does. */
  readonly resetReason: FedosDirectRatchetSessionResetReason | null;
  /** Always present, even at `generation === 0` — the one replay-protection key `FedosDirectRatchetSessionResetAuthority`'s own nonce ledger is keyed by. */
  readonly resetNonce: string;
  /** The SENDER's own account/Device — from the RECEIVER's perspective, this is "remote". */
  readonly senderAccountRef: FedosDeviceBindingAccountRef;
  readonly senderDeviceRef: string;
  /** The RECEIVER's own account/Device, as the sender resolved them — validated against the receiver's own local config before trust (Phase D — "Device bound", "recipient bound"). */
  readonly recipientAccountRef: FedosDeviceBindingAccountRef;
  readonly recipientDeviceRef: string;
  readonly conversationId: string;
  /** The sender's freshly-generated ratchet DH PUBLIC key — public by definition, never a private key. */
  readonly ratchetPublicKeyHex: string;
  /** `null` when no local Device signing keypair was supplied to sign with — see this interface's own header. Never a raw key, never a private-key-bearing field. */
  readonly deviceSignatureHex: string | null;
}

/**
 * Phase F — the ratchet wire message (header + ciphertext), opaque and
 * already-encrypted.
 *
 * Secure Runtime Alpha 7401-7480 (FedOS Direct Conversation Route Binding
 * and NIP-17 Inbound Isolation Arc) — additive `schemaVersion: 2` adds
 * `conversationId`, this Arc's own authenticated route binding, letting
 * the inbound side resolve the EXACT target Conversation directly rather
 * than via the peer-only resolver's first-match guess (the exact
 * mechanism behind Finding 2 in
 * `docs/secure_runtime_alpha_7401_7480_defect_reproduction_report.md`).
 * `schemaVersion: 1` (no `conversationId`) is UNCHANGED and remains
 * decodable — see the Legacy and Migration Policy doc for the fallback
 * this Arc's own inbound integration uses for it.
 */
export interface FedosDirectRatchetMessagePayloadV1 {
  readonly schemaVersion: 1 | 2;
  readonly kind: "message";
  readonly suite: FedosDirectRatchetSuite;
  readonly generation: number;
  readonly sessionId: string;
  /** The ratchet send-chain message number this wire message consumed — safe, public metadata (review §10 §2), used ONLY for safe/import observability at this layer; replay rejection is the Rust ratchet core's own job (`decrypt()`). */
  readonly messageNumber: number;
  readonly wireMessageBase64: string;
  /** REQUIRED when `schemaVersion === 2`; absent at `schemaVersion === 1` (Secure Runtime Alpha 7401-7480's own additive route binding). */
  readonly conversationId?: string;
}

export type FedosDirectRatchetNip17PayloadV1 = FedosDirectRatchetSessionInitPayloadV1 | FedosDirectRatchetMessagePayloadV1;

const SESSION_INIT_FIELDS = new Set<string>([
  "schemaVersion",
  "kind",
  "suite",
  "generation",
  "previousGeneration",
  "resetReason",
  "resetNonce",
  "senderAccountRef",
  "senderDeviceRef",
  "recipientAccountRef",
  "recipientDeviceRef",
  "conversationId",
  "ratchetPublicKeyHex",
  "deviceSignatureHex",
]);

const MESSAGE_FIELDS_V1 = new Set<string>([
  "schemaVersion",
  "kind",
  "suite",
  "generation",
  "sessionId",
  "messageNumber",
  "wireMessageBase64",
]);

/** Secure Runtime Alpha 7401-7480 — additive: adds `conversationId` (this Arc's own route binding). */
const MESSAGE_FIELDS_V2 = new Set<string>([...MESSAGE_FIELDS_V1, "conversationId"]);

function isWellFormedSessionInit(candidate: unknown): candidate is FedosDirectRatchetSessionInitPayloadV1 {
  if (!hasExactFields(candidate, SESSION_INIT_FIELDS)) return false;
  const p = candidate as Record<string, unknown>;
  if (p.schemaVersion !== SCHEMA_VERSION) return false;
  if (p.kind !== "session-init") return false;
  if (typeof p.suite !== "string" || p.suite.length === 0) return false;
  if (!Number.isInteger(p.generation) || (p.generation as number) < 0) return false;
  if (p.previousGeneration !== null && (!Number.isInteger(p.previousGeneration) || (p.previousGeneration as number) < 0)) {
    return false;
  }
  if (p.previousGeneration !== null && (p.previousGeneration as number) >= (p.generation as number)) return false;
  // A reset always names why; a fresh, first-ever session never does —
  // structural correlation only, `FedosDirectRatchetSessionResetAuthority`
  // owns every business-logic check beyond this.
  if ((p.previousGeneration === null) !== (p.resetReason === null)) return false;
  if (p.resetReason !== null && !isWellFormedFedosDirectRatchetSessionResetReason(p.resetReason)) return false;
  if (typeof p.resetNonce !== "string" || !RESET_NONCE_HEX_PATTERN.test(p.resetNonce)) return false;
  if (!isWellFormedAccountRef(p.senderAccountRef)) return false;
  if (!isSafeIdField(p.senderDeviceRef)) return false;
  if (!isWellFormedAccountRef(p.recipientAccountRef)) return false;
  if (!isSafeIdField(p.recipientDeviceRef)) return false;
  if (!isSafeIdField(p.conversationId)) return false;
  if (typeof p.ratchetPublicKeyHex !== "string" || !NOSTR_HEX_PUBLIC_KEY_PATTERN.test(p.ratchetPublicKeyHex)) return false;
  if (p.deviceSignatureHex !== null && !isWellFormedFedosDeviceSchnorrSignatureHex(p.deviceSignatureHex)) return false;
  return true;
}

function isWellFormedMessage(candidate: unknown): candidate is FedosDirectRatchetMessagePayloadV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const p = candidate as Record<string, unknown>;
  // Secure Runtime Alpha 7401-7480 -- schemaVersion selects the EXACT
  // closed field set; any other value (never 1 or 2) fails closed here,
  // never guessed, never treated as the highest known version.
  if (p.schemaVersion !== 1 && p.schemaVersion !== 2) return false;
  const fields = p.schemaVersion === 2 ? MESSAGE_FIELDS_V2 : MESSAGE_FIELDS_V1;
  if (!hasExactFields(candidate, fields)) return false;
  if (p.kind !== "message") return false;
  if (typeof p.suite !== "string" || p.suite.length === 0) return false;
  if (!Number.isInteger(p.generation) || (p.generation as number) < 0) return false;
  if (!isSafeIdField(p.sessionId)) return false;
  if (!Number.isInteger(p.messageNumber) || (p.messageNumber as number) < 0) return false;
  if (!isValidBase64(p.wireMessageBase64, MAX_WIRE_MESSAGE_BASE64_LENGTH)) return false;
  if (p.schemaVersion === 2 && !isSafeIdField(p.conversationId)) return false;
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

/**
 * Secure Runtime Alpha 7401-7480 — total, never throws. Recognizes the
 * OUTER shape of a ratchet payload (a real `kind: "session-init" |
 * "message"` discriminant) independent of whether its own `schemaVersion`
 * is one this build understands. Lets the inbound integration
 * distinguish "this IS a ratchet payload, from a version we don't
 * understand yet" (`"unsupported-version"`, fails closed) from "this is
 * genuinely not a ratchet payload at all" (`"not-ratchet-payload"`, falls
 * through to the legacy chat path) — `decodeFedosDirectRatchetNip17PayloadFromContent()`
 * alone cannot distinguish these (it returns `null` for both), and
 * silently falling an unrecognized-but-ratchet-shaped future version
 * through to the legacy plain-chat path would violate this Arc's own
 * "unknown versions fail closed" requirement.
 */
export function isRecognizableFedosDirectRatchetNip17PayloadShape(content: string): boolean {
  if (typeof content !== "string" || content.length === 0) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return false;
  }
  if (typeof parsed !== "object" || parsed === null) return false;
  const kind = (parsed as Record<string, unknown>).kind;
  return kind === "session-init" || kind === "message";
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
