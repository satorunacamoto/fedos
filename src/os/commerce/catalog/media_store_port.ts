/**
 * Merchant Product CRUD + Product Media + MediaStore Port arc (§7).
 *
 * `MediaStorePort` — opaque-bytes storage for product media, shaped after
 * this codebase's existing opaque-bytes Port:
 * `FedosConversationPayloadStorage`
 * (`src/os/messenger/conversations/payload_storage/fedos_conversation_payload_storage.ts`),
 * the closest live analog named by this arc's own brief. Differences from
 * that Port, each deliberate:
 *
 *   - `put()` here does NOT take a caller-chosen id/descriptor — the key
 *     is ALWAYS derived from the content hash of the bytes actually being
 *     stored (`computeCommerceMediaContentHash()`,
 *     `./product_media_content_address.ts`). This makes content-
 *     addressing (§8's core requirement — "content-address the
 *     CIPHERTEXT") a PROPERTY OF THE PORT ITSELF, not a convention a
 *     caller could forget to follow.
 *   - `remove()` exists (payload storage deliberately has none — a
 *     Conversation payload log is append-only by policy). Product media
 *     legitimately needs removal (a merchant deleting a listing/image),
 *     so this Port does not borrow that specific guardrail.
 *   - `metadata()` mirrors `getDescriptor()` — read the descriptor
 *     without paying for the bytes.
 *
 * EXTENSION POINT for a future `IpfsMediaStore` (Wave B; NOT implemented
 * here — see this arc's own brief, "do NOT implement IPFS yourself"): a
 * conforming adapter must
 *   1. still return a content-addressed `key` from `put()` (a CID is a
 *      valid content-addressed key; it does not need to be this Port's
 *      own SHA-256 hex — `key`'s format is adapter-defined opaque text,
 *      exactly like `DigitalAsset.storageRef`/`ProductMedia.storageRef`
 *      already are),
 *   2. make `get()` verify the returned bytes actually hash/resolve to
 *      the requested `key` before returning them (fail closed — return
 *      `null` — on any mismatch, mirroring `LocalMediaStore.get()`'s own
 *      defensive re-check, `./local_media_store.ts`),
 *   3. never accept plaintext bytes for anything the caller marks
 *      `classification: "protected"` (`./product_media_types.ts`) — that
 *      is enforced one layer up, by `./product_media_encryption.ts`'s
 *      encrypt-before-address pipeline, but an IPFS adapter in particular
 *      must not add its own "convenience" plaintext-caching path that
 *      would defeat it,
 *   4. surface network/availability failures as `null`/`"failed"`
 *      outcomes (never throw) — matches every other Port in this
 *      codebase's "total function" discipline.
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

/** Descriptive metadata for one stored object. Never includes the bytes. */
export interface MediaObjectMetadata {
  /** The content-addressed key — see this file's own header. */
  readonly key: string;
  /** MIME type, as `ProductMedia.contentType`. */
  readonly contentType: string;
  readonly sizeBytes: number;
  /** Always equal to `key` for a same-hash-space adapter (`LocalMediaStore`); kept as its own field for parity with `ProductMedia.checksum`/every other FedOS descriptor shape. */
  readonly checksum: string;
  /** Unix ms this object was stored. */
  readonly storedAt: number;
}

/** A stored object: its metadata plus a DEFENSIVE COPY of the bytes — mirrors `FedosConversationPayload`'s own "never a reference to any internally-held array" guardrail. */
export interface MediaObject {
  readonly metadata: MediaObjectMetadata;
  readonly bytes: Uint8Array;
}

export interface MediaStorePutRequest {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export type MediaStorePutResult =
  | { readonly outcome: "stored"; readonly metadata: MediaObjectMetadata }
  | { readonly outcome: "already-present"; readonly metadata: MediaObjectMetadata }
  | { readonly outcome: "conflict" }
  | { readonly outcome: "oversized" }
  | { readonly outcome: "unsupported-content-type" }
  | { readonly outcome: "failed" };

export interface MediaStorePort {
  /** Stores `request.bytes`, deriving the key from their content hash. See this file's own header for the content-addressing guarantee. */
  put(request: MediaStorePutRequest): MediaStorePutResult;
  /** Returns the object (metadata + a defensive copy of the bytes), or `null` if unknown/unavailable/corrupt. Never throws. */
  get(key: string): MediaObject | null;
  exists(key: string): boolean;
  /** `true` if an object existed and was removed; `false` if it was already absent. Never throws. */
  remove(key: string): boolean;
  /** Metadata only — no bytes read/copied. `null` if unknown. */
  metadata(key: string): MediaObjectMetadata | null;
}
