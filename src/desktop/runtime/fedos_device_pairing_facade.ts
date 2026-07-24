/**
 * Secure Runtime Alpha 4581–4660 ("Desktop Device Registration, Pairing, and
 * Durable Sync Journal Arc") — Phase B: the Device Registration/Pairing
 * Application Facade.
 *
 * `FedosDevicePairingFacade` is the ONE narrow application-level boundary
 * this Arc introduces to close blocker #1 (Alpha 4501-4580's own finding,
 * reconfirmed in this Arc's own Phase A §11/§20): device registration and
 * pairing exist below the Shell boundary (Alpha 3161-3240's real,
 * cryptographically-verified `FedosDeviceBindingRegistrationAuthority`,
 * `../../device/binding_challenge/fedos_device_binding_registration_authority.ts`),
 * but were never reachable through the real Desktop application stack. This
 * file closes exactly that gap — it owns NO cryptographic implementation
 * (every signature is produced/verified by the EXISTING, unmodified Phase
 * D/E functions from that Arc) and NO independent trust truth (every
 * mutating call delegates to the EXISTING `FedosDeviceBindingBoundary`
 * — `../../device/binding_challenge/fedos_device_binding_boundary_factory.ts`
 * — and the EXISTING `FedosDeviceTrustRuntime`, `./fedos_device_trust_runtime.ts`
 * — this file constructs neither, only composes references the Desktop
 * Runtime already assembled, per Phase E).
 *
 * PROTOCOL SEMANTICS THIS FILE ACTUALLY IMPLEMENTS (Phase K — state exact
 * semantics, never claim more than the real crypto supports):
 *
 *   1. The JOINING Device (the one that generated a fresh, independent
 *      `FedosDeviceSigningKeypair`, `../../device/crypto/fedos_device_signing_keypair.ts`)
 *      calls `createPairingRequest()`. This mints a canonical challenge
 *      (`FedosDeviceBindingBoundary.mintChallenge()`) and immediately signs
 *      the Joining Device's OWN proof of possession over it — both PUBLIC
 *      facts, safely exported as a `FedosDevicePairingRequestV1`
 *      (`../../device/binding_challenge/fedos_device_binding_pairing_exchange.ts`,
 *      Phase C) via `encodeFedosDevicePairingRequestV1()`.
 *   2. The caller moves that bounded string to the AUTHORIZING Device (the
 *      one holding the account's own Nostr signing capability) by whatever
 *      out-of-band channel it likes (Phase D — this file assumes none).
 *   3. The Authorizing Device calls `inspectPairingRequest()` (safe,
 *      read-only — re-verifies the device proof, since that requires no
 *      secret) and then `approvePairingRequest()`, which re-verifies the
 *      device proof again (fail-closed, never trusts `inspect`'s own prior
 *      result blindly) and produces a real account authorization signature
 *      over the SAME challenge. Exports a `FedosDevicePairingApprovalV1`.
 *      **This same call ALSO immediately, locally records the identical
 *      binding into the AUTHORIZING Device's OWN local Device Registry**
 *      (see "LOCAL RECIPROCAL RECORDING" below) — informational only; it
 *      never blocks producing a valid approval for the Joining Device.
 *   4. The caller moves the approval string back to the Joining Device.
 *   5. The Joining Device calls `completePairing()`, which independently
 *      re-verifies the account authorization (rejecting one signed by an
 *      account OTHER than the one this pairing was created for — Phase M
 *      scenario 5, "wrong account request denied"), re-derives its OWN
 *      device proof fresh from the SAME long-lived keypair (never cached
 *      across this call — the private key itself is never durably stored
 *      by this file, matching the crypto file's own "process-memory-only"
 *      limitation), and calls the SAME `registerDevice()` the Authorizing
 *      Device's own local call used.
 *
 *   LOCAL RECIPROCAL RECORDING — an HONEST, NAMED limitation, not an
 *   oversight: this codebase has NO cross-machine Device Registry
 *   synchronization (Phase A §8/§19 — the Sync Journal carries only
 *   allow-listed Conversation-change records, never Device Registry facts;
 *   confirmed unchanged by this Arc). "Trust" recorded through this file is
 *   therefore always a LOCAL fact, written to whichever machine's own
 *   Device Registry persistence a `registerDevice()` call actually reaches.
 *   Step 3 above deliberately also writes the SAME verified binding into
 *   the Authorizing Device's OWN registry (a second, independent, purely
 *   LOCAL write — never a network call, never a claim about the Joining
 *   Device's own state) so BOTH machines' local Sync Scheduler/target
 *   planning can see the new Device without a human having to separately
 *   register it twice. This is NOT "bidirectional trust" in any
 *   cryptographic sense — it is two independent local writes of the
 *   identical, already-fully-verified binding fact.
 *
 * ABSOLUTE PROHIBITIONS this file honors directly: no second Device
 * Registry (every `registerDevice()`/`revokeDevice()`/`getBinding()` call
 * goes through the ONE `FedosDeviceBindingBoundary` the Desktop Runtime
 * constructed, Phase E); no second Device Trust Runtime; no raw private-key
 * getter (this file never reads `FedosDeviceSigningKeypair`'s internal
 * secret, only calls its public `sign()`/`publicKeyHex`); no generic
 * signing oracle (`approvePairingRequest()`/`revokeDevice()` sign EXACTLY
 * one fixed challenge shape each, never arbitrary caller content); no
 * secret in a pairing record (enforced one layer down by Phase C's own
 * exchange format); never silently marks a Device trusted (every mutating
 * call re-verifies both signatures fresh, every time); never restores a
 * revoked Device (the underlying Registry's own closed transition table
 * has no such edge).
 */

