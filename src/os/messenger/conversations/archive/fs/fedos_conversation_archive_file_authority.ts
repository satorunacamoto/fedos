/**
 * Secure Runtime Alpha 1691–1760 ("Conversation Archive Runtime
 * Integration and Recovery Operations Arc") — Archive File Authority.
 *
 * The ONE narrow boundary between `FedosConversationArchiveRuntime`
 * (`../runtime/fedos_conversation_archive_runtime.ts`) and the local
 * filesystem. Mirrors this codebase's own "opaque bytes port, no
 * meaning attached" discipline (`FedosConversationPayloadStorage`,
 * Alpha 804) — this file has NO knowledge of the Archive Manifest,
 * Bundle, or Encryption Authority; it only ever moves bytes in and out
 * of ONE caller-chosen path.
 *
 * Exactly three operations, per this Arc's own Phase B scope — no
 * delete, no rename-for-the-caller, no directory listing, no arbitrary
 * path traversal helper:
 *
 *   - `inspectFile(path)`   — read-only stat, never throws.
 *   - `readArchive(path, maxByteLength)` — bounded whole-buffer read;
 *     size is checked via `fs.promises.stat` BEFORE any content byte is
 *     read into memory (Phase B item 7 — never allocates unbounded
 *     input for an oversized candidate file).
 *   - `createArchiveExclusive(path, bytes)` — the ONE write path. No
 *     overwrite is possible: a temp file is written+flushed in the
 *     SAME directory as `path` (guaranteeing same-volume), then
 *     committed via `fs.promises.link()` — POSIX/NTFS `link(2)`/
 *     `CreateHardLink` both FAIL with `EEXIST` if `path` already
 *     exists, which is this file's actual no-overwrite enforcement
 *     (never a separate, racy `fs.existsSync` check beforehand, per
 *     Phase B item 5's own explicit instruction). The temp file is
 *     always removed afterward, on every path (success, `EEXIST`, or
 *     any other failure) — it never collides with a caller-suppliable
 *     destination name (see `#temporaryPathFor`, below).
 *
 * HONEST, NAMED LIMITS (Phase B items 6/8, stated here rather than
 * silently assumed):
 *   - No symlink-attack detection of any kind — if `path` (or its
 *     parent directory) is a symlink to somewhere unexpected, this file
 *     does not detect or block that. Out of scope for this Arc.
 *   - `link()`+`unlink()` is atomic AND non-clobbering at the
 *     filesystem-metadata level on same-volume POSIX/NTFS filesystems —
 *     this is a real, verifiable property of `link(2)`/`CreateHardLink`,
 *     not an assumption. It is NOT a power-loss-durability claim: an
 *     `fsync`-equivalent (`filehandle.sync()`) is called on the temp
 *     file before linking, on a best-effort basis, but this file makes
 *     no claim about surviving a crash between `sync()` and `link()`,
 *     or about the underlying storage device's own write-cache honesty.
 *   - Parent-directory creation is NOT this file's job — see
 *     `"parent-missing"`, below; a caller (the Runtime assembly, a
 *     reviewed point) decides whether/when to `mkdir`.
 *   - This file does not attempt to detect a symlink loop, a FUSE/
 *     network mount's own weaker atomicity guarantees, or any
 *     filesystem-specific quirk beyond what Node's `node:fs` promises
 *     API itself already reports.
 *
 * HARD GUARDRAILS:
 *   - Never throws — every failure mode is a closed-vocabulary result.
 *   - Never deletes or overwrites a pre-existing user file.
 *   - No arbitrary delete/rename beyond the temp file THIS module itself
 *     created in the same call.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { promises as fsPromises } from "node:fs";
// @ts-expect-error see above.
import { dirname, basename, join } from "node:path";
import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";

export interface FedosConversationArchiveFileInspection {
  readonly exists: boolean;
  readonly isDirectory: boolean;
  /** `0` when `exists` is `false`. */
  readonly byteLength: number;
}

export type FedosConversationArchiveFileReadResult =
  | { readonly outcome: "read"; readonly bytes: Uint8Array }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "is-directory" }
  | { readonly outcome: "too-large"; readonly byteLength: number }
  | { readonly outcome: "failed" };

export type FedosConversationArchiveFileWriteResult =
  | { readonly outcome: "written" }
  | { readonly outcome: "already-exists" }
  | { readonly outcome: "is-directory" }
  | { readonly outcome: "parent-missing" }
  | { readonly outcome: "failed" };

export interface FedosConversationArchiveFileAuthority {
  inspectFile(path: string): Promise<FedosConversationArchiveFileInspection>;
  readArchive(path: string, maxByteLength: number): Promise<FedosConversationArchiveFileReadResult>;
  createArchiveExclusive(path: string, bytes: Uint8Array): Promise<FedosConversationArchiveFileWriteResult>;
}

interface NodeErrnoLike {
  readonly code?: string;
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeErrnoLike | undefined)?.code;
}

