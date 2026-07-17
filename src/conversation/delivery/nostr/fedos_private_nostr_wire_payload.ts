/**
 * Secure Runtime Alpha 1401/1402 ("Inner Private Payload" / "Recipient-
 * Specific Wrapping") — Phase B of the Alpha 1391–1470 Nostr Private
 * Direct and Pairwise Fanout Delivery Arc.
 *
 * The "wrap" this Arc implements is deliberately NOT a second encryption
 * layer — no gift-wrap, no seal, no ephemeral-key scheme is invented here
 * (the Protocol Compliance Gate, Alpha 1393, found no reviewed normative
 * material to build one honestly against). Confidentiality is provided
 * entirely by the EXISTING, real, already-proven pairwise ECDH + AEAD
 * scheme (`FedosConversationEncryptionAuthority`/`DecryptionAuthority`,
 * Alpha 861–890, real since Secure Runtime Alpha 1261–1320). This file
 * only SERIALIZES an already-encrypted `FedosConversationMessageEnvelope`
 * plus its already-stored opaque ciphertext bytes into the Nostr event
 * `content` field, and back.
 *
 * Every field below is REQUIRED verbatim, byte-identical to what the
 * SENDER originally encrypted with — `FedosConversationDecryptionAuthority.decrypt()`
 * re-derives the Alpha 856 associated-data header from these exact
 * fields and byte-compares it before returning plaintext, so the
 * receiver must pass the sender's OWN `envelopeId`/`conversationId`/
 * `senderMembershipId`/`keyEpoch`/`createdAt`/`replyToEnvelopeId`/`suite`
 * through unchanged — never the receiver's own locally-resolved values
 * (see `fedos_private_nostr_inbound_delivery_coordinator.ts`). These are
 * therefore carried as OPAQUE FOREIGN identifiers here, never resolved or
 * interpreted as the receiver's own local ids.
 *
 * `groupLinkage` (Alpha 1394/1411) carries the SENDER's own local Group
 * Message id purely as opaque, non-canonical provenance — Alpha 1394's
 * freeze states plainly that no recipient's own id becomes the canonical
 * Group Message id; symmetrically, no FOREIGN sender-supplied id becomes
 * the receiver's own canonical id either. It is never used for anything
 * beyond an observability/dedup hint in the Local Import Record.
 *
 * No plaintext ever appears in this file (Alpha 1401's own "do not
 * duplicate plaintext" instruction) — `ciphertextBase64` is opaque,
 * already-sealed bytes copied verbatim from `FedosConversationPayloadStorage`.
 */

// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";

const WIRE_SCHEMA_VERSION = 1;
const MAX_ID_FIELD_LENGTH = 512;

export type FedosPrivateNostrWireSuite = "ChaCha20Poly1305" | "Aes256Gcm";

export interface FedosPrivateNostrWireGroupLinkage {
  readonly senderGroupMessageId: string;
  readonly replyToGroupMessageId: string | null;
}

export interface FedosPrivateNostrWirePayloadV1 {
  readonly schemaVersion: 1;
  readonly envelopeId: string;
  readonly conversationId: string;
  readonly senderMembershipId: string;
  readonly keyEpoch: number;
  readonly createdAt: number;
  readonly replyToEnvelopeId: string | null;
  readonly suite: FedosPrivateNostrWireSuite;
  readonly ciphertextBase64: string;
  readonly groupLinkage: FedosPrivateNostrWireGroupLinkage | null;
}

function isSafeIdField(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_FIELD_LENGTH;
}

function isValidBase64(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0;
}

/** Total, never throws — fails closed to `null` on any malformed/tampered field, mirroring `isWellFormedFedosNostrUnsignedEventRequest()`'s own exhaustive-field-check discipline. */
export function isWellFormedFedosPrivateNostrWirePayload(candidate: unknown): candidate is FedosPrivateNostrWirePayloadV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 10) return false;
  if (value.schemaVersion !== WIRE_SCHEMA_VERSION) return false;
  if (!isSafeIdField(value.envelopeId)) return false;
  if (!isSafeIdField(value.conversationId)) return false;
  if (!isSafeIdField(value.senderMembershipId)) return false;
  if (typeof value.keyEpoch !== "number" || !Number.isInteger(value.keyEpoch) || value.keyEpoch < 0) return false;
  if (typeof value.createdAt !== "number" || !Number.isInteger(value.createdAt) || value.createdAt < 0) return false;
  if (value.replyToEnvelopeId !== null && !isSafeIdField(value.replyToEnvelopeId)) return false;
  if (value.suite !== "ChaCha20Poly1305" && value.suite !== "Aes256Gcm") return false;
  if (!isValidBase64(value.ciphertextBase64)) return false;
  if (value.groupLinkage !== null) {
    if (typeof value.groupLinkage !== "object") return false;
    const linkage = value.groupLinkage as Record<string, unknown>;
    if (Object.keys(linkage).length !== 2) return false;
    if (!isSafeIdField(linkage.senderGroupMessageId)) return false;
    if (linkage.replyToGroupMessageId !== null && !isSafeIdField(linkage.replyToGroupMessageId)) return false;
  }
  return true;
}

/** Base64(JSON) — a plain, inspectable transport encoding; no compression, no second encryption layer (see this file's own header). */
export function encodeFedosPrivateNostrWirePayload(payload: FedosPrivateNostrWirePayloadV1): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/** Total, never throws — `null` on any parse/shape failure (untrusted network input). */
export function decodeFedosPrivateNostrWirePayload(content: string): FedosPrivateNostrWirePayloadV1 | null {
  if (typeof content !== "string" || content.length === 0) return null;
  let json: string;
  try {
    json = Buffer.from(content, "base64").toString("utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isWellFormedFedosPrivateNostrWirePayload(parsed)) return null;
  return parsed;
}
