/**
 * Secure Runtime Alpha 2921–3000 ("Device Trust and Multi-Device Runtime
 * Integration") — Persisted Device Trust Authority (Phases D+E+I).
 *
 * The one orchestrator this Arc's Runtime accessor
 * (`../../desktop/runtime/fedos_device_trust_runtime.ts`, Phase F) holds:
 * combines a `FedosDeviceRegistryPersistence` (Phase D) with an injected
 * `FedosDeviceRegistrationAuthority` (Phase E) to implement registration,
 * trust confirmation, and revocation as the three, and only three,
 * mutating operations over a Device Binding — mirrors
 * `../../conversation/capability/persistence/persisted_fedos_conversation_capability_authority.ts`'s
 * own "durable backend behind a frozen-shape orchestrator" discipline.
 *
 * `registerDevice()`'s own dedup/conflict rule mirrors
 * `../../sync/fedos_sync_device_registry.ts`'s existing, already-shipped
 * invariant (Alpha 2421–2500): a `deviceId` belongs to at most one
 * account at a time. Re-registering the SAME device under the SAME
 * account is idempotent; re-registering it under a DIFFERENT account, or
 * re-registering a `"revoked"` device id at all, is refused
 * (`"conflict"`/`"revoked"`) without mutating anything — "revoked is
 * terminal unless an accepted re-registration model creates a NEW
 * Device Binding" (Phase C), and this Arc names no such model, so a
 * revoked `deviceId` can never be reused.
 */

import {
  fedosDeviceBindingAccountRefsEqual,
  type FedosDeviceBindingAccountRef,
  type FedosDeviceBindingV1,
} from "../../../../device/fedos_device_binding.js";
import type {
  FedosDeviceRegistrationAuthority,
  FedosDeviceRegistrationRequest,
} from "../../../../device/fedos_device_registration_authority.js";
import type { FedosDeviceRegistryPersistence } from "../../../../device/persistence/fedos_device_registry_persistence.js";

export type FedosDeviceRegistrationOutcome =
  | "registered"
  | "already-registered"
  | "conflict"
  | "revoked"
  | "denied"
  | "invalid-request"
  | "unavailable";

export interface FedosDeviceRegistrationResult {
  readonly outcome: FedosDeviceRegistrationOutcome;
  readonly binding: FedosDeviceBindingV1 | null;
}

export type FedosDeviceTrustConfirmationOutcome = "trusted" | "not-found" | "invalid-transition" | "denied" | "unavailable";

export interface FedosDeviceTrustConfirmationResult {
  readonly outcome: FedosDeviceTrustConfirmationOutcome;
  readonly binding: FedosDeviceBindingV1 | null;
}

export type FedosDeviceRevocationOutcome = "revoked" | "already-revoked" | "not-found" | "unavailable";

export interface FedosDeviceRevocationResult {
  readonly outcome: FedosDeviceRevocationOutcome;
  readonly binding: FedosDeviceBindingV1 | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidAccountRef(value: FedosDeviceBindingAccountRef): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    isNonEmptyString(value.authority) &&
    isNonEmptyString(value.publicIdentifier) &&
    (value.identityId === null || isNonEmptyString(value.identityId))
  );
}

export class PersistedFedosDeviceTrustAuthority {
  readonly #persistence: FedosDeviceRegistryPersistence;
  readonly #registrationAuthority: FedosDeviceRegistrationAuthority;

  constructor(deps: { persistence: FedosDeviceRegistryPersistence; registrationAuthority: FedosDeviceRegistrationAuthority }) {
    this.#persistence = deps.persistence;
    this.#registrationAuthority = deps.registrationAuthority;
  }

