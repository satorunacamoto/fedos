/**
 * Secure Runtime Alpha 3161–3240 ("Account-to-Device Signature Verification
 * Boundary") — Phase D: Account Authorization Signature.
 *
 * Uses the EXISTING, narrow `FedosNostrSigningAuthority`
 * (`../../nostr/sign/fedos_nostr_signing_authority.ts`) exactly as it stands
 * — `kind` fixed to `1` by that file's own Alpha 424 scope decision, enforced
 * at BOTH the TypeScript boundary and the Rust/WASM boundary
 * (`sign_nostr_event`, `packages/fedos-core-rust/src/lib.rs`). This Arc does
 * NOT widen that API: no new kind, no caller-supplied `pubkey`/`id`/`sig`,
 * no new WASM export. Source inspection (Phase A) confirms kind-1 is a
 * deliberate, reviewed, unchanged scope boundary — not an accepted place to
 * add a second signing mode.
 *
 * Instead, the Device Binding Challenge's own canonical serialization
 * (`./fedos_device_binding_challenge.ts`) becomes the `content` of an
 * ordinary kind:1 event, with a fixed, recognizable tag. This is a
 * DETACHED, domain-specific authorization in every way that matters: the
 * `domain` field inside the signed content is this protocol's own separator,
 * so a legitimate text note can never collide with it, and a Device Binding
 * authorization can never be replayed as one either — the full content must
 * match byte-for-byte before any signature check is even attempted. Nothing
 * about `FedosNostrSigningAuthority`'s own contract changes.
 *
 * Verification reuses the EXISTING, already-reviewed `NobleSignatureVerifier`
 * (`../../nostr/noble_signature.ts`, real BIP-340 Schnorr over secp256k1) —
 * this file adds no new cryptographic primitive, and defines no generic
 * `verify(anything)` authority: `verifyFedosDeviceBindingAccountAuthorization()`
 * is hardwired to this one challenge shape and this one domain.
 *
 * The account's public identity (`accountPublicKeyHex`) is NEVER accepted as
 * caller input anywhere in this file — it is read ONLY from the
 * cryptographically-verified `event.pubkey` after signature verification
 * succeeds. A caller cannot claim to be a different account than the one
 * that actually produced the signature.
 */

import type { FedosNostrWireEvent } from "../../../../desktop/fedos_nostr_wire_event.js";
import { NobleSignatureVerifier } from "../../../../nostr/noble_signature.js";
import type { NostrEvent, NostrTag } from "../../../../nostr/types.js";
import type { FedosNostrSigningAuthority } from "../../../../nostr/sign/fedos_nostr_signing_authority.js";
import {
  FEDOS_DEVICE_BINDING_DOMAIN_V1,
  isWellFormedFedosDeviceBindingChallengeV1,
  serializeFedosDeviceBindingChallengeV1,
  type FedosDeviceBindingChallengeV1,
} from "../../../../device/binding_challenge/fedos_device_binding_challenge.js";

/** Recognizable, non-authenticating marker tag — the actual security boundary is `domain` inside the signed `content`, not this tag. */
export const FEDOS_DEVICE_BINDING_TAG: readonly [string, string] = ["t", "fedos-device-binding-v1"];

const FIXED_NOSTR_KIND = 1;

export interface FedosDeviceBindingAccountAuthorizationV1 {
  readonly challenge: FedosDeviceBindingChallengeV1;
  readonly event: FedosNostrWireEvent;
}

/**
 * Builds and signs an account authorization for `challenge`, via the
 * injected account signing authority (never this file's own crypto).
 * `null` on a malformed challenge or if the signing authority itself could
 * not sign (no Master Seed held, WASM unavailable, etc.) — fails closed,
 * never throws.
 */
export async function authorizeFedosDeviceBindingChallenge(
  signingAuthority: FedosNostrSigningAuthority,
  accountIndex: number,
  challenge: FedosDeviceBindingChallengeV1,
): Promise<FedosDeviceBindingAccountAuthorizationV1 | null> {
  if (!isWellFormedFedosDeviceBindingChallengeV1(challenge)) return null;

  const event = await signingAuthority.signEvent({
    accountIndex,
    createdAt: challenge.issuedAt,
    kind: FIXED_NOSTR_KIND,
    tags: [FEDOS_DEVICE_BINDING_TAG],
    content: serializeFedosDeviceBindingChallengeV1(challenge),
  });
  if (event === null) return null;

  return Object.freeze({ challenge, event });
}

export type FedosDeviceBindingAccountAuthorizationOutcome =
  | "valid"
  | "malformed-challenge"
  | "wrong-domain"
  | "wrong-kind"
  | "content-mismatch"
  | "invalid-signature"
  | "expired";

export interface FedosDeviceBindingAccountAuthorizationVerification {
  readonly outcome: FedosDeviceBindingAccountAuthorizationOutcome;
  /** The cryptographically-verified account public key — present ONLY on `"valid"`. Never a caller claim. */
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
  return tags.length === 1 && tags[0]!.length === FEDOS_DEVICE_BINDING_TAG.length && tags[0]!.every((field, i) => field === FEDOS_DEVICE_BINDING_TAG[i]);
}

/**
 * Verifies an account authorization end to end: challenge well-formedness,
 * domain separation, exact content reconstruction, real Schnorr signature
 * verification, then expiry. Fails closed with a specific, non-sensitive
 * outcome; never throws. `accountPublicKeyHex` is populated ONLY on
 * `"valid"` — every other outcome carries `null`, never a half-trusted value.
 */
export async function verifyFedosDeviceBindingAccountAuthorization(
  authorization: FedosDeviceBindingAccountAuthorizationV1,
  now: number,
): Promise<FedosDeviceBindingAccountAuthorizationVerification> {
  const { challenge, event } = authorization;

  if (!isWellFormedFedosDeviceBindingChallengeV1(challenge)) {
    return { outcome: "malformed-challenge", accountPublicKeyHex: null };
  }
  if (challenge.domain !== FEDOS_DEVICE_BINDING_DOMAIN_V1) {
    return { outcome: "wrong-domain", accountPublicKeyHex: null };
  }
  if (event.kind !== FIXED_NOSTR_KIND) {
    return { outcome: "wrong-kind", accountPublicKeyHex: null };
  }
  if (!tagsMatch(event.tags) || event.content !== serializeFedosDeviceBindingChallengeV1(challenge)) {
    return { outcome: "content-mismatch", accountPublicKeyHex: null };
  }

  const verified = await NobleSignatureVerifier.verify(toMutableNostrEvent(event));
  if (!verified) {
    return { outcome: "invalid-signature", accountPublicKeyHex: null };
  }

  if (now > challenge.expiresAt) {
    return { outcome: "expired", accountPublicKeyHex: null };
  }

  return { outcome: "valid", accountPublicKeyHex: event.pubkey };
}
