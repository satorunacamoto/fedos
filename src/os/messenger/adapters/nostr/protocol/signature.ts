/**
 * Stage 5 — signature verification boundary (interface only).
 *
 * This defines WHERE schnorr/secp256k1 verification will plug in, without
 * pulling a crypto library yet. It is a SEPARATE concern from `verifyEventId`
 * (which only checks that an event's id is a consistent hash of its contents —
 * not authorship).
 *
 * The default wiring uses `NoopSignatureVerifier`, which performs NO real
 * verification. Any surface that relies on Noop MUST disclose that signatures
 * are unverified (see the demo banner / README).
 */

import type { NostrEvent } from "./types.js";

export interface SignatureVerifier {
  /** Resolves true if the event's signature is valid for its pubkey/id. */
  verify(event: NostrEvent): Promise<boolean>;
}

/**
 * Accepts every event WITHOUT checking anything. Safe placeholder until a real
 * verifier is implemented — but it provides no authenticity guarantee.
 */
export const NoopSignatureVerifier: SignatureVerifier = {
  verify(): Promise<boolean> {
    return Promise.resolve(true);
  },
};

/** Rejects every event. Useful for tests and fail-closed configurations. */
export const RejectAllSignatureVerifier: SignatureVerifier = {
  verify(): Promise<boolean> {
    return Promise.resolve(false);
  },
};
