/**
 * Secure Runtime Alpha 5721–5800 (FedOS Ratchet Peer Notification and
 * Capability Advertisement Arc) — Phase E: signature and trust boundary.
 *
 * Account-level authentication reuses the EXACT pattern Phase A found in
 * `../../../device/binding_challenge/fedos_device_binding_account_authorization.ts`:
 * a fixed kind-1 Nostr event, signed via the existing, unwidened
 * `FedosNostrSigningAuthority` (`kind` fixed to 1 at BOTH the TypeScript
 * and Rust/WASM boundary — this file adds no new kind, no new WASM
 * export), verified via the existing `NobleSignatureVerifier` (real
 * BIP-340 Schnorr). The account's public identity is read ONLY from the
 * cryptographically-verified `event.pubkey`, never accepted as caller
 * input. A fixed `t` tag plus a domain string embedded in the signed
 * content (distinct per record kind — see each schema file's own
 * `canonicalSerialize*()`) prevents this signature from ever being
 * confused with a Device Binding authorization, a Session Reset
 * signature, or an ordinary text note.
 *
 * Device-level authentication reuses the EXACT best-effort pattern Phase
 * A found in `../fedos_direct_ratchet_session_reset_authentication.ts`:
 * a domain-separated `sha256` preimage signed with the existing,
 * process-memory-only `FedosDeviceSigningKeypair` (Alpha 3161–3240). This
 * Arc does NOT fabricate durable Device-key storage — Phase A reconfirmed
 * none exists. A Device signature is therefore always OPTIONAL evidence,
 * never a hard requirement, mirrored exactly by
 * `FedosRatchetPeerCapabilityEvidenceLevel` below, which distinguishes
 * "account-authenticated" from "account-and-device-authenticated" from
 * "account-authenticated-device-proof-unavailable" as three genuinely
 * distinct evidence states a valid signature never silently upgrades
 * between (Phase E's own requirement).
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { FedosNostrWireEvent } from "../../../../../desktop/fedos_nostr_wire_event.js";
import { NobleSignatureVerifier } from "../../../../../nostr/noble_signature.js";
import type { NostrEvent, NostrTag } from "../../../../../nostr/types.js";
import type { FedosNostrSigningAuthority } from "../../../../../nostr/sign/fedos_nostr_signing_authority.js";
import {
  isWellFormedFedosDevicePublicKeyHex,
  verifyFedosDeviceSigningSignature,
  type FedosDeviceSigningKeypair,
} from "../../../../../device/crypto/fedos_device_signing_keypair.js";

/** Recognizable, non-authenticating marker tag — the real boundary is the domain string embedded in each record's own canonical content. */
export const FEDOS_RATCHET_PEER_CAPABILITY_NOSTR_TAG: readonly [string, string] = ["t", "fedos-ratchet-peer-capability-v1"];
const FIXED_NOSTR_KIND = 1;

export interface FedosRatchetPeerCapabilityAccountAuthorizationV1 {
  readonly event: FedosNostrWireEvent;
}

/**
 * Signs `canonicalContent` (already domain-separated by the caller's own
 * schema — see each record type's `canonicalSerialize*()`) as a fixed
 * kind-1 event. `null` on a signing-authority failure (no Master Seed
 * held, WASM unavailable, etc.) — fails closed, never throws.
 */
export async function authorizeFedosRatchetPeerCapabilityContent(
  signingAuthority: FedosNostrSigningAuthority,
  accountIndex: number,
  createdAt: number,
  canonicalContent: string,
): Promise<FedosRatchetPeerCapabilityAccountAuthorizationV1 | null> {
  const event = await signingAuthority.signEvent({
    accountIndex,
    createdAt,
    kind: FIXED_NOSTR_KIND,
    tags: [FEDOS_RATCHET_PEER_CAPABILITY_NOSTR_TAG],
    content: canonicalContent,
  });
  if (event === null) return null;
  return Object.freeze({ event });
}

export type FedosRatchetPeerCapabilityAccountAuthorizationOutcome =
  | "valid"
  | "wrong-kind"
  | "content-mismatch"
  | "invalid-signature";

export interface FedosRatchetPeerCapabilityAccountAuthorizationVerification {
  readonly outcome: FedosRatchetPeerCapabilityAccountAuthorizationOutcome;
  /** Populated ONLY on `"valid"` — the cryptographically-verified signer. Never a caller claim. */
  readonly accountPublicKeyHex: string | null;
}

function toMutableNostrEvent(event: FedosNostrWireEvent): NostrEvent {
  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags.map((tag): NostrTag => [...tag]),
    content: event.content,
    sig: event.sig,
  };
}

