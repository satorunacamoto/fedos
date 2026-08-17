/**
 * Secure Runtime Alpha 3161–3240 ("Account-to-Device Signature Verification
 * Boundary") — Phase G/H: the Real Device Registration Authority.
 *
 * The ONE orchestrator that ties Phase D (account authorization),
 * Phase E (device proof of possession), Phase F (replay/expiry), and the
 * EXISTING Alpha 2921–3000 Device Registry
 * (`PersistedFedosDeviceTrustAuthority`, `../persistence/persisted_fedos_device_trust_authority.ts`)
 * together into one production, cryptographically-gated registration and
 * revocation path.
 *
 * This class owns its OWN, private `PersistedFedosDeviceTrustAuthority`
 * instance, constructed internally with `AlreadyVerifiedFedosDeviceRegistrationAuthority`
 * (`./fedos_already_verified_device_registration_authority.ts`) — never
 * exposed to any caller, never constructed anywhere else with that
 * authority. Every call into it is preceded, in this same file, by a REAL
 * check of both required signatures for the exact request in hand;
 * "verified" here is not a default, it is a fact this file itself just
 * established.
 *
 * Account authorization ALONE can never register an arbitrary unowned
 * Device key — the Device proof is independently re-verified here, never
 * skipped, regardless of what the account already authorized. Device
 * proof ALONE can never self-authorize an account — the account
 * authorization is independently re-verified here too. Both checks run
 * unconditionally on every call.
 *
 * Revocation (Phase H) requires ONLY the account's own authorization
 * (a lost/stolen/compromised Device cannot be expected to cooperate in
 * revoking itself) — but is bound to the EXACT target binding via both
 * `deviceId` and `devicePublicKeyHex`, uses the separate `"revoke-device"`
 * action/domain-content, and can never reinstate a Device: `revokeDevice()`
 * only ever calls `PersistedFedosDeviceTrustAuthority.revokeDevice()`,
 * whose own transition table (`../fedos_device_binding.ts`) has no
 * outgoing edge from `"revoked"`. SECURITY FIX (FedOS red-team P0
 * closure): on a FRESH revocation, `revokeDevice()` now also calls the
 * optional `ratchetSessionQuarantine` dependency (see the constructor's
 * own doc comment) — this is the single choke point every production
 * revocation path in this codebase shares, so wiring the quarantine call
 * here (rather than in any one individual caller) closes the gap for all
 * of them at once.
 *
 * Replay (Phase F): every accepted or denied outcome is recorded, keyed by
 * the challenge's own `nonce`, via the injected
 * `FedosDeviceBindingChallengeReplayPersistence`. A second call with the
 * IDENTICAL challenge/action/device/account content is idempotent — it
 * replays the SAME recorded outcome without re-touching the Registry. A
 * second call reusing the same `nonce` with ANY different content is
 * refused as `"replayed"`, never silently overwritten. This is a
 * single-writer, in-process guard (Node's own single-threaded execution
 * model) — it makes no distributed exactly-once claim.
 */

import {
  FEDOS_DEVICE_BINDING_DOMAIN_V1,
  isWellFormedFedosDeviceBindingChallengeV1,
  serializeFedosDeviceBindingChallengeV1,
  type FedosDeviceBindingChallengeV1,
} from "./fedos_device_binding_challenge.js";
import {
  verifyFedosDeviceBindingAccountAuthorization,
  type FedosDeviceBindingAccountAuthorizationV1,
} from "./fedos_device_binding_account_authorization.js";
import {
  verifyFedosDeviceBindingProofOfPossession,
  type FedosDeviceBindingProofOfPossessionV1,
} from "./fedos_device_binding_proof_of_possession.js";
import { AlreadyVerifiedFedosDeviceRegistrationAuthority } from "./fedos_already_verified_device_registration_authority.js";
import { PersistedFedosDeviceTrustAuthority } from "../persistence/persisted_fedos_device_trust_authority.js";
import type { FedosDeviceRegistryPersistence } from "../persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceBindingChallengeReplayPersistence } from "../persistence/fedos_device_binding_challenge_replay_persistence.js";
import type { FedosPersistedDeviceBindingChallengeConsumptionV1 } from "../persistence/fedos_persisted_device_binding_challenge_consumption_v1.js";
import type { FedosDeviceBindingV1 } from "../fedos_device_binding.js";

