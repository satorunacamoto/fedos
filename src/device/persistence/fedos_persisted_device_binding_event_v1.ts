/**
 * Secure Runtime Alpha 2921–3000 ("Device Trust and Multi-Device Runtime
 * Integration") — Persisted Device Binding Events V1 (Phase D).
 *
 * Event-sourced, mirroring `../../conversation/capability/persistence/fedos_persisted_conversation_capability_v1.ts`'s
 * own exact discipline (Alpha 836/837): a Device Binding's `trustState`
 * changes over time (`"pending"|"unavailable"` -> `"trusted"` ->
 * `"revoked"`), so an insert-only, one-record-per-id backend cannot
 * represent it; this file stores the three EVENTS
 * (`"registered"`/`"trusted"`/`"revoked"`) and
 * `./fedos_device_registry_persistence.ts` reconstructs the current view
 * on read — never a stored, independently-mutable `trustState` field.
 *
 * No private key, Master Seed, or passphrase field exists anywhere in
 * this file. `devicePublicKeyRef` is an OPAQUE reference only.
 */

export type FedosPersistedDeviceBindingEventTypeV1 = "registered" | "trusted" | "revoked";

export interface FedosPersistedDeviceBindingRegisteredEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "registered";
  readonly deviceId: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly accountIdentityId: string | null;
  readonly devicePublicKeyRef: string | null;
  readonly label: string | null;
  /** The only two states a `"registered"` event may set — mirrors `./fedos_device_binding.ts`'s own two creation producers. */
  readonly initialTrustState: "pending" | "unavailable";
  readonly registeredAt: number;
}

export interface FedosPersistedDeviceBindingTrustedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "trusted";
  readonly deviceId: string;
  readonly trustedAt: number;
}

export interface FedosPersistedDeviceBindingRevokedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "revoked";
  readonly deviceId: string;
  readonly revokedAt: number;
}

export type FedosPersistedDeviceBindingEventV1 =
  | FedosPersistedDeviceBindingRegisteredEventV1
  | FedosPersistedDeviceBindingTrustedEventV1
  | FedosPersistedDeviceBindingRevokedEventV1;

/** `"registered"` keyed by `deviceId` alone (exactly one registration fact per device id -- a conflicting SECOND registration under a different account is an orchestrator-level `"conflict"`, `./persisted_fedos_device_trust_authority.ts`, never a second raw event). `"trusted"`/`"revoked"` keyed by `deviceId`+`eventType` -- each fires at most once per binding. */
export function fedosDeviceBindingEventKey(event: FedosPersistedDeviceBindingEventV1): string {
  return `${event.deviceId}:${event.eventType}`;
}

/** Structural equality over every field of one event -- used to decide `"already-present"` vs `"conflict"` for a duplicate key. */
export function fedosPersistedDeviceBindingEventsAreEqual(
  a: FedosPersistedDeviceBindingEventV1,
  b: FedosPersistedDeviceBindingEventV1,
): boolean {
  if (a.eventType !== b.eventType) return false;
  if (a.eventType === "registered" && b.eventType === "registered") {
    return (
      a.schemaVersion === b.schemaVersion &&
      a.deviceId === b.deviceId &&
      a.accountAuthority === b.accountAuthority &&
      a.accountPublicIdentifier === b.accountPublicIdentifier &&
      a.accountIdentityId === b.accountIdentityId &&
      a.devicePublicKeyRef === b.devicePublicKeyRef &&
      a.label === b.label &&
      a.initialTrustState === b.initialTrustState &&
      a.registeredAt === b.registeredAt
    );
  }
  if (a.eventType === "trusted" && b.eventType === "trusted") {
    return a.schemaVersion === b.schemaVersion && a.deviceId === b.deviceId && a.trustedAt === b.trustedAt;
  }
  const revokedA = a as FedosPersistedDeviceBindingRevokedEventV1;
  const revokedB = b as FedosPersistedDeviceBindingRevokedEventV1;
  return revokedA.schemaVersion === revokedB.schemaVersion && revokedA.deviceId === revokedB.deviceId && revokedA.revokedAt === revokedB.revokedAt;
}