import type { FedosDeviceBindingAccountRef, FedosDeviceBindingV1, FedosDeviceTrustState } from "../../device/fedos_device_binding.js";
import type { FedosDeviceBindingBoundary } from "../../device/binding_challenge/fedos_device_binding_boundary_factory.js";
import type { FedosDeviceTrustRuntime } from "./fedos_device_trust_runtime.js";
import type { FedosDeviceSigningKeypair } from "../../device/crypto/fedos_device_signing_keypair.js";
import { createFedosDeviceBindingProofOfPossession, verifyFedosDeviceBindingProofOfPossession } from "../../device/binding_challenge/fedos_device_binding_proof_of_possession.js";
import { authorizeFedosDeviceBindingChallenge, verifyFedosDeviceBindingAccountAuthorization } from "../../device/binding_challenge/fedos_device_binding_account_authorization.js";
import type { FedosDeviceBindingRegistrationResult, FedosDeviceBindingRevocationResult } from "../../device/binding_challenge/fedos_device_binding_registration_authority.js";
import { FedosSecureRandomDeviceBindingChallengeNonceGenerator, type FedosDeviceBindingChallengeNonceGenerator } from "../../device/binding_challenge/fedos_device_binding_challenge.js";
import {
  decodeFedosDevicePairingApprovalV1,
  decodeFedosDevicePairingRequestV1,
  encodeFedosDevicePairingApprovalV1,
  encodeFedosDevicePairingRequestV1,
} from "../../device/binding_challenge/fedos_device_binding_pairing_exchange.js";
import type { FedosNostrSigningAuthority } from "../../nostr/sign/fedos_nostr_signing_authority.js";

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------
// Closed, coarse outcome vocabulary -- mirrors
// `FedosDeviceSyncOperationalResult<T>` (`./fedos_device_sync_operational_facade.ts`)
// exactly, extended with the pairing-specific closed states Phase M names.
// ---------------------------------------------------------------------

export type FedosDevicePairingOutcomeKind =
  | "disabled"
  | "unavailable"
  | "not-found"
  | "invalid-input"
  | "malformed"
  | "expired"
  | "replayed"
  | "revoked"
  | "wrong-account"
  | "conflict"
  | "failed";

