/**
 * Trust — offline issuer CLI core logic.
 *
 * `scripts/fedos_trust_issuer_cli.mjs` is a thin argv/env/file-I/O wrapper
 * around the functions in this module — every function here is PURE with
 * respect to process state (no `process.env`, no `process.argv`, no direct
 * file reads/writes; callers pass already-loaded bytes/strings in and get
 * data/strings back). This is what lets
 * `test/trust_issuer_cli.test.ts` exercise the CLI's real logic by
 * importing this module directly, without shelling out to the compiled
 * script or touching a real file/env var.
 *
 * SECRET-HANDLING DISCIPLINE (verified by `test/trust_issuer_cli.test.ts`):
 * every `format*Output` function in this module returns EXACTLY the string
 * the CLI prints to stdout for that subcommand — none of them include a raw
 * secret or its hex form. `generate-key`/`sign-entitlement`'s actual secret
 * bytes never appear in any of these functions' return values; only
 * `formatFedosTrustGenerateKeyStdout`'s own (public-key-only) output does.
 */

import type { FedosTrustClock, FedosTrustSignedEnvelope } from "../envelope/index.js";
import { defaultFedosTrustClock } from "../envelope/index.js";
import {
  createFedosTrustPolicy,
  type FedosTrustedIssuer,
  type FedosTrustPolicy,
} from "../policy/index.js";
import { generateFedosTrustIssuerKey, loadFedosTrustIssuerKeypair } from "./fedos_trust_issuer_keypair.js";
import {
  issueFedosSubscriptionEntitlement,
  verifyFedosSubscriptionEntitlement,
  verifyFedosTrustSubscriptionSigningRequest,
  isValidFedosTrustSubscriptionScope,
  type FedosSubscriptionEntitlement,
  type FedosTrustSubscriptionEntitlementVerifyResult,
  type SubscriptionSigningRequest,
} from "../entitlement/index.js";

const SECONDS_PER_DAY = 86_400;

// ---------------------------------------------------------------------------
// generate-key
// ---------------------------------------------------------------------------

export interface FedosTrustIssuerGenerateKeyResult {
  readonly secretKeyBytes: Uint8Array;
  readonly publicKeyHex: string;
}

/** Generates a fresh issuer key. Returns the raw secret bytes (the CLI
 * wrapper writes them to the operator's out-file and then zeroes this
 * buffer) alongside the public key. Never logs anything itself. */
export function runFedosTrustIssuerGenerateKey(): FedosTrustIssuerGenerateKeyResult {
  const generated = generateFedosTrustIssuerKey();
  return { secretKeyBytes: generated.secretKeyBytes, publicKeyHex: generated.publicKeyHex };
}

/** The exact string `generate-key` prints to stdout — the public key hex,
 * and NOTHING else. */
export function formatFedosTrustGenerateKeyStdout(publicKeyHex: string): string {
  return publicKeyHex;
}

// ---------------------------------------------------------------------------
// inspect-key
// ---------------------------------------------------------------------------

export interface FedosTrustIssuerIdentity {
  readonly publicKeyHex: string;
  /** This CLI's fixed convention: an issuer key's `keyId` is its own public
   * key hex (simple, collision-free, requires no separate key registry on
   * the issuer side). A verifier's `FedosTrustPolicy` is free to map a
   * DIFFERENT `keyId` convention if it wants to (see `../policy/`) — this is
   * only what THIS CLI emits when it signs. */
  readonly keyId: string;
}

/** Derives the issuer's public identity from its raw secret bytes. Contains
 * no secret material in its return value. */
export function computeFedosTrustIssuerIdentity(secretKeyBytes: Uint8Array): FedosTrustIssuerIdentity {
  const keypair = loadFedosTrustIssuerKeypair(secretKeyBytes);
  return { publicKeyHex: keypair.publicKeyHex, keyId: keypair.publicKeyHex };
}

/** The exact string `inspect-key` prints to stdout — public key hex and
 * keyId only, never the secret. */
export function formatFedosTrustInspectKeyStdout(identity: FedosTrustIssuerIdentity): string {
  return `publicKeyHex: ${identity.publicKeyHex}\nkeyId: ${identity.keyId}`;
}

// ---------------------------------------------------------------------------
// sign-entitlement
// ---------------------------------------------------------------------------

export type FedosTrustIssuerSignEntitlementResult =
  | { readonly ok: true; readonly entitlement: FedosTrustSignedEnvelope<FedosSubscriptionEntitlement> }
  | { readonly ok: false; readonly reason: string; readonly detail?: string };

/** Splits a comma-separated scopes argument into a trimmed, non-empty list. */
export function parseFedosTrustScopesCsv(scopesCsv: string): readonly string[] {
  return scopesCsv
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
}

