/**
 * Secure Runtime Alpha 3481–3560 — In-Memory Transfer Session Persistence.
 * Mirrors `../../persistence/in_memory_fedos_device_registry_persistence.ts`'s
 * own private-`Map<eventKey, event>`-backed convention exactly.
 */

import {
  fedosDeviceTransferEventKey,
  fedosPersistedDeviceTransferEventsAreEqual,
  reconstructFedosDeviceTransferSessionRecord,
  type FedosDeviceTransferSessionPersistence,
  type FedosDeviceTransferSessionPersistenceWriteResult,
} from "../../../../../device/transfer/persistence/fedos_device_transfer_session_persistence.js";
import type { FedosPersistedDeviceTransferEventV1 } from "../../../../../device/transfer/persistence/fedos_persisted_device_transfer_event_v1.js";
import type { FedosDeviceTransferSessionV1 } from "../../../../../device/transfer/fedos_device_transfer_session.js";

export class InMemoryFedosDeviceTransferSessionPersistence implements FedosDeviceTransferSessionPersistence {
  readonly #events = new Map<string, FedosPersistedDeviceTransferEventV1>();

  putEvent(event: FedosPersistedDeviceTransferEventV1): FedosDeviceTransferSessionPersistenceWriteResult {
    const key = fedosDeviceTransferEventKey(event);
    const existing = this.#events.get(key);
    if (existing === undefined) {
      this.#events.set(key, event);
      return "inserted";
    }
    return fedosPersistedDeviceTransferEventsAreEqual(existing, event) ? "already-present" : "conflict";
  }

  getSession(sessionId: string): FedosDeviceTransferSessionV1 | null {
    return reconstructFedosDeviceTransferSessionRecord(this.#eventsForSession(sessionId));
  }

  listSessionsForAccount(accountAuthority: string, accountPublicIdentifier: string): readonly FedosDeviceTransferSessionV1[] {
    const sessionIds = new Set([...this.#events.values()].map((event) => event.sessionId));
    const result: FedosDeviceTransferSessionV1[] = [];
    for (const sessionId of sessionIds) {
      const record = reconstructFedosDeviceTransferSessionRecord(this.#eventsForSession(sessionId));
      if (record !== null && record.accountAuthority === accountAuthority && record.accountPublicIdentifier === accountPublicIdentifier) {
        result.push(record);
      }
    }
    return result;
  }

  #eventsForSession(sessionId: string): readonly FedosPersistedDeviceTransferEventV1[] {
    return [...this.#events.values()].filter((event) => event.sessionId === sessionId);
  }
}
