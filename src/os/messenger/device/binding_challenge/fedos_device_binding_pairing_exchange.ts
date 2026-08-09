/**
 * Secure Runtime Alpha 4581–4660 ("Desktop Device Registration, Pairing, and
 * Durable Sync Journal Arc") — Phase C/D: Pairing Exchange Format +
 * Transport-Neutral Port.
 *
 * Two immutable, versioned records travel between two physically separate
 * Devices during a real registration:
 *
 *   `FedosDevicePairingRequestV1` — produced by the JOINING Device (the one
 *   that generated the new, independent `FedosDeviceSigningKeypair` being
 *   registered). Carries the canonical challenge
 *   (`./fedos_device_binding_challenge.ts`) and that Device's OWN proof of
 *   possession over it (`./fedos_device_binding_proof_of_possession.ts`) —
 *   both PUBLIC, already-signed facts; no private key ever appears here.
 *
 *   `FedosDevicePairingApprovalV1` — produced by the AUTHORIZING Device (the
 *   one holding the account's own Nostr signing capability). Carries the
 *   SAME challenge plus the account authorization signature
 *   (`./fedos_device_binding_account_authorization.ts`) over it — again,
 *   only a public, already-signed fact.
 *
 * NEITHER record contains: a private key, the Master Seed, a passphrase, a
 * bearer secret, or any Sync package/content byte — every field is either a
 * public key, a public id, a timestamp, or an already-computed signature.
 * `pairingId` ties the two records together across the manual, out-of-band
 * hop; it is NOT a security boundary itself (the challenge's own `nonce`,
 * inside both signatures, is the actual replay guard) — it exists only so
 * the Joining Device can match an inbound approval back to the pending
 * request it created.
 *
 * PHASE D (transport-neutral port): `encode*`/`decode*` below ARE this
 * Arc's own "minimal pairing exchange port" — a caller (any future
 * QR/file/clipboard adapter) moves the resulting bounded UTF-8 string by
 * whatever channel it likes; nothing in this file performs I/O of any kind,
 * and nothing here assumes a specific channel. A class-shaped "port
 * interface" wrapping two functions would be pure ceremony over this exact
 * same contract, so none is introduced (AUTO MODE's own "never introduce
 * speculative abstractions" instruction).
 *
 * Validation is layered deliberately: `isWellFormedFedosDevicePairing*V1()`
 * is a pure STRUCTURAL check (right shape, right field types, no
 * unrecognized field, internally consistent challenge references) — it
 * NEVER performs cryptographic verification (that stays in
 * `../../desktop/runtime/fedos_device_pairing_facade.ts`, Phase B, the only
 * place either signature is ever actually checked). `decodeFedosDevicePairing*V1()`
 * additionally enforces a hard byte-length ceiling BEFORE ever calling
 * `JSON.parse()`, so a caller can never be induced to parse an unbounded
 * blob.
 */

import {
  isWellFormedFedosDeviceBindingChallengeV1,
  serializeFedosDeviceBindingChallengeV1,
  type FedosDeviceBindingChallengeV1,
} from "../../../../device/binding_challenge/fedos_device_binding_challenge.js";
import type { FedosDeviceBindingProofOfPossessionV1 } from "../../../../device/binding_challenge/fedos_device_binding_proof_of_possession.js";
import type { FedosDeviceBindingAccountAuthorizationV1 } from "../../../../device/binding_challenge/fedos_device_binding_account_authorization.js";
import type { FedosNostrWireEvent } from "../../../../desktop/fedos_nostr_wire_event.js";

/** Hard size ceiling for either encoded exchange record — generous for a real challenge + Nostr event + two 128-hex signatures, still a real, enforced bound (Phase C's own "size limits" requirement). */
export const FEDOS_DEVICE_PAIRING_EXCHANGE_MAX_BYTE_LENGTH = 16_384;

const PAIRING_ID_PATTERN = /^[0-9a-f]{16,64}$/;

export interface FedosDevicePairingRequestV1 {
  readonly schemaVersion: 1;
  readonly pairingId: string;
  readonly challenge: FedosDeviceBindingChallengeV1;
  readonly deviceProof: FedosDeviceBindingProofOfPossessionV1;
}

export interface FedosDevicePairingApprovalV1 {
  readonly schemaVersion: 1;
  readonly pairingId: string;
  readonly challenge: FedosDeviceBindingChallengeV1;
  readonly accountAuthorization: FedosDeviceBindingAccountAuthorizationV1;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isWellFormedDeviceProofShape(candidate: unknown): candidate is FedosDeviceBindingProofOfPossessionV1 {
  if (candidate === null || typeof candidate !== "object") return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 3) return false;
  if (!isWellFormedFedosDeviceBindingChallengeV1(value.challenge)) return false;
  if (typeof value.devicePublicKeyHex !== "string") return false;
  if (typeof value.signatureHex !== "string") return false;
  return true;
}

const NOSTR_WIRE_EVENT_KEYS: ReadonlySet<string> = new Set(["id", "pubkey", "created_at", "kind", "tags", "content", "sig"]);

