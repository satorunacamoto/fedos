/**
 * FedOS Peer Device Discovery Arc — signature and trust boundary.
 * Mirrors `../ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.ts`
 * almost verbatim (see `06_PROTOCOL_CONTRACT_FREEZE.md` §3 for the
 * corrected, implementation-time device-signature-optional decision — the
 * exact same evidence-level model peer_capability already established for
 * the exact same reason: no durable local-device-keypair store exists
 * anywhere in this codebase).
 *
 * Account-level authentication: the SAME fixed kind-1 Nostr event pattern,
 * signed via the existing, unwidened `FedosNostrSigningAuthority`, verified
 * via the existing `NobleSignatureVerifier` (real BIP-340 Schnorr). The
 * account's public identity is read ONLY from the cryptographically-
 * verified `event.pubkey`, never accepted as caller input.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { FedosNostrWireEvent } from "../../desktop/fedos_nostr_wire_event.js";
import { NobleSignatureVerifier } from "../../adapters/nostr/protocol/noble_signature.js";
import type { FedosNostrSigningAuthority } from "../../adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import {
  isWellFormedFedosDevicePublicKeyHex,
  verifyFedosDeviceSigningSignature,
  type FedosDeviceSigningKeypair,
} from "../../device/crypto/fedos_device_signing_keypair.js";

/** Recognizable, non-authenticating marker tag — the real boundary is the domain string embedded in this record's own canonical content. */
export const FEDOS_PEER_DEVICE_ANNOUNCEMENT_NOSTR_TAG: readonly [string, string] = ["t", "fedos-peer-device-announcement-v1"];
const FIXED_NOSTR_KIND = 1;

export interface FedosPeerDeviceAnnouncementAccountAuthorizationV1 {
  readonly event: FedosNostrWireEvent;
}

/** `null` on a signing-authority failure — fails closed, never throws. */
export async function authorizeFedosPeerDeviceAnnouncementContent(
  signingAuthority: FedosNostrSigningAuthority,
  accountIndex: number,
  createdAt: number,
  canonicalContent: string,
): Promise<FedosPeerDeviceAnnouncementAccountAuthorizationV1 | null> {
  const event = await signingAuthority.signEvent({
    accountIndex,
    createdAt,
    kind: FIXED_NOSTR_KIND,
    tags: [FEDOS_PEER_DEVICE_ANNOUNCEMENT_NOSTR_TAG],
    content: canonicalContent,
  });
  if (event === null) return null;
  return Object.freeze({ event });
}

export type FedosPeerDeviceAnnouncementAccountAuthorizationOutcome = "valid" | "wrong-kind" | "content-mismatch" | "invalid-signature";

export interface FedosPeerDeviceAnnouncementAccountAuthorizationVerification {
  readonly outcome: FedosPeerDeviceAnnouncementAccountAuthorizationOutcome;
  /** Populated ONLY on `"valid"` — the cryptographically-verified signer. Never a caller claim. */
  readonly accountPublicKeyHex: string | null;
}

function tagsMatch(tags: readonly (readonly string[])[]): boolean {
  return (
    tags.length === 1 &&
    tags[0]!.length === FEDOS_PEER_DEVICE_ANNOUNCEMENT_NOSTR_TAG.length &&
    tags[0]!.every((field, i) => field === FEDOS_PEER_DEVICE_ANNOUNCEMENT_NOSTR_TAG[i])
  );
}

/** Fails closed with a specific, non-sensitive outcome; never throws. `accountPublicKeyHex` populated ONLY on `"valid"`. */
export async function verifyFedosPeerDeviceAnnouncementAccountAuthorization(
  authorization: FedosPeerDeviceAnnouncementAccountAuthorizationV1,
  canonicalContent: string,
): Promise<FedosPeerDeviceAnnouncementAccountAuthorizationVerification> {
  const { event } = authorization;
  if (event.kind !== FIXED_NOSTR_KIND) return { outcome: "wrong-kind", accountPublicKeyHex: null };
  if (!tagsMatch(event.tags) || event.content !== canonicalContent) {
    return { outcome: "content-mismatch", accountPublicKeyHex: null };
  }
  const verified = await NobleSignatureVerifier.verify(event);
  if (!verified) return { outcome: "invalid-signature", accountPublicKeyHex: null };
  return { outcome: "valid", accountPublicKeyHex: event.pubkey };
}

/** Distinct per record kind so a device signature over one record type can never be replayed as authenticating another. */
function deviceDigest(domainPrefix: string, canonicalContent: string): Uint8Array {
  return sha256(new TextEncoder().encode(domainPrefix + canonicalContent));
}

/** `null` only on a malformed keypair. */
export function createFedosPeerDeviceAnnouncementDeviceSignature(
  keypair: FedosDeviceSigningKeypair,
  domainPrefix: string,
  canonicalContent: string,
): string | null {
  if (!isWellFormedFedosDevicePublicKeyHex(keypair.publicKeyHex)) return null;
  return bytesToHex(keypair.sign(deviceDigest(domainPrefix, canonicalContent)));
}

/** Fails closed to `false`; never throws. */
export function verifyFedosPeerDeviceAnnouncementDeviceSignature(
  devicePublicKeyHex: string,
  domainPrefix: string,
  canonicalContent: string,
  signatureHex: string,
): boolean {
  return verifyFedosDeviceSigningSignature(devicePublicKeyHex, deviceDigest(domainPrefix, canonicalContent), signatureHex);
}

/**
 * Reused verbatim from `peer_capability`'s own three-value evidence model
 * (see this file's own header) — a valid signature never silently upgrades
 * between these; the common case is `"account-authenticated"` alone.
 */
export type FedosPeerDeviceAnnouncementEvidenceLevel = "account-authenticated" | "account-and-device-authenticated" | "account-authenticated-device-proof-unavailable";

export function evaluateFedosPeerDeviceAnnouncementEvidence(
  deviceSignatureHex: string | null,
  deviceSignatureVerified: boolean,
): FedosPeerDeviceAnnouncementEvidenceLevel {
  // Unlike peer_capability (which corroborates against a THIRD PARTY's
  // devicePublicKeyRef on file), this record's own devicePublicKeyHex IS
  // the claimed key -- so "proof available" only depends on whether a
  // signature was actually supplied and verified, not on a separate
  // Registry lookup.
  if (deviceSignatureHex === null) return "account-authenticated-device-proof-unavailable";
  return deviceSignatureVerified ? "account-and-device-authenticated" : "account-authenticated";
}
