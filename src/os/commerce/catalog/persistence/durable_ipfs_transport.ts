/**
 * Real Digital Delivery mega-arc (Coordinator, protected-media-byte-
 * durability closure) — the durable `IpfsTransport` (`../ipfs_media_store.ts`)
 * `docs/commerce/PROTECTED-MEDIA-BYTE-DURABILITY-GAP.md` names as its own
 * "recommended shape, not yet built" option 1: a sibling of
 * `InMemoryIpfsTransport`, same `IpfsTransport` Port, backed by per-object
 * files on disk under the profile directory. `InMemoryIpfsTransport`'s own
 * `Map` is wiped both on process restart AND on every lock/unlock cycle
 * within one process run (`commerceMediaStoreFor()`,
 * `fedos_electron_beta_main.cts`, rebuilds it whenever the shared Master
 * Seed Authority reference changes) — this class fixes that by making the
 * bytes genuinely disk-backed; reconstructing a fresh instance of THIS
 * class costs nothing, since it holds no in-process cache of its own and
 * every `add()`/`cat()` call goes straight to disk.
 *
 * NOTE: making the raw BYTES durable is necessary but NOT sufficient —
 * `IpfsMediaStore` (the `MediaStorePort` adapter that wraps a transport)
 * keeps its OWN private metadata index (`contentType`/`checksum`/
 * `sizeBytes`/`storedAt`), which `add()`/`cat()` here have no way to
 * receive or reconstruct (`add(bytes)` takes no `contentType`). See
 * `./durable_ipfs_media_store_index.ts` — this file's own sibling — for
 * the second half of this fix.
 *
 * CONTENT-ADDRESSED, NEVER CALLER-CHOSEN: exactly like
 * `InMemoryIpfsTransport`, the CID is always `` `fake-cid:${sha256}` ``
 * (`computeCommerceMediaContentHash()`, the SAME hash every other
 * content-addressing spot in this domain already uses) — a caller cannot
 * pick an arbitrary storage key, and `cat()` validates that shape
 * BEFORE ever resolving a filesystem path from it (traversal defense —
 * see `isSafeCid()` below; no general-purpose traversal-sanitization
 * helper exists elsewhere in this codebase to reuse, confirmed by prior
 * investigation of this exact gap).
 *
 * IDEMPOTENT BY CONSTRUCTION: because the key IS the content hash, the
 * mandate's "same key, different content" conflict case is structurally
 * impossible here — two `add()` calls for the SAME cid can only ever be
 * for byte-identical content. `add()` therefore treats "blob file already
 * exists" as success, never a conflict.
 *
 * ATOMIC, NON-CLOBBERING WRITES: mirrors
 * `../../messenger/conversations/archive/fs/fedos_conversation_archive_file_authority.ts`'s
 * `createArchiveExclusive()` technique (that file's own header for the
 * full rationale) — write to a same-directory, randomly-suffixed temp
 * file, then commit via `linkSync()` (not `rename()`: `link()` fails
 * atomically with `EEXIST` if the destination already exists, giving
 * race-free no-overwrite semantics), with guaranteed temp-file cleanup in
 * `finally`. Adapted to the SYNCHRONOUS `node:fs` API (`writeFileSync`/
 * `linkSync`/`unlinkSync`) because `IpfsTransport` is deliberately
 * synchronous by Port contract (`../ipfs_media_store.ts`'s own header) —
 * this is a smaller, already-precedented move than widening that Port
 * (every `Durable*` repository in this codebase already uses the
 * synchronous `node:fs` API, never the promise one). BEST-EFFORT
 * durability only, same honest caveat as the async precedent: no
 * fsync-equivalent call is made (Node's synchronous `fs` API offers no
 * cheap equivalent), and no claim is made about surviving a genuine power
 * loss mid-write — only that a crash never leaves a PARTIALLY-WRITTEN
 * object visible at the real content-addressed path (the partial write
 * only ever exists at the temp path until the atomic `link()` commit
 * succeeds).
 *
 * NEVER PERSISTS PLAINTEXT: this class has no opinion about
 * classification — it stores exactly the bytes `IpfsMediaStore.put()`
 * hands it, which for protected media is ALWAYS already-encrypted
 * ciphertext (`putProtected()`'s own structural guarantee, `../ipfs_media_store.ts`).
 * No encryption key, master seed, or plaintext byte is ever reachable
 * from this file.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, linkSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { computeCommerceMediaContentHash } from "../product_media_content_address.js";
import type { IpfsTransport } from "../ipfs_media_store.js";

const CID_PREFIX = "fake-cid:";
/** SHA-256 hex digest shape, exactly what `computeCommerceMediaContentHash()` always produces — nothing else is ever a valid CID this transport will resolve to a path. */
const CID_HASH_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Traversal/format defense-in-depth: a `cid` must be EXACTLY
 * `"fake-cid:" + 64 lowercase hex chars` — no `.`/`/`/`\`/drive-letter/
 * UNC/encoded-traversal sequence can ever satisfy this, so a validated
 * `cid` is inherently safe to turn into a same-directory filename. No
 * general-purpose path-sanitization helper exists elsewhere in this
 * codebase to reuse (confirmed by investigation preceding this file) —
 * this is written fresh, deliberately narrow (an allowlist shape, not a
 * denylist of `".."`), for exactly this one closed CID format.
 */
function isSafeCid(cid: string): boolean {
  return typeof cid === "string" && cid.startsWith(CID_PREFIX) && CID_HASH_PATTERN.test(cid.slice(CID_PREFIX.length));
}

/** `cid` must already be `isSafeCid()`-validated before this is called — the returned name is then guaranteed to contain only `[0-9a-f]` plus a fixed literal suffix, never a path separator or traversal segment. */
function blobFileNameFor(cid: string): string {
  return `${cid.slice(CID_PREFIX.length)}.blob`;
}

function temporaryPathFor(destination: string): string {
  const suffix = randomBytes(16).toString("hex");
  return join(dirname(destination), `.${suffix}.fedos-media-blob-tmp`);
}

/**
 * Writes `bytes` to `destination` atomically and without clobbering any
 * existing object — see this file's own header for the full technique.
 * Returns `true` on success (including the idempotent "already present"
 * case), `false` on any real failure.
 */
function writeBlobAtomicallyIfAbsent(destination: string, bytes: Uint8Array): boolean {
  if (existsSync(destination)) return true; // content-addressed: an existing file for this exact CID is, by construction, byte-identical.
  const temporaryPath = temporaryPathFor(destination);
  let temporaryFileCreated = false;
  try {
    writeFileSync(temporaryPath, bytes, { flag: "wx" });
    temporaryFileCreated = true;
    try {
      linkSync(temporaryPath, destination);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException | undefined)?.code;
      // EEXIST: another writer already committed the SAME content-addressed object -- success, not a conflict.
      return code === "EEXIST";
    }
    return true;
  } catch {
    return false;
  } finally {
    if (temporaryFileCreated) {
      try {
        unlinkSync(temporaryPath);
      } catch {
        // Best-effort cleanup only -- ENOENT here just means the temp file is already gone (the normal case after a successful link()).
      }
    }
  }
}

export class DurableIpfsTransport implements IpfsTransport {
  /** Honest self-report: a local disk directory never reaches a network, under any circumstance -- see `IpfsTransport`'s own doc comment for why callers must never assume otherwise. */
  readonly requiresNetwork = false;
  readonly #blobDir: string;

  /** `blobDir` must be a profile-scoped absolute directory (the caller's responsibility -- see `../../../../messenger/desktop/onboarding/fedos_local_profile_paths.ts`'s own "one profile-scoped path-planning boundary" discipline; this class does not invent its own root). Created (recursively) here if absent -- directory creation IS this constructor's job, unlike the archive file authority's `createArchiveExclusive()`, since there is no separate "ensureDirectories()" pass in the Commerce composition root today. */
  constructor(blobDir: string) {
    this.#blobDir = blobDir;
    mkdirSync(blobDir, { recursive: true });
  }

  add(bytes: Uint8Array): string | null {
    const cid = `${CID_PREFIX}${computeCommerceMediaContentHash(bytes)}`;
    const destination = join(this.#blobDir, blobFileNameFor(cid));
    return writeBlobAtomicallyIfAbsent(destination, bytes) ? cid : null;
  }

  cat(cid: string): Uint8Array | null {
    if (!isSafeCid(cid)) return null;
    const path = join(this.#blobDir, blobFileNameFor(cid));
    try {
      const buffer = readFileSync(path);
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } catch {
      return null;
    }
  }

  pin(cid: string): boolean {
    if (!isSafeCid(cid)) return false;
    return existsSync(join(this.#blobDir, blobFileNameFor(cid)));
  }
}
