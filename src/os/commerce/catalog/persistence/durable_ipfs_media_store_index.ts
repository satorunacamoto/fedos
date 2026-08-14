/**
 * Real Digital Delivery mega-arc (Coordinator, protected-media-byte-
 * durability closure) — durable persistence for `IpfsMediaStore`'s own
 * private `#index` (`../ipfs_media_store.ts`), the SECOND half of the
 * protected-media-byte-durability fix. `./durable_ipfs_transport.ts` (this
 * file's own sibling) makes the raw ciphertext BYTES durable; this class
 * makes the METADATA `IpfsMediaStore.get()`/`.metadata()`/`.getProtected()`
 * check FIRST — before ever touching the transport — durable too. See
 * `IpfsMediaStoreIndexPersistence`'s own doc comment in
 * `../ipfs_media_store.ts` for the full "why a separate seam" rationale
 * (short version: `IpfsTransport.add(bytes)` has no `contentType`
 * parameter, so a transport alone cannot reconstruct this).
 *
 * PATTERN: byte-for-byte the same append-only-NDJSON/replay-on-
 * construction/fail-closed-on-corruption discipline as
 * `./durable_product_media_repository.ts` (this file's own direct
 * template — see that file's own header for the fuller precedent
 * citation this one intentionally does not repeat) — independent log
 * file, `node:fs` `readFileSync`/`appendFileSync` only, no
 * compaction/rewrite, no new dependency.
 *
 * NO UPDATE/CONFLICT CASE TO RECONCILE: unlike `ProductMedia` (a mutable
 * entity `DurableProductMediaRepository` tracks by an app-assigned `id`),
 * a `MediaObjectMetadata` record here is keyed by its OWN content-derived
 * CID (`key`) — `IpfsMediaStore.put()` only ever calls `record()` once per
 * distinct CID, immediately after a successful `#index.set()` for a
 * brand-new entry (an `"already-present"`/`"conflict"` `put()` outcome
 * never reaches `record()` at all — see that method's own control flow).
 * Two records sharing the same `key` but disagreeing on `checksum` is
 * therefore still treated as corruption on replay (defense-in-depth,
 * mirroring the sibling file's own "irreconcilable conflict" discipline),
 * even though no legitimate caller in this codebase can currently produce
 * one.
 */

import { readFileSync, appendFileSync } from "node:fs";
import type { MediaObjectMetadata } from "../media_store_port.js";
import type { IpfsMediaStoreIndexPersistence } from "../ipfs_media_store.js";

const MEDIA_INDEX_SCHEMA_VERSION_1 = 1 as const;

/** One persisted line: one full `MediaObjectMetadata` record — there is no partial-update case on this seam (see this file's own header). */
interface PersistedMediaIndexRecordV1 {
  readonly schemaVersion: 1;
  readonly metadata: MediaObjectMetadata;
}

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

/** Minimal structural well-formedness check for a replayed `MediaObjectMetadata` record — mirrors `DurableProductMediaRepository`'s own `isWellFormedProductMediaShape()` scope exactly (reject a truncated/garbled line only; there are no separate business rules to re-run here the way `validateProductMedia()` re-validates on every fresh `add()` — this seam's ONLY caller, `IpfsMediaStore.put()`, has already independently validated everything about `metadata` before `record()` is ever invoked). */
function isWellFormedMediaObjectMetadata(value: unknown): value is MediaObjectMetadata {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.key !== "string" || c.key.length === 0) return false;
  if (typeof c.contentType !== "string") return false;
  if (typeof c.sizeBytes !== "number" || !Number.isFinite(c.sizeBytes)) return false;
  if (typeof c.checksum !== "string" || c.checksum.length === 0) return false;
  if (typeof c.storedAt !== "number" || !Number.isFinite(c.storedAt)) return false;
  return true;
}

/**
 * PRIVATE — replays the append log into a `Map<key, MediaObjectMetadata>`.
 * A parse failure, an unrecognized `schemaVersion`, a schema-invalid
 * record, OR an irreconcilable `checksum` conflict between two records
 * sharing the same `key` throws unconditionally — fail-closed on
 * corruption, exactly like every sibling append-only backend in this
 * codebase.
 */
function replayLog(filePath: string): Map<string, MediaObjectMetadata> {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, MediaObjectMetadata>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (typeof parsedJson !== "object" || parsedJson === null) {
      throw new Error("DurableIpfsMediaStoreIndex: corrupt or schema-invalid record found in log file.");
    }
    const candidate = parsedJson as Record<string, unknown>;
    if (candidate.schemaVersion !== MEDIA_INDEX_SCHEMA_VERSION_1) {
      throw new Error(
        `DurableIpfsMediaStoreIndex: unsupported/unknown schemaVersion "${String(candidate.schemaVersion)}" found in log file.`,
      );
    }
    if (!isWellFormedMediaObjectMetadata(candidate.metadata)) {
      throw new Error("DurableIpfsMediaStoreIndex: corrupt or schema-invalid MediaObjectMetadata record found in log file.");
    }
    const metadata = candidate.metadata;
    const existing = byKey.get(metadata.key);
    if (existing !== undefined && existing.checksum !== metadata.checksum) {
      throw new Error(
        `DurableIpfsMediaStoreIndex: conflicting duplicate records for key "${metadata.key}" found in log file (checksum disagrees).`,
      );
    }
    byKey.set(metadata.key, metadata);
  }
  return byKey;
}

export class DurableIpfsMediaStoreIndex implements IpfsMediaStoreIndexPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  loadAll(): ReadonlyMap<string, MediaObjectMetadata> {
    return replayLog(this.#filePath);
  }

  record(metadata: MediaObjectMetadata): void {
    const record: PersistedMediaIndexRecordV1 = { schemaVersion: MEDIA_INDEX_SCHEMA_VERSION_1, metadata };
    appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
  }
}
