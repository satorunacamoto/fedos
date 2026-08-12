/**
 * Secure Runtime Alpha 2341–2420 ("Conversation Archive CLI and User
 * Packaging") — CLI File System Boundary.
 *
 * The ONE narrow, injectable boundary "directory export"/"directory
 * import"/"archive list" reach through to actually read/write bytes —
 * mirrors `FedosConversationArchiveEncryptionRuntimeBoundary`'s own
 * injected-boundary shape (Alpha 1541–1610): a real, `node:fs`-backed
 * implementation for real use, and an in-memory fake for tests, behind
 * one small interface. SYNCHRONOUS, matching this codebase's own
 * established `node:fs` convention (`readFileSync`/`appendFileSync` in
 * `../persistence/append_only_fedos_conversation_persistence.ts` and
 * every sibling append-only backend) rather than introducing
 * `node:fs/promises` as a second, unprecedented Node file-I/O idiom.
 *
 * HARD GUARDRAILS:
 *   - Every method fails closed (`null`/`false`), never throws — the
 *     SAME discipline every reused Archive function already applies to
 *     malformed input, extended here to the actual filesystem call
 *     itself (a missing directory, a permission error, a missing file).
 *   - No path traversal handling of any kind is added here — `path`
 *     always comes from the CLI-layer caller (`../archive_cli/fedos_conversation_archive_cli_directory.ts`),
 *     which is itself in-process/trusted, not untrusted external input;
 *     out of scope for this Arc.
 *
 * Secure Runtime Alpha 5401–5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") adds ONE new method, `deleteFile` — the
 * missing local capability the Secret Capability Deletion review
 * (`cf5b870`) identified: "no `deleteFile`/`removeFile` method anywhere
 * in `src/conversation/archive_cli/`." Mirrors every other method's own
 * fail-closed, missing-idempotent discipline: a target that does not
 * exist is treated as ALREADY removed (`true`), never an error; a
 * symlink/reparse-point target is refused outright (`false`) rather than
 * followed — this Arc's own deletion coordinator never deletes THROUGH a
 * link, only an ordinary file the Archive CLI itself wrote.
 */

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface FedosConversationArchiveCliFileSystem {
  /** `null` if `path` does not exist or cannot be read — fails closed, never throws. */
  readFile(path: string): Uint8Array | null;
  /** Creates parent directories as needed. `false` on any write failure — fails closed, never throws. */
  writeFile(path: string, bytes: Uint8Array): boolean;
  /** Every entry name directly inside `directoryPath` (not recursive). `null` if `directoryPath` does not exist or cannot be listed. */
  listFiles(directoryPath: string): readonly string[] | null;
  /**
   * Removes exactly the one file at `path` — never a directory, never
   * recursive. `true` if `path` did not exist to begin with (missing-file
   * idempotency) or was successfully removed. `false` if `path` is a
   * symlink/reparse point (refused, never followed) or removal otherwise
   * failed — fails closed, never throws.
   */
  deleteFile(path: string): boolean;
}

/** The real, `node:fs`-backed `FedosConversationArchiveCliFileSystem`. */
export const fedosConversationArchiveCliNodeFileSystem: FedosConversationArchiveCliFileSystem = {
  readFile(path: string): Uint8Array | null {
    try {
      if (!existsSync(path)) return null;
      return new Uint8Array(readFileSync(path));
    } catch {
      return null;
    }
  },

  writeFile(path: string, bytes: Uint8Array): boolean {
    try {
      writeFileSync(path, bytes);
      return true;
    } catch {
      try {
        const lastSeparator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
        if (lastSeparator > 0) mkdirSync(path.slice(0, lastSeparator), { recursive: true });
        writeFileSync(path, bytes);
        return true;
      } catch {
        return false;
      }
    }
  },

  listFiles(directoryPath: string): readonly string[] | null {
    try {
      if (!existsSync(directoryPath)) return null;
      return readdirSync(directoryPath) as readonly string[];
    } catch {
      return null;
    }
  },

  deleteFile(path: string): boolean {
    try {
      if (!existsSync(path)) return true;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) return false;
      unlinkSync(path);
      return true;
    } catch {
      return false;
    }
  },
};

/** Joins a directory path and a file name — the ONE place this Arc's directory packaging (`./fedos_conversation_archive_cli_directory.ts`) constructs a path, so every join uses this platform-correct helper rather than manual string concatenation. */
export function joinFedosConversationArchiveCliPath(directoryPath: string, fileName: string): string {
  return join(directoryPath, fileName);
}
