/**
 * Merchant Product CRUD + Product Media + MediaStore Port arc (§7).
 *
 * `LocalMediaStore` — a deterministic, in-process/local `MediaStorePort`
 * adapter. No server, no network. `Map`-backed with defensive copies,
 * following the SAME convention as `InMemoryFedosConversationPayloadStorage`
 * (`src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.ts`)
 * and this same arc's own `LocalProductRepository`.
 *
 * POLICY IS EXPLICIT, NEVER INVENTED: `maxPayloadByteLength` and
 * `supportedContentTypes` are REQUIRED constructor parameters — mirrors
 * `AppendOnlyFedosConversationPayloadStorage`'s own instruction ("this
 * Arc does not invent an arbitrary default maximum without repository
 * precedent... a caller must make an explicit, informed choice",
 * `src/os/messenger/conversations/payload_storage/append_only_fedos_conversation_payload_storage.ts`).
 * There is no repository precedent for a commerce-media size/MIME
 * default, so none is invented here either.
 *
 * CONTENT-ADDRESSING + TAMPER DEFENSE: `put()` always derives the key
 * from `computeCommerceMediaContentHash(bytes)` — a caller cannot choose
 * an arbitrary key. `get()` re-verifies the stored bytes against that key
 * before returning them (`verifyCommerceMediaContentAddress()`) — for
 * this in-memory adapter that recheck is currently tautological (nothing
 * else can write into the private `#objects` map), but it is the same
 * defensive re-check `media_store_port.ts`'s own "Extension point for a
 * future IpfsMediaStore" section requires of every adapter, so it is
 * built and tested here rather than left as a TODO for Wave B.
 */

import { computeCommerceMediaContentHash, verifyCommerceMediaContentAddress } from "./product_media_content_address.js";
import type {
  MediaObject,
  MediaObjectMetadata,
  MediaStorePort,
  MediaStorePutRequest,
  MediaStorePutResult,
} from "./media_store_port.js";

interface StoredEntry {
  readonly metadata: MediaObjectMetadata;
  readonly bytes: Uint8Array;
}

export class LocalMediaStore implements MediaStorePort {
  readonly #objects = new Map<string, StoredEntry>();
  readonly #maxPayloadByteLength: number;
  readonly #supportedContentTypes: ReadonlySet<string>;
  readonly #now: () => number;

  constructor(maxPayloadByteLength: number, supportedContentTypes: readonly string[], now: () => number = Date.now) {
    this.#maxPayloadByteLength = maxPayloadByteLength;
    this.#supportedContentTypes = new Set(supportedContentTypes);
    this.#now = now;
  }

  put(request: MediaStorePutRequest): MediaStorePutResult {
    if (request.bytes.length > this.#maxPayloadByteLength) {
      return { outcome: "oversized" };
    }
    if (!this.#supportedContentTypes.has(request.contentType)) {
      return { outcome: "unsupported-content-type" };
    }

    const key = computeCommerceMediaContentHash(request.bytes);
    const existing = this.#objects.get(key);
    if (existing !== undefined) {
      if (existing.metadata.contentType === request.contentType) {
        return { outcome: "already-present", metadata: existing.metadata };
      }
      // Same content hash, different claimed contentType — refuse rather than silently pick a winner.
      return { outcome: "conflict" };
    }

    const metadata: MediaObjectMetadata = {
      key,
      contentType: request.contentType,
      sizeBytes: request.bytes.length,
      checksum: key,
      storedAt: this.#now(),
    };
    this.#objects.set(key, { metadata, bytes: Uint8Array.from(request.bytes) });
    return { outcome: "stored", metadata };
  }

  get(key: string): MediaObject | null {
    const entry = this.#objects.get(key);
    if (entry === undefined) return null;
    // Defense-in-depth re-check — see this file's own header.
    if (!verifyCommerceMediaContentAddress(entry.bytes, key)) return null;
    return { metadata: entry.metadata, bytes: Uint8Array.from(entry.bytes) };
  }

  exists(key: string): boolean {
    return this.#objects.has(key);
  }

  remove(key: string): boolean {
    return this.#objects.delete(key);
  }

  metadata(key: string): MediaObjectMetadata | null {
    return this.#objects.get(key)?.metadata ?? null;
  }
}