function isWellFormedNostrWireEventShape(candidate: unknown): candidate is FedosNostrWireEvent {
  if (candidate === null || typeof candidate !== "object") return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== NOSTR_WIRE_EVENT_KEYS.size || !keys.every((key) => NOSTR_WIRE_EVENT_KEYS.has(key))) return false;
  if (typeof value.id !== "string" || typeof value.pubkey !== "string") return false;
  if (typeof value.created_at !== "number" || typeof value.kind !== "number") return false;
  if (typeof value.content !== "string" || typeof value.sig !== "string") return false;
  if (!Array.isArray(value.tags) || !value.tags.every((tag) => Array.isArray(tag) && tag.every((field) => typeof field === "string"))) return false;
  return true;
}

function isWellFormedAccountAuthorizationShape(candidate: unknown): candidate is FedosDeviceBindingAccountAuthorizationV1 {
  if (candidate === null || typeof candidate !== "object") return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 2) return false;
  if (!isWellFormedFedosDeviceBindingChallengeV1(value.challenge)) return false;
  if (!isWellFormedNostrWireEventShape(value.event)) return false;
  return true;
}

/** Structural validation ONLY — never checks a signature, expiry, or replay. Fails closed; never throws. */
export function isWellFormedFedosDevicePairingRequestV1(candidate: unknown): candidate is FedosDevicePairingRequestV1 {
  if (candidate === null || typeof candidate !== "object") return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 4) return false;
  if (value.schemaVersion !== 1) return false;
  if (typeof value.pairingId !== "string" || !PAIRING_ID_PATTERN.test(value.pairingId)) return false;
  if (!isWellFormedFedosDeviceBindingChallengeV1(value.challenge)) return false;
  if (!isWellFormedDeviceProofShape(value.deviceProof)) return false;
  const challenge = value.challenge as FedosDeviceBindingChallengeV1;
  const proof = value.deviceProof as FedosDeviceBindingProofOfPossessionV1;
  // Cross-field consistency: the embedded proof must reference the EXACT SAME challenge this record carries (Phase C's own "strict field validation") -- never two divergent challenge copies in one record.
  if (serializeFedosDeviceBindingChallengeV1(challenge) !== serializeFedosDeviceBindingChallengeV1(proof.challenge)) return false;
  if (challenge.action !== "register-device") return false;
  return true;
}

/** Structural validation ONLY — never checks a signature, expiry, or replay. Fails closed; never throws. */
export function isWellFormedFedosDevicePairingApprovalV1(candidate: unknown): candidate is FedosDevicePairingApprovalV1 {
  if (candidate === null || typeof candidate !== "object") return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 4) return false;
  if (value.schemaVersion !== 1) return false;
  if (typeof value.pairingId !== "string" || !PAIRING_ID_PATTERN.test(value.pairingId)) return false;
  if (!isWellFormedFedosDeviceBindingChallengeV1(value.challenge)) return false;
  if (!isWellFormedAccountAuthorizationShape(value.accountAuthorization)) return false;
  const challenge = value.challenge as FedosDeviceBindingChallengeV1;
  const authorization = value.accountAuthorization as FedosDeviceBindingAccountAuthorizationV1;
  if (serializeFedosDeviceBindingChallengeV1(challenge) !== serializeFedosDeviceBindingChallengeV1(authorization.challenge)) return false;
  return true;
}

/** `null` on a structurally-invalid record or one that would exceed the size ceiling once encoded. Never throws. */
export function encodeFedosDevicePairingRequestV1(request: FedosDevicePairingRequestV1): string | null {
  if (!isWellFormedFedosDevicePairingRequestV1(request)) return null;
  const encoded = JSON.stringify(request);
  return byteLength(encoded) > FEDOS_DEVICE_PAIRING_EXCHANGE_MAX_BYTE_LENGTH ? null : encoded;
}

/** `null` on malformed input, oversized input, or invalid JSON. Never throws. */
export function decodeFedosDevicePairingRequestV1(encoded: unknown): FedosDevicePairingRequestV1 | null {
  if (typeof encoded !== "string" || encoded.length === 0) return null;
  if (byteLength(encoded) > FEDOS_DEVICE_PAIRING_EXCHANGE_MAX_BYTE_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    return null;
  }
  return isWellFormedFedosDevicePairingRequestV1(parsed) ? parsed : null;
}

/** `null` on a structurally-invalid record or one that would exceed the size ceiling once encoded. Never throws. */
export function encodeFedosDevicePairingApprovalV1(approval: FedosDevicePairingApprovalV1): string | null {
  if (!isWellFormedFedosDevicePairingApprovalV1(approval)) return null;
  const encoded = JSON.stringify(approval);
  return byteLength(encoded) > FEDOS_DEVICE_PAIRING_EXCHANGE_MAX_BYTE_LENGTH ? null : encoded;
}

/** `null` on malformed input, oversized input, or invalid JSON. Never throws. */
export function decodeFedosDevicePairingApprovalV1(encoded: unknown): FedosDevicePairingApprovalV1 | null {
  if (typeof encoded !== "string" || encoded.length === 0) return null;
  if (byteLength(encoded) > FEDOS_DEVICE_PAIRING_EXCHANGE_MAX_BYTE_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    return null;
  }
  return isWellFormedFedosDevicePairingApprovalV1(parsed) ? parsed : null;
}
