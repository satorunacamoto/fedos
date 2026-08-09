/**
 * Secure Runtime Alpha 2921–3000 ("Device Trust and Multi-Device Runtime
 * Integration") — Device Registry Persistence Port (Phase D).
 *
 * Mirrors `../../conversation/capability/persistence/fedos_conversation_capability_persistence.ts`'s
 * own event-store-plus-reconstruct shape (Alpha 837) exactly, applied to
 * `../fedos_device_binding.ts` instead of Capability descriptors. A
 * DELIBERATELY SEPARATE port and file tree from both
 * `../../conversation/membership/persistence/` and
 * `../../conversation/persistence/` — Phase D's own explicit instruction
 * ("Do not merge Device persistence into Membership or Conversation
 * persistence").
 */

import {
  createPendingFedosDeviceBinding,
  createUnavailableFedosDeviceBinding,
  revokeFedosDeviceBinding,
  trustFedosDeviceBinding,
  type FedosDeviceBindingV1,
} from "../../../../device/fedos_device_binding.js";
import {
  fedosDeviceBindingEventKey,
  fedosPersistedDeviceBindingEventsAreEqual,
  type FedosPersistedDeviceBindingEventV1,
  type FedosPersistedDeviceBindingRegisteredEventV1,
} from "../../../../device/persistence/fedos_persisted_device_binding_event_v1.js";

/** Mirrors `FedosConversationCapabilityPersistenceWriteResult` exactly (Alpha 837). */
export type FedosDeviceRegistryPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDeviceRegistryPersistence {
  putEvent(event: FedosPersistedDeviceBindingEventV1): FedosDeviceRegistryPersistenceWriteResult;
  /** Resolves the CURRENT reconstructed binding for one device id -- `null` if no `"registered"` event exists. */
  getBinding(deviceId: string): FedosDeviceBindingV1 | null;
  listBindings(): readonly FedosDeviceBindingV1[];
  listBindingsForAccount(accountAuthority: string, accountPublicIdentifier: string): readonly FedosDeviceBindingV1[];
}

export { fedosDeviceBindingEventKey, fedosPersistedDeviceBindingEventsAreEqual };

/**
 * Reconstructs the current binding for one device id from every event
 * found for it, applied in append order. `null` if no `"registered"`
 * event exists yet. A `"trusted"`/`"revoked"` event applied against a
 * state that does not permit that transition is IGNORED (never applied,
 * never throws) -- this can only happen from a corrupt/tampered log,
 * since every writer of this port validates transitions before ever
 * calling `putEvent()` (`../persisted_fedos_device_trust_authority.ts`).
 */
export function reconstructFedosDeviceBindingRecord(
  eventsForDeviceId: readonly FedosPersistedDeviceBindingEventV1[],
): FedosDeviceBindingV1 | null {
  const registered = eventsForDeviceId.find(
    (event): event is FedosPersistedDeviceBindingRegisteredEventV1 => event.eventType === "registered",
  );
  if (registered === undefined) return null;

  let binding =
    registered.initialTrustState === "pending"
      ? createPendingFedosDeviceBinding({
          deviceId: registered.deviceId,
          accountRef: {
            authority: registered.accountAuthority,
            publicIdentifier: registered.accountPublicIdentifier,
            identityId: registered.accountIdentityId,
          },
          devicePublicKeyRef: registered.devicePublicKeyRef,
          label: registered.label,
          createdAt: registered.registeredAt,
        })
      : createUnavailableFedosDeviceBinding({
          deviceId: registered.deviceId,
          accountRef: {
            authority: registered.accountAuthority,
            publicIdentifier: registered.accountPublicIdentifier,
            identityId: registered.accountIdentityId,
          },
          devicePublicKeyRef: registered.devicePublicKeyRef,
          label: registered.label,
          createdAt: registered.registeredAt,
        });

  for (const event of eventsForDeviceId) {
    if (event.eventType === "registered") continue;
    if (event.eventType === "trusted") {
      const next = trustFedosDeviceBinding(binding, event.trustedAt);
      if (next !== null) binding = next;
      continue;
    }
    const next = revokeFedosDeviceBinding(binding, event.revokedAt);
    if (next !== null) binding = next;
  }
  return binding;
}