/** A temp-file name that cannot collide with ANY caller-supplied destination: it is derived from `path`'s own basename plus a fresh 16-byte random suffix, written into `path`'s own parent directory (same volume, required for `link()` to be atomic). */
function temporaryPathFor(path: string): string {
  const suffix = bytesToHex(nobleRandomBytes(16));
  return join(dirname(path), `.${basename(path)}.fedos-archive-tmp-${suffix}`);
}

export class NodeFedosConversationArchiveFileAuthority implements FedosConversationArchiveFileAuthority {
  async inspectFile(path: string): Promise<FedosConversationArchiveFileInspection> {
    try {
      const stats = await fsPromises.stat(path);
      return { exists: true, isDirectory: stats.isDirectory(), byteLength: stats.isDirectory() ? 0 : stats.size };
    } catch (error) {
      if (errorCode(error) === "ENOENT") return { exists: false, isDirectory: false, byteLength: 0 };
      // Any other stat failure (permission denied, etc.) is reported the same as "not found" -- this
      // method never throws, and the Runtime's own callers treat "cannot confirm it exists" uniformly.
      return { exists: false, isDirectory: false, byteLength: 0 };
    }
  }

  async readArchive(path: string, maxByteLength: number): Promise<FedosConversationArchiveFileReadResult> {
    let stats: { isDirectory(): boolean; size: number };
    try {
      stats = await fsPromises.stat(path);
    } catch (error) {
      if (errorCode(error) === "ENOENT") return { outcome: "not-found" };
      return { outcome: "failed" };
    }
    if (stats.isDirectory()) return { outcome: "is-directory" };
    if (stats.size > maxByteLength) return { outcome: "too-large", byteLength: stats.size };

    try {
      const buffer = await fsPromises.readFile(path);
      const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      if (bytes.length > maxByteLength) return { outcome: "too-large", byteLength: bytes.length };
      return { outcome: "read", bytes };
    } catch (error) {
      if (errorCode(error) === "ENOENT") return { outcome: "not-found" };
      return { outcome: "failed" };
    }
  }

  async createArchiveExclusive(path: string, bytes: Uint8Array): Promise<FedosConversationArchiveFileWriteResult> {
    try {
      const destinationStats = await fsPromises.stat(path);
      if (destinationStats.isDirectory()) return { outcome: "is-directory" };
      return { outcome: "already-exists" };
    } catch (error) {
      if (errorCode(error) !== "ENOENT") return { outcome: "failed" };
      // ENOENT -- nothing exists at `path` yet, the expected, common case. Continue below.
      // (This stat is a best-effort early distinguisher for "is-directory" vs "already-exists" --
      // the REAL no-overwrite enforcement is the exclusive temp-file create + link() below, which
      // is race-free; this branch alone would be a hand-rolled, racy existence check on its own.)
    }

    const parentDirectory = dirname(path);
    try {
      const parentStats = await fsPromises.stat(parentDirectory);
      if (!parentStats.isDirectory()) return { outcome: "parent-missing" };
    } catch {
      return { outcome: "parent-missing" };
    }

    const temporaryPath = temporaryPathFor(path);
    let handle: { sync(): Promise<void>; write(data: Uint8Array): Promise<unknown>; close(): Promise<void> } | undefined;
    try {
      handle = await fsPromises.open(temporaryPath, "wx");
      // `handle` is assigned from an untyped (`any`, per this file's own `node:fs` @ts-expect-error)
      // return value, so TS control-flow narrowing cannot itself rule out `undefined` here -- `!` is
      // a plain non-null assertion of a value this line just assigned two lines above, never a
      // runtime risk.
      await handle!.write(bytes);
      try {
        // Best-effort durability -- see this file's own header for exactly what this does and does
        // not guarantee. Some filesystems/mounts do not support `fsync`; a failure here is not
        // treated as fatal, since the subsequent `link()` still gives atomic, non-clobbering commit
        // semantics regardless.
        await handle!.sync();
      } catch {
        // Intentionally ignored -- see comment above.
      }
      await handle!.close();
      handle = undefined;

      try {
        await fsPromises.link(temporaryPath, path);
      } catch (linkError) {
        const code = errorCode(linkError);
        if (code === "EEXIST") return { outcome: "already-exists" };
        return { outcome: "failed" };
      }

      return { outcome: "written" };
    } catch {
      return { outcome: "failed" };
    } finally {
      if (handle !== undefined) {
        try {
          await handle.close();
        } catch {
          // Intentionally ignored.
        }
      }
      try {
        await fsPromises.unlink(temporaryPath);
      } catch {
        // Intentionally ignored -- the temp file may already be gone (successful link path already
        // leaves it in place until this cleanup, or it was never created at all).
      }
    }
  }
}

export const fedosConversationArchiveFileAuthority: FedosConversationArchiveFileAuthority = new NodeFedosConversationArchiveFileAuthority();