/**
 * The fixed `FedosDeviceBindingAccountRef.authority` this Arc's own
 * orchestrator writes. Every account this file ever authorizes is a real
 * Nostr account identity, produced ONLY from `event.pubkey` after a real
 * Schnorr signature check (`verifyFedosDeviceBindingAccountAuthorization()`)
 * — never a caller-supplied string.
 */
export const FEDOS_DEVICE_BINDING_NOSTR_ACCOUNT_AUTHORITY = "nostr";

export type FedosDeviceBindingRegistrationOutcome =
  | "registered-trusted"
  | "already-present"
  | "conflict"
  | "invalid-account-proof"
  | "invalid-device-proof"
  | "expired"
  | "replayed"
  | "revoked"
  | "unsupported"
  | "failed";

export interface FedosDeviceBindingRegistrationResult {
  readonly outcome: FedosDeviceBindingRegistrationOutcome;
  readonly binding: FedosDeviceBindingV1 | null;
}

export type FedosDeviceBindingRevocationOutcome =
  | "revoked"
  | "already-revoked"
  | "not-found"
  | "wrong-account"
  | "device-mismatch"
  | "invalid-account-proof"
  | "expired"
  | "replayed"
  | "unsupported"
  | "failed";

export interface FedosDeviceBindingRevocationResult {
  readonly outcome: FedosDeviceBindingRevocationOutcome;
  readonly binding: FedosDeviceBindingV1 | null;
}

type FedosDeviceBindingReplayCheck =
  | { readonly status: "fresh" }
  | { readonly status: "replayed" }
  | { readonly status: "idempotent"; readonly record: FedosPersistedDeviceBindingChallengeConsumptionV1 };

function contentFieldsMatch(
  a: FedosPersistedDeviceBindingChallengeConsumptionV1,
  b: {
    readonly domain: string;
    readonly action: string;
    readonly deviceId: string;
    readonly devicePublicKeyHex: string;
    readonly accountAuthority: string;
    readonly accountPublicIdentifier: string;
  },
): boolean {
  return (
    a.domain === b.domain &&
    a.action === b.action &&
    a.deviceId === b.deviceId &&
    a.devicePublicKeyHex === b.devicePublicKeyHex &&
    a.accountAuthority === b.accountAuthority &&
    a.accountPublicIdentifier === b.accountPublicIdentifier
  );
}

/**
 * SECURITY FIX (FedOS red-team P0 closure): duck-typed, minimal seam for
 * quarantining already-established Ratchet sessions bound to a just-
 * revoked Device. Mirrors
 * `FedosDirectRatchetConversationRuntime.applyDeviceRevocationToSessions()`'s
 * own signature exactly (`../../conversations/ratchet/fedos_direct_ratchet_conversation_runtime.ts`)
 * but is intentionally NOT imported from that module here — this
 * "device"-domain file stays structurally decoupled from the
 * "conversations"/Ratchet domain (matching that Runtime's own documented
 * "no cross-subsystem event bus links Device Trust and the Ratchet
 * Runtime" boundary); a caller that owns both simply passes a real
 * `FedosDirectRatchetConversationRuntime` instance in, which already
 * satisfies this shape.
 */
export interface FedosDeviceBindingRatchetSessionQuarantine {
  applyDeviceRevocationToSessions(deviceId: string): readonly string[];
}

