/**
 * Secure Runtime Alpha 2921–3000 ("Device Trust and Multi-Device Runtime
 * Integration") — In-Memory Device Registry Persistence (Phase D).
 *
 * Mirrors `../../conversation/capability/persistence/in_memory_fedos_conversation_capability_persistence.ts`'s
 * own private-`Map<eventKey, event>`-backed convention exactly (Alpha
 * 839), applied to Device Binding events instead of Capability events.
 */

import {
  fedosDeviceBindingEventKey,
  fedosPersistedDeviceBindingEventsAreEqual,
  reconstructFedosDeviceBindingRecord,
  type FedosDeviceRegistryPersistence,
  type FedosDeviceRegistryPersistenceWriteResult,
} from "../../../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosPersistedDeviceBindingEventV1 } from "../../../../device/persistence/fedos_persisted_device_binding_event_v1.js";
import type { FedosDeviceBindingV1 } from "../../../../device/fedos_device_binding.js";

export class InMemoryFedosDeviceRegistryPersistence implements FedosDeviceRegistryPersistence {
  readonly #events = new Map<string, FedosPersistedDeviceBindingEventV1>();

  putEvent(event: FedosPersistedDeviceBindingEventV1): FedosDeviceRegistryPersistenceWriteResult {
    const key = fedosDeviceBindingEventKey(event);
    const existing = this.#events.get(key);
    if (existing === undefined) {
      this.#events.set(key, event);
      return "inserted";
    }
    return fedosPersistedDeviceBindingEventsAreEqual(existing, event) ? "already-present" : "conflict";
  }

  getBinding(deviceId: string): FedosDeviceBindingV1 | null {
    return reconstructFedosDeviceBindingRecord(this.#eventsForDevice(deviceId));
  }

  listBindings(): readonly FedosDeviceBindingV1[] {
    return this.#currentByDistinctDevice([...this.#events.values()]);
  }

  listBindingsForAccount(accountAuthority: string, accountPublicIdentifier: string): readonly FedosDeviceBindingV1[] {
    return this.listBindings().filter(
      (binding) => binding.accountRef.authority === accountAuthority && binding.accountRef.publicIdentifier === accountPublicIdentifier,
    );
  }

  #eventsForDevice(deviceId: string): readonly FedosPersistedDeviceBindingEventV1[] {
    return [...this.#events.values()].filter((event) => event.deviceId === deviceId);
  }

  #currentByDistinctDevice(events: readonly FedosPersistedDeviceBindingEventV1[]): readonly FedosDeviceBindingV1[] {
    const deviceIds = new Set(events.map((event) => event.deviceId));
    const result: FedosDeviceBindingV1[] = [];
    for (const deviceId of deviceIds) {
      const record = reconstructFedosDeviceBindingRecord(events.filter((event) => event.deviceId === deviceId));
      if (record !== null) result.push(record);
    }
    return result;
  }
}