  registerDevice(request: FedosDeviceRegistrationRequest, now: number): FedosDeviceRegistrationResult {
    if (!isNonEmptyString(request.deviceId) || !isValidAccountRef(request.accountRef)) {
      return { outcome: "invalid-request", binding: null };
    }

    const existing = this.#persistence.getBinding(request.deviceId);
    if (existing !== null) {
      if (existing.trustState === "revoked") return { outcome: "revoked", binding: existing };
      if (!fedosDeviceBindingAccountRefsEqual(existing.accountRef, request.accountRef)) {
        return { outcome: "conflict", binding: existing };
      }
      return { outcome: "already-registered", binding: existing };
    }

    const decision = this.#registrationAuthority.authorizeRegistration(request, now);
    if (!decision.allowed) return { outcome: "denied", binding: null };

    const event =
      decision.capability === "verified"
        ? ({
            schemaVersion: 1 as const,
            eventType: "registered" as const,
            deviceId: request.deviceId,
            accountAuthority: request.accountRef.authority,
            accountPublicIdentifier: request.accountRef.publicIdentifier,
            accountIdentityId: request.accountRef.identityId,
            devicePublicKeyRef: request.devicePublicKeyRef,
            label: request.label,
            initialTrustState: "pending" as const,
            registeredAt: now,
          })
        : ({
            schemaVersion: 1 as const,
            eventType: "registered" as const,
            deviceId: request.deviceId,
            accountAuthority: request.accountRef.authority,
            accountPublicIdentifier: request.accountRef.publicIdentifier,
            accountIdentityId: request.accountRef.identityId,
            // Phase E's own guarantee: an unverified registration never
            // records a key reference, regardless of what the request supplied.
            devicePublicKeyRef: null,
            label: request.label,
            initialTrustState: "unavailable" as const,
            registeredAt: now,
          });

    const writeResult = this.#persistence.putEvent(event);
    if (writeResult === "failed" || writeResult === "conflict") return { outcome: "unavailable", binding: null };

    const binding = this.#persistence.getBinding(request.deviceId);
    return { outcome: "registered", binding };
  }

  confirmTrust(deviceId: string, now: number): FedosDeviceTrustConfirmationResult {
    const binding = this.#persistence.getBinding(deviceId);
    if (binding === null) return { outcome: "not-found", binding: null };
    if (binding.trustState !== "pending") return { outcome: "invalid-transition", binding };

    const decision = this.#registrationAuthority.authorizeTrustConfirmation(binding, now);
    if (!decision.allowed) return { outcome: "denied", binding };

    const writeResult = this.#persistence.putEvent({
      schemaVersion: 1,
      eventType: "trusted",
      deviceId,
      trustedAt: now,
    });
    if (writeResult === "failed" || writeResult === "conflict") return { outcome: "unavailable", binding };

    return { outcome: "trusted", binding: this.#persistence.getBinding(deviceId) };
  }

  revokeDevice(deviceId: string, now: number): FedosDeviceRevocationResult {
    const binding = this.#persistence.getBinding(deviceId);
    if (binding === null) return { outcome: "not-found", binding: null };
    if (binding.trustState === "revoked") return { outcome: "already-revoked", binding };

    const writeResult = this.#persistence.putEvent({
      schemaVersion: 1,
      eventType: "revoked",
      deviceId,
      revokedAt: now,
    });
    if (writeResult === "failed" || writeResult === "conflict") return { outcome: "unavailable", binding };

    return { outcome: "revoked", binding: this.#persistence.getBinding(deviceId) };
  }

  getBinding(deviceId: string): FedosDeviceBindingV1 | null {
    return this.#persistence.getBinding(deviceId);
  }

  listBindingsForAccount(accountRef: FedosDeviceBindingAccountRef): readonly FedosDeviceBindingV1[] {
    return this.#persistence.listBindingsForAccount(accountRef.authority, accountRef.publicIdentifier);
  }

  listTrustedBindingsForAccount(accountRef: FedosDeviceBindingAccountRef): readonly FedosDeviceBindingV1[] {
    return this.listBindingsForAccount(accountRef).filter((binding) => binding.trustState === "trusted");
  }

  isDeviceTrusted(deviceId: string): boolean {
    return this.#persistence.getBinding(deviceId)?.trustState === "trusted";
  }
}