/**
 * Core logic for `sign-entitlement`: verifies the subject's own
 * self-signature on `requestEnvelope` (proof of possession, §31) BEFORE
 * issuing anything, then issues+signs a new `FedosSubscriptionEntitlement`
 * envelope using the issuer's key. Never logs; the issuer's raw secret
 * bytes never appear anywhere in the returned result (the result contains
 * only the signed, public entitlement envelope).
 */
export function runFedosTrustIssuerSignEntitlement(
  requestEnvelope: FedosTrustSignedEnvelope,
  planId: string,
  scopesCsv: string,
  validDays: number,
  issuerSecretKeyBytes: Uint8Array,
  issuerId: string,
  clock: FedosTrustClock = defaultFedosTrustClock,
): FedosTrustIssuerSignEntitlementResult {
  const requestVerifyResult = verifyFedosTrustSubscriptionSigningRequest(requestEnvelope);
  if (!requestVerifyResult.ok) {
    return {
      ok: false,
      reason: `subscription signing request failed verification (proof of possession): ${requestVerifyResult.reason}`,
      detail: requestVerifyResult.detail,
    };
  }
  const request: SubscriptionSigningRequest = requestVerifyResult.payload;

  const scopes = parseFedosTrustScopesCsv(scopesCsv);
  if (scopes.length === 0) {
    return { ok: false, reason: "no scopes supplied" };
  }
  for (const scope of scopes) {
    if (!isValidFedosTrustSubscriptionScope(scope)) {
      return { ok: false, reason: `"${scope}" is not a recognized scope` };
    }
    if (!request.requestedScopes.includes(scope)) {
      return { ok: false, reason: `scope "${scope}" was not requested by the subject` };
    }
  }

  if (!Number.isInteger(validDays) || validDays <= 0) {
    return { ok: false, reason: "valid-days must be a positive integer" };
  }

  const issuerKeypair = loadFedosTrustIssuerKeypair(issuerSecretKeyBytes);
  const keyId = issuerKeypair.publicKeyHex;
  const validFrom = clock();
  const validUntil = validFrom + validDays * SECONDS_PER_DAY;

  const entitlement = issueFedosSubscriptionEntitlement(
    request,
    planId,
    scopes,
    validFrom,
    validUntil,
    issuerKeypair,
    issuerId,
    keyId,
    clock,
  );
  return { ok: true, entitlement };
}

/** The exact string `sign-entitlement` prints to stdout on success — the
 * signed entitlement envelope as pretty-printed JSON. Contains no issuer
 * secret material (the envelope is entirely public: public keys, plan,
 * scopes, validity window, and a signature). */
export function formatFedosTrustSignEntitlementStdout(
  entitlement: FedosTrustSignedEnvelope<FedosSubscriptionEntitlement>,
): string {
  return JSON.stringify(entitlement, null, 2);
}

// ---------------------------------------------------------------------------
// verify-entitlement
// ---------------------------------------------------------------------------

export interface FedosTrustPolicyFileShape {
  readonly trustedIssuers: readonly FedosTrustedIssuer[];
}

/** Parses a JSON trust-policy document of the shape `{ trustedIssuers: [...] }`
 * (matching `FedosTrustedIssuer[]` verbatim) into a `FedosTrustPolicy`. Throws
 * on malformed input — the CLI wrapper is responsible for reporting that. */
export function parseFedosTrustPolicyFromParsedJson(parsed: unknown): FedosTrustPolicy {
  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as FedosTrustPolicyFileShape).trustedIssuers)) {
    throw new RangeError('fedos trust issuer cli: trust policy file must be an object with a "trustedIssuers" array');
  }
  return createFedosTrustPolicy((parsed as FedosTrustPolicyFileShape).trustedIssuers);
}

/** Core logic for `verify-entitlement`. */
export function runFedosTrustIssuerVerifyEntitlement(
  entitlementEnvelope: FedosTrustSignedEnvelope,
  trustPolicy: FedosTrustPolicy,
  clock: FedosTrustClock = defaultFedosTrustClock,
): FedosTrustSubscriptionEntitlementVerifyResult {
  return verifyFedosSubscriptionEntitlement(entitlementEnvelope, trustPolicy, { clock });
}

/** The exact string `verify-entitlement` prints to stdout — the status
 * literal, plus a detail suffix when present. */
export function formatFedosTrustVerifyEntitlementStdout(result: FedosTrustSubscriptionEntitlementVerifyResult): string {
  if (result.status === "VALID") return "VALID";
  return result.detail !== undefined ? `${result.status}: ${result.detail}` : result.status;
}
