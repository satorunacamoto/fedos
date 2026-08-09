/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — Device Replacement, formalized as ONE explicit,
 * named application-level flow (review §19's own item 4: "reducing the
 * chance of a caller forgetting the revocation half").
 *
 * Composes the EXISTING, unmodified
 * `FedosDeviceBindingRegistrationAuthority` (`./binding_challenge/fedos_device_binding_registration_authority.ts`,
 * Alpha 3161–3240) — never re-implements registration or revocation, and
 * owns NO cryptographic signing capability of its own: every signature
 * this flow consumes (`newDeviceAccountAuthorization`/`newDeviceProof`/
 * `oldDeviceAccountAuthorization`) is produced ONE LAYER UP by a real
 * account signing authority + a real `FedosDeviceSigningKeypair` — this
 * file never touches Electron, a host bridge, or a UI of any kind
 * (matches this Arc's own explicit non-goals).
 *
 * Review §07's own chosen model, enforced structurally here: the
 * replacement Device is ALWAYS registered as a brand-new Device identity
 * (its own fresh `newDeviceAccountAuthorization`/`newDeviceProof` over a
 * NEW challenge) — this file has no path that reuses the old Device's
 * `deviceId` or key. `revokeDevice()` runs SECOND, only after the new
 * Device is durably registered+trusted, so a caller can never end up with
 * NEITHER Device usable; if revocation fails, the new Device remains
 * usable and the failure is returned, never silently swallowed (a
 * disclosed partial-failure state, not a hidden one).
 */
import {
  type FedosDeviceBindingRegistrationAuthority,
  type FedosDeviceBindingRegistrationOutcome,
  type FedosDeviceBindingRevocationOutcome,
} from "./binding_challenge/fedos_device_binding_registration_authority.js";
import type { FedosDeviceBindingAccountAuthorizationV1 } from "./binding_challenge/fedos_device_binding_account_authorization.js";
import type { FedosDeviceBindingProofOfPossessionV1 } from "./binding_challenge/fedos_device_binding_proof_of_possession.js";
import type { FedosDeviceBindingV1 } from "./fedos_device_binding.js";
import type { FedosDeviceReplacementPersistence } from "./persistence/fedos_device_replacement_persistence.js";
import type { FedosDeviceReplacementReason } from "./fedos_device_replacement_record.js";

export type FedosDeviceReplacementOutcome =
  | { readonly outcome: "replaced"; readonly newBinding: FedosDeviceBindingV1 }
  | { readonly outcome: "invalid-input"; readonly reason: string }
  | { readonly outcome: "already-replaced" }
  | { readonly outcome: "registration-failed"; readonly registrationOutcome: FedosDeviceBindingRegistrationOutcome }
  | {
      readonly outcome: "revocation-failed";
      readonly newBinding: FedosDeviceBindingV1;
      readonly revocationOutcome: FedosDeviceBindingRevocationOutcome;
    };

export interface FedosDeviceReplacementCoordinatorDependencies {
  readonly registrationAuthority: FedosDeviceBindingRegistrationAuthority;
  readonly replacementPersistence: FedosDeviceReplacementPersistence;
  readonly now?: () => number;
}

export class FedosDeviceReplacementCoordinator {
  readonly #deps: FedosDeviceReplacementCoordinatorDependencies;
  readonly #now: () => number;

  constructor(deps: FedosDeviceReplacementCoordinatorDependencies) {
    this.#deps = deps;
    this.#now = deps.now ?? (() => Date.now());
  }

  /**
   * Registers `newDeviceAccountAuthorization`/`newDeviceProof` as a
   * brand-new Device binding, then — ONLY on success — revokes
   * `oldDeviceId` via `oldDeviceAccountAuthorization`, then records the
   * informational replacement link (never a trust/inheritance grant —
   * see this file's own header). Idempotent: a second call naming the
   * SAME `oldDeviceId` after a replacement already exists is refused as
   * `"already-replaced"` without re-registering or re-revoking anything.
   */
  async replaceDevice(
    oldDeviceId: string,
    newDeviceAccountAuthorization: FedosDeviceBindingAccountAuthorizationV1,
    newDeviceProof: FedosDeviceBindingProofOfPossessionV1,
    oldDeviceAccountAuthorization: FedosDeviceBindingAccountAuthorizationV1,
    reason: FedosDeviceReplacementReason,
  ): Promise<FedosDeviceReplacementOutcome> {
    if (oldDeviceId.length === 0) return { outcome: "invalid-input", reason: "oldDeviceId must be a non-empty string" };
    if (oldDeviceAccountAuthorization.challenge.deviceId !== oldDeviceId) {
      return { outcome: "invalid-input", reason: "oldDeviceAccountAuthorization's challenge does not name oldDeviceId" };
    }
    if (newDeviceAccountAuthorization.challenge.deviceId !== newDeviceProof.challenge.deviceId) {
      return { outcome: "invalid-input", reason: "newDeviceAccountAuthorization and newDeviceProof name different Device ids" };
    }
    if (newDeviceProof.challenge.deviceId === oldDeviceId) {
      return { outcome: "invalid-input", reason: "a replacement Device must use a NEW deviceId, never the superseded one" };
    }
    if (this.#deps.replacementPersistence.getReplacementForOldDevice(oldDeviceId) !== null) {
      return { outcome: "already-replaced" };
    }

    const now = this.#now();
    const registration = await this.#deps.registrationAuthority.registerDevice(newDeviceAccountAuthorization, newDeviceProof, now);
    if (
      (registration.outcome !== "registered-trusted" && registration.outcome !== "already-present") ||
      registration.binding === null
    ) {
      return { outcome: "registration-failed", registrationOutcome: registration.outcome };
    }
    const newBinding = registration.binding;

    const revocation = await this.#deps.registrationAuthority.revokeDevice(oldDeviceAccountAuthorization, now);
    if (revocation.outcome !== "revoked" && revocation.outcome !== "already-revoked") {
      return { outcome: "revocation-failed", newBinding, revocationOutcome: revocation.outcome };
    }

    this.#deps.replacementPersistence.putReplacement({
      schemaVersion: 1,
      oldDeviceId,
      newDeviceId: newBinding.deviceId,
      accountAuthority: newBinding.accountRef.authority,
      accountPublicIdentifier: newBinding.accountRef.publicIdentifier,
      reason,
      recordedAt: now,
    });

    return { outcome: "replaced", newBinding };
  }
}