export class FedosDeviceBindingRegistrationAuthority {
  readonly #trustAuthority: PersistedFedosDeviceTrustAuthority;
  readonly #replayPersistence: FedosDeviceBindingChallengeReplayPersistence;
  readonly #ratchetSessionQuarantine: FedosDeviceBindingRatchetSessionQuarantine | null;

  constructor(deps: {
    registryPersistence: FedosDeviceRegistryPersistence;
    replayPersistence: FedosDeviceBindingChallengeReplayPersistence;
    /**
     * SECURITY FIX (FedOS red-team P0 closure): optional -- `undefined`
     * preserves this class's exact prior behavior for every existing
     * caller/test (no cross-subsystem coupling forced on anyone who does
     * not need it). When supplied, `revokeDevice()` calls
     * `applyDeviceRevocationToSessions(deviceId)` on it immediately after
     * a device is FRESHLY revoked (never on an idempotent
     * `"already-revoked"` replay), closing the gap where
     * `FedosDirectRatchetConversationRuntime.applyDeviceRevocationToSessions()`
     * existed, was unit-tested, but had ZERO production callers -- this is
     * the single choke point EVERY production revocation path in this
     * codebase already funnels through (`FedosDeviceSyncRuntime.revokeDevice()`,
     * `FedosDeviceReplacementCoordinator`, and
     * `FedosDevicePairingFacade.revokeDevice()` all call this class's own
     * `revokeDevice()` -- see this file's own header, "the ONE orchestrator").
     * Never destroys historical decryptability -- only quarantines
     * (blocks further use of) sessions tied to the revoked device, per
     * `applyDeviceRevocationToSessions()`'s own contract.
     */
    ratchetSessionQuarantine?: FedosDeviceBindingRatchetSessionQuarantine;
  }) {
    this.#trustAuthority = new PersistedFedosDeviceTrustAuthority({
      persistence: deps.registryPersistence,
      registrationAuthority: new AlreadyVerifiedFedosDeviceRegistrationAuthority(),
    });
    this.#replayPersistence = deps.replayPersistence;
    this.#ratchetSessionQuarantine = deps.ratchetSessionQuarantine ?? null;
  }

  /**
   * Registers, and — in the same call — trust-confirms, a Device binding.
   * Requires BOTH a valid account authorization AND a valid Device proof
   * of possession over the SAME challenge (by exact canonical-serialization
   * equality, not merely a shared `nonce`); neither is sufficient alone.
   */
  async registerDevice(
    accountAuthorization: FedosDeviceBindingAccountAuthorizationV1,
    deviceProof: FedosDeviceBindingProofOfPossessionV1,
    now: number,
  ): Promise<FedosDeviceBindingRegistrationResult> {
    const challenge = accountAuthorization.challenge;
    if (!isWellFormedFedosDeviceBindingChallengeV1(challenge) || challenge.action !== "register-device") {
      return { outcome: "unsupported", binding: null };
    }
    if (
      !isWellFormedFedosDeviceBindingChallengeV1(deviceProof.challenge) ||
      serializeFedosDeviceBindingChallengeV1(deviceProof.challenge) !== serializeFedosDeviceBindingChallengeV1(challenge)
    ) {
      return { outcome: "unsupported", binding: null };
    }

    const accountVerification = await verifyFedosDeviceBindingAccountAuthorization(accountAuthorization, now);
    const deviceOutcome = verifyFedosDeviceBindingProofOfPossession(deviceProof, now);

    if (accountVerification.outcome === "expired" || deviceOutcome === "expired") {
      return { outcome: "expired", binding: null };
    }
    if (accountVerification.outcome !== "valid") {
      return { outcome: "invalid-account-proof", binding: null };
    }
    if (deviceOutcome !== "valid") {
      return { outcome: "invalid-device-proof", binding: null };
    }

    const accountPublicKeyHex = accountVerification.accountPublicKeyHex;
    if (accountPublicKeyHex === null) {
      return { outcome: "failed", binding: null };
    }

    const replayCheck = this.#checkReplay(challenge, accountPublicKeyHex);
    if (replayCheck.status === "replayed") {
      return { outcome: "replayed", binding: null };
    }
    if (replayCheck.status === "idempotent") {
      return {
        outcome: replayCheck.record.outcomeSummary as FedosDeviceBindingRegistrationOutcome,
        binding: this.#trustAuthority.getBinding(challenge.deviceId),
      };
    }

    const result = this.#performRegistration(challenge, accountPublicKeyHex, now);
    this.#recordConsumption(challenge, accountPublicKeyHex, now, result.outcome);
    return result;
  }

  /**
   * Revokes an EXISTING Device binding, authorized by the account alone
   * (no Device cooperation required or possible). Bound to the exact
   * target via `deviceId` AND `devicePublicKeyHex`. Terminal: a revoked
   * binding can never be reinstated through this or any other method in
   * this file.
   */
  async revokeDevice(
    accountAuthorization: FedosDeviceBindingAccountAuthorizationV1,
    now: number,
  ): Promise<FedosDeviceBindingRevocationResult> {
    const challenge = accountAuthorization.challenge;
    if (!isWellFormedFedosDeviceBindingChallengeV1(challenge) || challenge.action !== "revoke-device") {
      return { outcome: "unsupported", binding: null };
    }

    const accountVerification = await verifyFedosDeviceBindingAccountAuthorization(accountAuthorization, now);
    if (accountVerification.outcome === "expired") {
      return { outcome: "expired", binding: null };
    }
    if (accountVerification.outcome !== "valid") {
      return { outcome: "invalid-account-proof", binding: null };
    }

    const accountPublicKeyHex = accountVerification.accountPublicKeyHex;
    if (accountPublicKeyHex === null) {
      return { outcome: "failed", binding: null };
    }

    const replayCheck = this.#checkReplay(challenge, accountPublicKeyHex);
    if (replayCheck.status === "replayed") {
      return { outcome: "replayed", binding: null };
    }
    if (replayCheck.status === "idempotent") {
      return {
        outcome: replayCheck.record.outcomeSummary as FedosDeviceBindingRevocationOutcome,
        binding: this.#trustAuthority.getBinding(challenge.deviceId),
      };
    }

    const result = this.#performRevocation(challenge, accountPublicKeyHex, now);
    this.#recordConsumption(challenge, accountPublicKeyHex, now, result.outcome);
    return result;
  }

  getBinding(deviceId: string): FedosDeviceBindingV1 | null {
    return this.#trustAuthority.getBinding(deviceId);
  }

  #checkReplay(challenge: FedosDeviceBindingChallengeV1, accountPublicKeyHex: string): FedosDeviceBindingReplayCheck {
    const existing = this.#replayPersistence.getConsumption(challenge.nonce);
    if (existing === null) return { status: "fresh" };
    const matches = contentFieldsMatch(existing, {
      domain: challenge.domain,
      action: challenge.action,
      deviceId: challenge.deviceId,
      devicePublicKeyHex: challenge.devicePublicKeyHex,
      accountAuthority: FEDOS_DEVICE_BINDING_NOSTR_ACCOUNT_AUTHORITY,
      accountPublicIdentifier: accountPublicKeyHex,
    });
    return matches ? { status: "idempotent", record: existing } : { status: "replayed" };
  }

  #recordConsumption(challenge: FedosDeviceBindingChallengeV1, accountPublicKeyHex: string, now: number, outcomeSummary: string): void {
    this.#replayPersistence.putConsumption({
      schemaVersion: 1,
      nonce: challenge.nonce,
      domain: challenge.domain,
      action: challenge.action,
      deviceId: challenge.deviceId,
      devicePublicKeyHex: challenge.devicePublicKeyHex,
      accountAuthority: FEDOS_DEVICE_BINDING_NOSTR_ACCOUNT_AUTHORITY,
      accountPublicIdentifier: accountPublicKeyHex,
      consumedAt: now,
      outcomeSummary,
    });
  }

  #performRegistration(
    challenge: FedosDeviceBindingChallengeV1,
    accountPublicKeyHex: string,
    now: number,
  ): FedosDeviceBindingRegistrationResult {
    const accountRef = {
      authority: FEDOS_DEVICE_BINDING_NOSTR_ACCOUNT_AUTHORITY,
      publicIdentifier: accountPublicKeyHex,
      identityId: null,
    };
    const registration = this.#trustAuthority.registerDevice(
      { deviceId: challenge.deviceId, accountRef, devicePublicKeyRef: challenge.devicePublicKeyHex, label: null },
      now,
    );

    if (registration.outcome === "conflict") return { outcome: "conflict", binding: registration.binding };
    if (registration.outcome === "revoked") return { outcome: "revoked", binding: registration.binding };
    if (registration.outcome === "invalid-request" || registration.outcome === "denied" || registration.outcome === "unavailable") {
      return { outcome: "failed", binding: registration.binding };
    }

    if (registration.outcome === "already-registered") {
      if (registration.binding?.trustState === "trusted") {
        return { outcome: "already-present", binding: registration.binding };
      }
      if (registration.binding?.trustState !== "pending") {
        // A binding already exists in a state this Arc names no upgrade path for
        // (e.g. "unavailable", created by the Alpha 2921-3000 legacy adapter before
        // this Arc's real verification boundary existed). This Arc does not implement
        // upgrading it in place -- a genuinely-owned device re-registers under a NEW
        // deviceId, matching this Arc's own "revoked/unavailable ids are not reused"
        // model. Documented limitation, not a silent failure.
        return { outcome: "unsupported", binding: registration.binding };
      }
      // else: an already-"pending" binding for this exact deviceId+account -- fall
      // through to confirmTrust() below, now that this call has real verification.
    }

    const confirmation = this.#trustAuthority.confirmTrust(challenge.deviceId, now);
    if (confirmation.outcome !== "trusted") {
      return { outcome: "failed", binding: confirmation.binding };
    }
    return { outcome: "registered-trusted", binding: confirmation.binding };
  }

  #performRevocation(
    challenge: FedosDeviceBindingChallengeV1,
    accountPublicKeyHex: string,
    now: number,
  ): FedosDeviceBindingRevocationResult {
    const binding = this.#trustAuthority.getBinding(challenge.deviceId);
    if (binding === null) {
      return { outcome: "not-found", binding: null };
    }
    if (binding.accountRef.authority !== FEDOS_DEVICE_BINDING_NOSTR_ACCOUNT_AUTHORITY || binding.accountRef.publicIdentifier !== accountPublicKeyHex) {
      return { outcome: "wrong-account", binding: null };
    }
    if (binding.trustState === "revoked") {
      return { outcome: "already-revoked", binding };
    }
    if (binding.devicePublicKeyRef !== null && binding.devicePublicKeyRef !== challenge.devicePublicKeyHex) {
      return { outcome: "device-mismatch", binding: null };
    }

    const revocation = this.#trustAuthority.revokeDevice(challenge.deviceId, now);
    if (revocation.outcome !== "revoked") {
      return { outcome: "failed", binding: revocation.binding };
    }
    // SECURITY FIX (FedOS red-team P0 closure): quarantine any already-
    // established Ratchet sessions bound to this Device -- only on a
    // FRESH revocation (never on the "already-revoked" idempotent-replay
    // path above, which returns before reaching here). Best-effort/no-op
    // when no `ratchetSessionQuarantine` was configured (see constructor).
    this.#ratchetSessionQuarantine?.applyDeviceRevocationToSessions(challenge.deviceId);
    return { outcome: "revoked", binding: revocation.binding };
  }
}

export { FEDOS_DEVICE_BINDING_DOMAIN_V1 };
