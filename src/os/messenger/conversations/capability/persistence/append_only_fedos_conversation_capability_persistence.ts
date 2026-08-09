/**
 * Secure Runtime Alpha 840 ("Append-Only Capability Persistence") —
 * Stage 8 of Phase C of the Alpha 821–850 Durable Conversation
 * Membership & Capability Persistence Arc.
 *
 * Mirrors `AppendOnlyFedosConversationMembershipPersistence`'s own
 * event-keyed backend exactly (Alpha 829) — independent NDJSON log
 * file, insert-only, deterministic replay, fail-closed on corruption,
 * zero new dependency, no compaction/delete/rewrite, no path traversal
 * beyond whatever the caller-supplied `filePath` itself already grants
 * (this file performs no path construction of its own — mirrors every
 * other append-only backend in this codebase).
 *
 * `currentUses` consistency (Alpha 840's own requirement) is structural,
 * not a separate check: `reconstructFedosConversationCapabilityRecord()`
 * COUNTS `"redeemed"` events rather than trusting any stored counter
 * field — there is no mutable counter anywhere in this file for a
 * corrupt log to desynchronize.
 *
 * No plaintext bearer secret is ever written by this file — every event
 * this backend accepts is already caller-constructed via the codec
 * (Alpha 836), which itself only ever carries a `bearerVerifier`.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosConversationCapabilityEventKey,
  fedosPersistedConversationCapabilityEventsAreEqual,
  reconstructFedosConversationCapabilityRecord,
  type FedosConversationCapabilityPersistence,
  type FedosConversationCapabilityPersistenceWriteResult,
} from "../../../../../conversation/capability/persistence/fedos_conversation_capability_persistence.js";
import {
  fedosConversationCapabilityRedeemedEventKey,
  type FedosPersistedConversationCapabilityEventV1,
  type FedosPersistedConversationCapabilityRecordV1,
} from "../../../../../conversation/capability/persistence/fedos_persisted_conversation_capability_v1.js";

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

/** PRIVATE — replays the append log into a deduplicated array, keyed per event. A parse failure or irreconcilable duplicate throws unconditionally (Alpha 832's "one corrupt record voids the backend" precedent, applied identically here). */
function replayLog(filePath: string): FedosPersistedConversationCapabilityEventV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedConversationCapabilityEventV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationCapabilityEventV1;
    const key = fedosConversationCapabilityEventKey(parsed);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPersistedConversationCapabilityEventsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosConversationCapabilityPersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosConversationCapabilityPersistence implements FedosConversationCapabilityPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putEvent(event: FedosPersistedConversationCapabilityEventV1): FedosConversationCapabilityPersistenceWriteResult {
    const key = fedosConversationCapabilityEventKey(event);
    const existing = replayLog(this.#filePath).find((e) => fedosConversationCapabilityEventKey(e) === key) ?? null;
    if (existing !== null) {
      return fedosPersistedConversationCapabilityEventsAreEqual(existing, event) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(event) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getCapability(capabilityId: string): FedosPersistedConversationCapabilityRecordV1 | null {
    return reconstructFedosConversationCapabilityRecord(replayLog(this.#filePath).filter((event) => event.capabilityId === capabilityId));
  }

  listCapabilities(): readonly FedosPersistedConversationCapabilityRecordV1[] {
    return this.#currentByDistinctCapability(replayLog(this.#filePath));
  }

  listConversationCapabilities(conversationId: string): readonly FedosPersistedConversationCapabilityRecordV1[] {
    const events = replayLog(this.#filePath);
    const issuedForConversation = events.filter((event) => event.eventType === "issued" && event.conversationId === conversationId);
    const capabilityIds = new Set(issuedForConversation.map((event) => event.capabilityId));
    return this.#currentByDistinctCapability(events.filter((event) => capabilityIds.has(event.capabilityId)));
  }

  #currentByDistinctCapability(
    events: readonly FedosPersistedConversationCapabilityEventV1[],
  ): readonly FedosPersistedConversationCapabilityRecordV1[] {
    const capabilityIds = new Set(events.map((event) => event.capabilityId));
    const result: FedosPersistedConversationCapabilityRecordV1[] = [];
    for (const capabilityId of capabilityIds) {
      const record = reconstructFedosConversationCapabilityRecord(events.filter((event) => event.capabilityId === capabilityId));
      if (record !== null) result.push(record);
    }
    return result;
  }

  hasRedeemedEvent(capabilityId: string, redeemerAuthority: string, redeemerPublicIdentifier: string): boolean {
    const key = fedosConversationCapabilityRedeemedEventKey(capabilityId, redeemerAuthority, redeemerPublicIdentifier);
    return replayLog(this.#filePath).some((event) => fedosConversationCapabilityEventKey(event) === key);
  }

  listConversationCapabilityEvents(conversationId: string): readonly FedosPersistedConversationCapabilityEventV1[] {
    const events = replayLog(this.#filePath);
    const issuedForConversation = events.filter((event) => event.eventType === "issued" && event.conversationId === conversationId);
    const capabilityIds = new Set(issuedForConversation.map((event) => event.capabilityId));
    return events.filter((event) => capabilityIds.has(event.capabilityId));
  }
}
