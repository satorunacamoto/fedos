/**
 * FedOS Identity Transition Foundation Arc — Phase D: canonical,
 * deterministic serialization.
 *
 * Mirrors `../../nostr/event.ts`'s own `serializeForId()` discipline
 * exactly (fixed-order `JSON.stringify([...])` array, never object
 * property iteration) — this repo's own established convention for
 * "canonical signed content" (see reconciliation report §6): there is no
 * shared generic `canonicalize()` helper anywhere in this codebase: every
 * domain hand-rolls one fixed-order array per record type, always with an
 * explicit domain-separator string and integer Unix-second timestamps.
 * This file does the same for four distinct artifacts (transition body,
 * new-key proof, old-identity continuity proof, Device corroboration
 * proof), each with its OWN domain-separator tag so a signature computed
 * for one can never be replayed as if it were another.
 *
 * Every preimage binds `transitionId` + `revision` + the body's own
 * `bodyHash` — so mutating ANY body field changes `bodyHash`, which
 * invalidates every proof computed against the old hash (Phase D
 * requirement: "mutation invalidates verification").
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { FedosIdentityTransitionRecordV1 } from "../../../../conversation/identity_transition/fedos_identity_transition_record.js";

function digest(canonicalJson: string): Uint8Array {
  return sha256(new TextEncoder().encode(canonicalJson));
}

/** Fixed-order canonical bytes of the transition body. Excludes nothing — the body IS what every proof binds to via its hash. */
export function fedosIdentityTransitionCanonicalBody(record: FedosIdentityTransitionRecordV1): string {
  return JSON.stringify([
    "fedos:identity-transition:body:v1",
    record.schemaVersion,
    record.transitionId,
    record.transitionType,
    record.oldAccountIdentity.authority,
    record.oldAccountIdentity.publicIdentifier,
    record.oldAccountIdentity.identityId,
    record.newAccountIdentity.authority,
    record.newAccountIdentity.publicIdentifier,
    record.newAccountIdentity.identityId,
    record.oldNostrIdentity,
    record.newNostrIdentity,
    record.reasonCategory,
    record.issuedAt,
    record.expiresAt,
    record.revision,
    record.previousTransitionId,
    record.devicePolicy,
    record.ratchetPolicy,
    record.capabilityVersion,
  ]);
}

/** Hex sha256 of the canonical body — this is what every proof/evidence artifact binds to, so it never needs to duplicate the full body inline. */
export function fedosIdentityTransitionBodyHash(record: FedosIdentityTransitionRecordV1): string {
  return bytesToHex(digest(fedosIdentityTransitionCanonicalBody(record)));
}

export interface FedosIdentityTransitionProofBinding {
  readonly transitionId: string;
  readonly revision: number;
  readonly bodyHash: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

/** New-key proof-of-possession preimage — binds old+new Nostr identity so the proof cannot be replayed against a different identity pair (Phase F: "proof binds old and new identity"). */
export function fedosIdentityTransitionNewKeyProofDigest(
  binding: FedosIdentityTransitionProofBinding & { readonly oldNostrIdentity: string; readonly newNostrIdentity: string },
): Uint8Array {
  return digest(
    JSON.stringify([
      "fedos:identity-transition:new-key-proof:v1",
      binding.transitionId,
      binding.revision,
      binding.bodyHash,
      binding.oldNostrIdentity,
      binding.newNostrIdentity,
      binding.issuedAt,
      binding.expiresAt,
    ]),
  );
}

/** Old-identity continuity-signature preimage. */
export function fedosIdentityTransitionContinuityProofDigest(
  binding: FedosIdentityTransitionProofBinding & { readonly oldNostrIdentity: string; readonly newNostrIdentity: string },
): Uint8Array {
  return digest(
    JSON.stringify([
      "fedos:identity-transition:continuity-proof:v1",
      binding.transitionId,
      binding.revision,
      binding.bodyHash,
      binding.oldNostrIdentity,
      binding.newNostrIdentity,
      binding.issuedAt,
      binding.expiresAt,
    ]),
  );
}

/** Device corroboration preimage — binds the corroborating Device's own id in addition to the new identity, so one Device's proof can never be replayed as another Device's (Phase H: "one Device is not described as a quorum"). */
export function fedosIdentityTransitionDeviceCorroborationDigest(
  binding: FedosIdentityTransitionProofBinding & { readonly newNostrIdentity: string; readonly deviceId: string },
): Uint8Array {
  return digest(
    JSON.stringify([
      "fedos:identity-transition:device-corroboration:v1",
      binding.transitionId,
      binding.revision,
      binding.bodyHash,
      binding.newNostrIdentity,
      binding.deviceId,
      binding.issuedAt,
      binding.expiresAt,
    ]),
  );
}
