/**
 * Secure Runtime Alpha 807 ("In-Memory Payload Storage") — Stage 17 of
 * the Alpha 791–820 Conversation Retention & Private Payload Storage
 * Boundary Foundation Arc.
 *
 * Mirrors `InMemoryFedosConversationPersistence`'s own private-field
 * `Map`-backed convention exactly (Alpha 751).
 *
 * HARD GUARDRAILS:
 *   - Deterministic, no constructor side effects.
 *   - Independent instances never share state.
 *   - `putPayload`/`getPayload` both make a DEFENSIVE COPY of `bytes` —
 *     the stored array is never the caller's own reference, and the
 *     array returned by `getPayload` is never the internally-held one
 *     (Alpha 805).
 *   - `listConversationPayloads` returns descriptors only, filtered by
 *     `conversationId` — no cross-conversation leak (Alpha 813).
 */

import {
  fedosConversationPayloadBytesAreEqual,
  fedosConversationPayloadDescriptorsAreEqual,
  type FedosConversationPayload,
  type FedosConversationPayloadStorage,
  type FedosConversationPayloadStorageWriteResult,
} from "../../../../conversation/payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadDescriptor } from "../../../../conversation/payload_storage/fedos_conversation_payload_descriptor.js";
import type { FedosConversationPayloadId } from "../../../../conversation/payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";

interface StoredEntry {
  readonly descriptor: FedosConversationPayloadDescriptor;
  readonly bytes: Uint8Array;
}

export class InMemoryFedosConversationPayloadStorage implements FedosConversationPayloadStorage {
  readonly #entries = new Map<string, StoredEntry>();

  putPayload(descriptor: FedosConversationPayloadDescriptor, bytes: Uint8Array): FedosConversationPayloadStorageWriteResult {
    const existing = this.#entries.get(descriptor.id);
    if (existing !== undefined) {
      const sameDescriptor = fedosConversationPayloadDescriptorsAreEqual(existing.descriptor, descriptor);
      const sameBytes = fedosConversationPayloadBytesAreEqual(existing.bytes, bytes);
      return sameDescriptor && sameBytes ? "already-present" : "conflict";
    }
    this.#entries.set(descriptor.id, { descriptor, bytes: Uint8Array.from(bytes) });
    return "inserted";
  }

  getPayload(id: FedosConversationPayloadId): FedosConversationPayload | null {
    const entry = this.#entries.get(id);
    if (entry === undefined) return null;
    return { descriptor: entry.descriptor, bytes: Uint8Array.from(entry.bytes) };
  }

  getDescriptor(id: FedosConversationPayloadId): FedosConversationPayloadDescriptor | null {
    return this.#entries.get(id)?.descriptor ?? null;
  }

  listConversationPayloads(conversationId: FedosConversationId): readonly FedosConversationPayloadDescriptor[] {
    const results: FedosConversationPayloadDescriptor[] = [];
    for (const entry of this.#entries.values()) {
      if (entry.descriptor.conversationId === conversationId) results.push(entry.descriptor);
    }
    return results;
  }
}
