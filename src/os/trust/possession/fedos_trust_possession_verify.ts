/**
 * Trust — verify a Proof of Possession response.
 *
 * Checks, in order: (1) envelope-level structure/signature/trust/expiry via
 * `verifyFedosTrustEnvelopeV1` with `expectedType: "fedos.possession.v1"`,
 * (2) the response's `nonce`/`audience` match the ORIGINAL challenge exactly
 * (never trust a response's own claimed values against anything but the
 * challenge the verifier itself created), (3) a replay guard via an
 * injectable, caller-supplied nonce tracker.
 *
 * REPLAY GUARD IS PROCESS-LOCAL AND BEST-EFFORT. `createInMemoryFedosTrust
 * UsedNonceTracker()` keeps used nonces in an in-memory `Set` — it does NOT
 * persist across process restarts and does NOT share state across multiple
 * verifier processes/instances. This is intentional and consistent with this
 * arc's "no mandatory FedOS server" principle (there is no central service
 * this module may assume exists to coordinate replay state). A verifier that
 * needs durable, cross-process, or cross-instance replay protection (e.g. a
 * multi-node service, or single-process protection across restarts) MUST
 * supply its own `FedosTrustUsedNonceTracker` backed by durable storage —
 * the tracker is an injected dependency (`options.nonceTracker`), never
 * hardcoded to the in-memory implementation.
 */

import {
  verifyFedosTrustEnvelopeV1,
  type FedosTrustClock,
  type FedosTrustSignedEnvelope,
  type FedosTrustVerifyFailureReason,
} from "../envelope/index.js";
import type { FedosTrustPolicy } from "../policy/index.js";
import {
  canonicalizeFedosTrustPossessionResponsePayloadV1,
  type FedosTrustPossessionResponsePayload,
} from "./fedos_trust_possession_response.js";
import type { FedosTrustPossessionChallenge } from "./fedos_trust_possession_challenge.js";

/** Injectable replay-guard dependency. See this file's header for the
 * durability caveat of the in-memory implementation below. */
export interface FedosTrustUsedNonceTracker {
  hasBeenUsed(nonce: string): boolean;
  markUsed(nonce: string): void;
}

/** Process-local, best-effort replay guard — see this file's header. Never
 * the only option: pass a durable implementation via
 * `options.nonceTracker` when that matters to your deployment. */
export function createInMemoryFedosTrustUsedNonceTracker(): FedosTrustUsedNonceTracker {
  const usedNonces = new Set<string>();
  return {
    hasBeenUsed(nonce) {
      return usedNonces.has(nonce);
    },
    markUsed(nonce) {
      usedNonces.add(nonce);
    },
  };
}

export type FedosTrustPossessionVerifyFailureReason =
  | FedosTrustVerifyFailureReason
  | "invalid-payload-shape"
  | "nonce-mismatch"
  | "audience-mismatch"
  | "nonce-already-used";

export type FedosTrustPossessionVerifyResult =
  | { readonly ok: true; readonly resolvedPublicKeyHex: string }
  | { readonly ok: false; readonly reason: FedosTrustPossessionVerifyFailureReason; readonly detail?: string };

export interface FedosTrustPossessionVerifyOptions {
  readonly clock?: FedosTrustClock;
  /** Omit to skip replay checking entirely (e.g. a verifier that only ever
   * checks a response once and discards it has no need for one). Supply
   * `createInMemoryFedosTrustUsedNonceTracker()` for simple single-process
   * use, or your own durable implementation otherwise. */
  readonly nonceTracker?: FedosTrustUsedNonceTracker;
}

export function verifyFedosTrustPossessionResponseV1(
  envelope: FedosTrustSignedEnvelope<FedosTrustPossessionResponsePayload>,
  challenge: FedosTrustPossessionChallenge,
  trustPolicy: FedosTrustPolicy,
  options: FedosTrustPossessionVerifyOptions = {},
): FedosTrustPossessionVerifyResult {
  let canonicalPayload: string;
  try {
    canonicalPayload = canonicalizeFedosTrustPossessionResponsePayloadV1(envelope.payload);
  } catch (error) {
    return { ok: false, reason: "invalid-payload-shape", detail: String(error) };
  }

  const envelopeResult = verifyFedosTrustEnvelopeV1(envelope, canonicalPayload, trustPolicy, {
    expectedType: "fedos.possession.v1",
    clock: options.clock,
  });
  if (!envelopeResult.ok) return envelopeResult;

  if (envelope.nonce === undefined || envelope.nonce !== challenge.nonce) {
    return { ok: false, reason: "nonce-mismatch", detail: "nonce" };
  }
  if (envelope.audience === undefined || envelope.audience !== challenge.audience) {
    return { ok: false, reason: "audience-mismatch", detail: "audience" };
  }

  const tracker = options.nonceTracker;
  if (tracker) {
    if (tracker.hasBeenUsed(envelope.nonce)) {
      return { ok: false, reason: "nonce-already-used", detail: envelope.nonce };
    }
    tracker.markUsed(envelope.nonce);
  }

  return { ok: true, resolvedPublicKeyHex: envelopeResult.resolvedPublicKeyHex };
}