export type FedosDevicePairingResult<T> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: Exclude<FedosDevicePairingOutcomeKind, "ok">; readonly reason: string };

function ok<T>(value: T): FedosDevicePairingResult<T> {
  return { outcome: "ok", value };
}
function fail<T>(outcome: Exclude<FedosDevicePairingOutcomeKind, "ok">, reason: string): FedosDevicePairingResult<T> {
  return { outcome, reason };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// ---------------------------------------------------------------------
// Safe view shapes -- no secret, no raw signature exposed as "identity",
// no raw Nostr wire event.
// ---------------------------------------------------------------------

export interface FedosDevicePairingBindingView {
  readonly deviceId: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly devicePublicKeyRef: string | null;
  readonly trustState: FedosDeviceTrustState;
  readonly createdAt: number;
  readonly revokedAt: number | null;
  /** Phase L -- whether this binding is CURRENTLY eligible as a Sync target on THIS local Runtime (trusted AND admitted into the local Sync fabric). Never implies the device is online or has actually synced. */
  readonly syncEligible: boolean;
}

export interface FedosDevicePairingRequestSummary {
  readonly pairingId: string;
  readonly deviceId: string;
  readonly devicePublicKeyHex: string;
  readonly expectedAccountAuthority: string;
  readonly expectedAccountPublicIdentifier: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface FedosDevicePairingRequestInspectionView {
  readonly pairingId: string;
  readonly deviceId: string;
  readonly devicePublicKeyHex: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly expired: boolean;
  /** `true` iff the embedded Device proof of possession is cryptographically valid RIGHT NOW -- a real, already-performed check, never a placeholder. */
  readonly deviceProofValid: boolean;
}

export interface FedosDevicePairingApprovalOutcomeView {
  readonly encoded: string;
  /** The coarse outcome of this SAME Authorizing Device's own local reciprocal recording (see this file's own header) -- informational only, never blocks the returned `encoded` approval. */
  readonly localRegistration: string;
}

function toBindingView(binding: FedosDeviceBindingV1, syncEligible: boolean): FedosDevicePairingBindingView {
  return Object.freeze({
    deviceId: binding.deviceId,
    accountAuthority: binding.accountRef.authority,
    accountPublicIdentifier: binding.accountRef.publicIdentifier,
    devicePublicKeyRef: binding.devicePublicKeyRef,
    trustState: binding.trustState,
    createdAt: binding.createdAt,
    revokedAt: binding.revokedAt,
    syncEligible,
  });
}

export interface FedosDevicePairingFacadeDeps {
  readonly bindingBoundary: FedosDeviceBindingBoundary;
  readonly deviceTrust: FedosDeviceTrustRuntime;
  /** `null` -- no account signing capability was configured on this Runtime (`config.deviceBindingAccountSigningAuthority` omitted); `approvePairingRequest()`/`revokeDevice()` report `"disabled"`. `createPairingRequest()`/`inspectPairingRequest()`/`completePairing()`/`registrationStatus()` need no account signing capability at all and remain fully available regardless. */
  readonly accountSigningAuthority: FedosNostrSigningAuthority | null;
  readonly accountIndex: number;
  readonly isRuntimeRunning: () => boolean;
  readonly now?: () => number;
  readonly pairingIdGenerator?: FedosDeviceBindingChallengeNonceGenerator;
}

export class FedosDevicePairingFacade {
  readonly #deps: FedosDevicePairingFacadeDeps;
  readonly #now: () => number;
  readonly #pairingIdGenerator: FedosDeviceBindingChallengeNonceGenerator;
  /** In-process bookkeeping ONLY (mirrors `FedosDeviceManagementNavigationState`'s own "explicitly NOT durable canonical data" discipline) -- the real trust truth is always re-read from the Registry via `registrationStatus()`; a lost entry here (e.g. process restart) never blocks re-`createPairingRequest()`-ing. */
  readonly #pendingByPairingId = new Map<string, FedosDevicePairingRequestSummary>();

  constructor(deps: FedosDevicePairingFacadeDeps) {
    this.#deps = deps;
    this.#now = deps.now ?? defaultNowSeconds;
    this.#pairingIdGenerator = deps.pairingIdGenerator ?? new FedosSecureRandomDeviceBindingChallengeNonceGenerator();
  }

  #checkRunning<T>(): FedosDevicePairingResult<T> | null {
    if (!this.#deps.isRuntimeRunning()) return fail("unavailable", "the owning Desktop Runtime has stopped");
    return null;
  }

  #syncEligible(deviceId: string): boolean {
    return this.#deps.deviceTrust.syncReadiness(deviceId).ready;
  }

  /** Best-effort: admits a newly-trusted Device into the local Sync fabric's target set (Phase L). Never itself starts the Scheduler; a `"not-trusted"`/`"conflict"` outcome here is not surfaced as a pairing failure -- trust itself already succeeded by the time this runs. */
  #admitIntoSyncFabricIfTrusted(deviceId: string, binding: FedosDeviceBindingV1 | null): void {
    if (binding !== null && binding.trustState === "trusted") {
      this.#deps.deviceTrust.registerSyncDevice(deviceId, this.#now());
    }
  }

  // ---------------------------------------------------------------------
  // Joining Device operations.
  // ---------------------------------------------------------------------

  /**
   * Generates a fresh challenge for `keypair`'s own public key and this
   * Device's own proof of possession over it, and returns the encoded,
   * bounded `FedosDevicePairingRequestV1` string ready for manual transfer
   * to the Authorizing Device. `expectedAccountRef` is remembered (Phase B
   * bookkeeping ONLY) so `completePairing()` can refuse an approval signed
   * by a DIFFERENT account (Phase M scenario 5).
   */
  createPairingRequest(deviceId: string, keypair: FedosDeviceSigningKeypair, expectedAccountRef: FedosDeviceBindingAccountRef): FedosDevicePairingResult<{ readonly pairingId: string; readonly encoded: string }> {
    const gate = this.#checkRunning<{ pairingId: string; encoded: string }>();
    if (gate !== null) return gate;
    if (!isNonEmptyString(deviceId)) return fail("invalid-input", "deviceId must be a non-empty string");
    if (!isNonEmptyString(expectedAccountRef?.authority) || !isNonEmptyString(expectedAccountRef?.publicIdentifier)) {
      return fail("invalid-input", "expectedAccountRef must carry a non-empty authority and publicIdentifier");
    }

    const challenge = this.#deps.bindingBoundary.mintChallenge("register-device", deviceId, keypair.publicKeyHex);
    const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, challenge);
    if (deviceProof === null) return fail("failed", "could not create a device proof of possession for the supplied keypair");

    const pairingId = this.#pairingIdGenerator.generateNonce();
    const encoded = encodeFedosDevicePairingRequestV1({ schemaVersion: 1, pairingId, challenge, deviceProof });
    if (encoded === null) return fail("failed", "failed to encode the pairing request");

    this.#pendingByPairingId.set(pairingId, {
      pairingId,
      deviceId,
      devicePublicKeyHex: keypair.publicKeyHex,
      expectedAccountAuthority: expectedAccountRef.authority,
      expectedAccountPublicIdentifier: expectedAccountRef.publicIdentifier,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
    });
    return ok({ pairingId, encoded });
  }

  /** Ephemeral, in-process bookkeeping only -- see this class's own header. Never the source of registration truth. */
  listPendingPairings(): FedosDevicePairingResult<readonly FedosDevicePairingRequestSummary[]> {
    const gate = this.#checkRunning<readonly FedosDevicePairingRequestSummary[]>();
    if (gate !== null) return gate;
    return ok(Object.freeze([...this.#pendingByPairingId.values()]));
  }

  /**
   * Completes registration on the Joining Device: re-derives this Device's
   * OWN proof of possession fresh from `keypair` (never cached across this
   * call), independently re-verifies the inbound account authorization
   * (refusing one signed by an account OTHER than `expectedAccountRef`
   * supplied to `createPairingRequest()`), then delegates to the SAME
   * `FedosDeviceBindingRegistrationAuthority.registerDevice()` the
   * Authorizing Device's own local approval step used.
   */
  async completePairing(pairingId: string, keypair: FedosDeviceSigningKeypair, encodedApproval: unknown): Promise<FedosDevicePairingResult<FedosDevicePairingBindingView>> {
    const gate = this.#checkRunning<FedosDevicePairingBindingView>();
    if (gate !== null) return gate;
    if (!isNonEmptyString(pairingId)) return fail("invalid-input", "pairingId must be a non-empty string");

    const pending = this.#pendingByPairingId.get(pairingId);
    if (pending === undefined) return fail("not-found", `no pending pairing request with id "${pairingId}" in this process`);

    const approval = decodeFedosDevicePairingApprovalV1(encodedApproval);
    if (approval === null) return fail("malformed", "malformed or oversized pairing approval record");
    if (approval.pairingId !== pairingId) return fail("invalid-input", "the approval's pairingId does not match");
    if (approval.challenge.deviceId !== pending.deviceId || approval.challenge.devicePublicKeyHex !== pending.devicePublicKeyHex) {
      return fail("invalid-input", "the approval's challenge does not match the pending pairing request");
    }
    if (keypair.publicKeyHex !== pending.devicePublicKeyHex) {
      return fail("invalid-input", "the supplied keypair does not match the device key this pairing request was created for");
    }

    const now = this.#now();
    const accountVerification = await verifyFedosDeviceBindingAccountAuthorization(approval.accountAuthorization, now);
    if (accountVerification.outcome === "expired") return fail("expired", "the account authorization has expired");
    if (accountVerification.outcome !== "valid" || accountVerification.accountPublicKeyHex === null) {
      return fail("invalid-input", `account authorization is not valid ("${accountVerification.outcome}")`);
    }
    if (accountVerification.accountPublicKeyHex !== pending.expectedAccountPublicIdentifier) {
      return fail("wrong-account", "the approval was signed by an account other than the one this pairing request was created for");
    }

    const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, approval.challenge);
    if (deviceProof === null) return fail("failed", "could not re-derive a device proof of possession for the supplied keypair");

    const result = await this.#deps.bindingBoundary.registrationAuthority.registerDevice(approval.accountAuthorization, deviceProof, now);
    // Consumed regardless of outcome -- a stale bookkeeping entry is never useful once its one approval has been submitted (a caller wanting to retry re-`createPairingRequest()`s, minting a fresh challenge/nonce, matching this Arc's own "revoked/consumed ids are not reused" precedent).
    this.#pendingByPairingId.delete(pairingId);
    return this.#mapRegistrationResult(pending.deviceId, result);
  }

  // ---------------------------------------------------------------------
  // Authorizing Device operations.
  // ---------------------------------------------------------------------

  /** Safe, read-only. Re-verifies the embedded Device proof of possession (no secret required) so an operator can see a real validity fact BEFORE ever deciding to approve. Never mutates anything. */
  inspectPairingRequest(encodedRequest: unknown): FedosDevicePairingResult<FedosDevicePairingRequestInspectionView> {
    const gate = this.#checkRunning<FedosDevicePairingRequestInspectionView>();
    if (gate !== null) return gate;
    const request = decodeFedosDevicePairingRequestV1(encodedRequest);
    if (request === null) return fail("malformed", "malformed or oversized pairing request record");

    const now = this.#now();
    const proofOutcome = verifyFedosDeviceBindingProofOfPossession(request.deviceProof, now);
    return ok(
      Object.freeze({
        pairingId: request.pairingId,
        deviceId: request.challenge.deviceId,
        devicePublicKeyHex: request.challenge.devicePublicKeyHex,
        issuedAt: request.challenge.issuedAt,
        expiresAt: request.challenge.expiresAt,
        expired: now > request.challenge.expiresAt,
        deviceProofValid: proofOutcome === "valid",
      }),
    );
  }

  /**
   * Re-verifies the Device proof (fail-closed; never trusts `inspectPairingRequest()`'s
   * own prior result), signs a real account authorization over the SAME
   * challenge, and — as an explicit, LOCAL, informational side effect —
   * also submits the identical binding to THIS Device's own local
   * `registerDevice()` (see this file's own header, "LOCAL RECIPROCAL
   * RECORDING"). Returns the encoded approval for manual transfer back to
   * the Joining Device regardless of the local reciprocal outcome.
   */
  async approvePairingRequest(encodedRequest: unknown): Promise<FedosDevicePairingResult<FedosDevicePairingApprovalOutcomeView>> {
    const gate = this.#checkRunning<FedosDevicePairingApprovalOutcomeView>();
    if (gate !== null) return gate;
    if (this.#deps.accountSigningAuthority === null) {
      return fail("disabled", "no account signing authority is configured on this Runtime -- see config.deviceBindingAccountSigningAuthority");
    }
    const request = decodeFedosDevicePairingRequestV1(encodedRequest);
    if (request === null) return fail("malformed", "malformed or oversized pairing request record");

    const now = this.#now();
    const proofOutcome = verifyFedosDeviceBindingProofOfPossession(request.deviceProof, now);
    if (proofOutcome === "expired") return fail("expired", "the pairing request has expired");
    if (proofOutcome !== "valid") return fail("invalid-input", `device proof of possession is not valid ("${proofOutcome}")`);

    const accountAuthorization = await authorizeFedosDeviceBindingChallenge(this.#deps.accountSigningAuthority, this.#deps.accountIndex, request.challenge);
    if (accountAuthorization === null) return fail("failed", "could not produce an account authorization for this challenge");

    const encoded = encodeFedosDevicePairingApprovalV1({ schemaVersion: 1, pairingId: request.pairingId, challenge: request.challenge, accountAuthorization });
    if (encoded === null) return fail("failed", "failed to encode the pairing approval");

    // LOCAL RECIPROCAL RECORDING -- see this file's own header. Informational
    // only: never turns a valid approval into a failure of THIS method.
    const localResult = await this.#deps.bindingBoundary.registrationAuthority.registerDevice(accountAuthorization, request.deviceProof, now);
    this.#admitIntoSyncFabricIfTrusted(request.challenge.deviceId, localResult.binding);

    return ok(Object.freeze({ encoded, localRegistration: localResult.outcome }));
  }

  /**
   * Revokes a Device binding by account authorization alone (no Device
   * cooperation required or possible) — mints a fresh `"revoke-device"`
   * challenge, signs it with this Runtime's own account signing authority,
   * and delegates to `FedosDeviceBindingRegistrationAuthority.revokeDevice()`.
   * Terminal on THIS Runtime's own local Registry; never erases already
   * delivered Sync history (Phase K).
   */
  async revokeDevice(deviceId: string, devicePublicKeyHex: string): Promise<FedosDevicePairingResult<FedosDevicePairingBindingView>> {
    const gate = this.#checkRunning<FedosDevicePairingBindingView>();
    if (gate !== null) return gate;
    if (this.#deps.accountSigningAuthority === null) {
      return fail("disabled", "no account signing authority is configured on this Runtime -- see config.deviceBindingAccountSigningAuthority");
    }
    if (!isNonEmptyString(deviceId)) return fail("invalid-input", "deviceId must be a non-empty string");
    if (!isNonEmptyString(devicePublicKeyHex)) return fail("invalid-input", "devicePublicKeyHex must be a non-empty string");

    const now = this.#now();
    const challenge = this.#deps.bindingBoundary.mintChallenge("revoke-device", deviceId, devicePublicKeyHex);
    const accountAuthorization = await authorizeFedosDeviceBindingChallenge(this.#deps.accountSigningAuthority, this.#deps.accountIndex, challenge);
    if (accountAuthorization === null) return fail("failed", "could not produce an account authorization for this revocation");

    const result = await this.#deps.bindingBoundary.registrationAuthority.revokeDevice(accountAuthorization, now);
    return this.#mapRevocationResult(deviceId, result);
  }

  // ---------------------------------------------------------------------
  // Shared status query.
  // ---------------------------------------------------------------------

  registrationStatus(deviceId: string): FedosDevicePairingResult<FedosDevicePairingBindingView> {
    const gate = this.#checkRunning<FedosDevicePairingBindingView>();
    if (gate !== null) return gate;
    if (!isNonEmptyString(deviceId)) return fail("invalid-input", "deviceId must be a non-empty string");
    const binding = this.#deps.bindingBoundary.registrationAuthority.getBinding(deviceId);
    if (binding === null) return fail("not-found", `no Device binding for "${deviceId}" on this local Registry`);
    return ok(toBindingView(binding, this.#syncEligible(deviceId)));
  }

  // ---------------------------------------------------------------------
  // Internal outcome mapping.
  // ---------------------------------------------------------------------

  #mapRegistrationResult(deviceId: string, result: FedosDeviceBindingRegistrationResult): FedosDevicePairingResult<FedosDevicePairingBindingView> {
    switch (result.outcome) {
      case "registered-trusted":
      case "already-present": {
        this.#admitIntoSyncFabricIfTrusted(deviceId, result.binding);
        return result.binding === null
          ? fail("failed", "registration reported success but no binding could be re-read")
          : ok(toBindingView(result.binding, this.#syncEligible(deviceId)));
      }
      case "conflict":
        return fail("conflict", "this Device id is already bound to a different account");
      case "invalid-account-proof":
        return fail("invalid-input", "account authorization is not valid");
      case "invalid-device-proof":
        return fail("invalid-input", "device proof of possession is not valid");
      case "expired":
        return fail("expired", "the challenge has expired");
      case "replayed":
        return fail("replayed", "this challenge nonce was already consumed by a different request");
      case "revoked":
        return fail("revoked", "this Device id was previously revoked and cannot be re-trusted");
      case "unsupported":
        return fail("invalid-input", "this registration request is not supported (mismatched challenge/action, or an existing binding with no upgrade path)");
      case "failed":
        return fail("failed", "registration failed");
    }
  }

  #mapRevocationResult(deviceId: string, result: FedosDeviceBindingRevocationResult): FedosDevicePairingResult<FedosDevicePairingBindingView> {
    switch (result.outcome) {
      case "revoked":
      case "already-revoked":
        return result.binding === null
          ? fail("failed", "revocation reported success but no binding could be re-read")
          : ok(toBindingView(result.binding, this.#syncEligible(deviceId)));
      case "not-found":
        return fail("not-found", `no Device binding for "${deviceId}" on this local Registry`);
      case "wrong-account":
        return fail("wrong-account", "this account is not the owner of the targeted Device binding");
      case "device-mismatch":
        return fail("invalid-input", "the supplied devicePublicKeyHex does not match this Device binding's own key");
      case "invalid-account-proof":
        return fail("invalid-input", "account authorization is not valid");
      case "expired":
        return fail("expired", "the challenge has expired");
      case "replayed":
        return fail("replayed", "this challenge nonce was already consumed by a different request");
      case "unsupported":
        return fail("invalid-input", "this revocation request is not supported");
      case "failed":
        return fail("failed", "revocation failed");
    }
  }
}