function tagsMatch(tags: readonly (readonly string[])[]): boolean {
  return (
    tags.length === 1 &&
    tags[0]!.length === FEDOS_RATCHET_PEER_CAPABILITY_NOSTR_TAG.length &&
    tags[0]!.every((field, i) => field === FEDOS_RATCHET_PEER_CAPABILITY_NOSTR_TAG[i])
  );
}

/**
 * Verifies an account authorization against the EXACT `canonicalContent`
 * the caller reconstructs from the record it received (never the
 * event's own `content` trusted blind). Fails closed with a specific,
 * non-sensitive outcome; never throws. `accountPublicKeyHex` is
 * populated ONLY on `"valid"`.
 */
export async function verifyFedosRatchetPeerCapabilityAccountAuthorization(
  authorization: FedosRatchetPeerCapabilityAccountAuthorizationV1,
  canonicalContent: string,
): Promise<FedosRatchetPeerCapabilityAccountAuthorizationVerification> {
  const { event } = authorization;
  if (event.kind !== FIXED_NOSTR_KIND) return { outcome: "wrong-kind", accountPublicKeyHex: null };
  if (!tagsMatch(event.tags) || event.content !== canonicalContent) {
    return { outcome: "content-mismatch", accountPublicKeyHex: null };
  }
  const verified = await NobleSignatureVerifier.verify(toMutableNostrEvent(event));
  if (!verified) return { outcome: "invalid-signature", accountPublicKeyHex: null };
  return { outcome: "valid", accountPublicKeyHex: event.pubkey };
}

/** Distinct per record kind so a device signature over one record type can never be replayed as authenticating another. */
function deviceDigest(domainPrefix: string, canonicalContent: string): Uint8Array {
  return sha256(new TextEncoder().encode(domainPrefix + canonicalContent));
}

/** `null` only on a malformed keypair — mirrors `createFedosDirectRatchetSessionResetDeviceSignature()`'s own never-throw discipline. */
export function createFedosRatchetPeerCapabilityDeviceSignature(
  keypair: FedosDeviceSigningKeypair,
  domainPrefix: string,
  canonicalContent: string,
): string | null {
  if (!isWellFormedFedosDevicePublicKeyHex(keypair.publicKeyHex)) return null;
  return bytesToHex(keypair.sign(deviceDigest(domainPrefix, canonicalContent)));
}

/** Fails closed to `false`; never throws. */
export function verifyFedosRatchetPeerCapabilityDeviceSignature(
  devicePublicKeyHex: string,
  domainPrefix: string,
  canonicalContent: string,
  signatureHex: string,
): boolean {
  return verifyFedosDeviceSigningSignature(devicePublicKeyHex, deviceDigest(domainPrefix, canonicalContent), signatureHex);
}

/**
 * Phase E's required distinct evidence states — a valid signature never
 * silently upgrades between them, and this function is called ONLY after
 * any present-but-mismatched device signature has already been rejected
 * outright by the caller (mirroring `fedos_direct_ratchet_session_reset_authority.ts`'s
 * own `"rejected-signature"` — a bad signature is a hard rejection, never
 * one of these three evidence levels):
 *
 *   - `"account-and-device-authenticated"` — a `devicePublicKeyRef` is on
 *     file for the claimed sender Device AND a `deviceSignatureHex` was
 *     supplied AND it verified against that key.
 *   - `"account-authenticated"` — a `devicePublicKeyRef` IS on file (proof
 *     was possible in principle) but the sender did not supply a Device
 *     signature this time.
 *   - `"account-authenticated-device-proof-unavailable"` — no
 *     `devicePublicKeyRef` is on file at all for the claimed sender
 *     Device, so Device-level proof could not be checked regardless of
 *     whether a signature was offered (the common case today — Phase A
 *     reconfirmed most bindings have `devicePublicKeyRef: null`).
 */
export type FedosRatchetPeerCapabilityEvidenceLevel =
  | "account-authenticated"
  | "account-and-device-authenticated"
  | "account-authenticated-device-proof-unavailable";

export function evaluateFedosRatchetPeerCapabilityEvidence(
  deviceSignatureHex: string | null,
  devicePublicKeyRef: string | null,
  deviceSignatureVerified: boolean,
): FedosRatchetPeerCapabilityEvidenceLevel {
  if (devicePublicKeyRef === null) return "account-authenticated-device-proof-unavailable";
  if (deviceSignatureHex === null) return "account-authenticated";
  return deviceSignatureVerified ? "account-and-device-authenticated" : "account-authenticated";
}
