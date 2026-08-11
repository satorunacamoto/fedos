/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Archive Path Authority.
 *
 * Narrow, additive guard rails for the ONE new local capability this Arc
 * introduces (tracked Archive-file removal, `fedos_deletion_archive_file_authority.ts`).
 * Per Phase A, an Archive directory path is caller-supplied, in-process,
 * trusted input at the CLI layer (no untrusted network/IPC path reaches
 * it in this codebase today) — this module does not pretend otherwise by
 * inventing a sandbox this Arc cannot actually enforce. What it DOES
 * enforce, structurally:
 *
 *   - a file name must be a single path segment (no separator, no `..`)
 *     — this is what makes "directory-recursive deletion" and "arbitrary
 *     extension wildcard" structurally impossible: the delete call this
 *     Arc issues can only ever target one named leaf file, never a
 *     directory, never a pattern.
 *   - an obviously-dangerous root (empty, or a bare drive/filesystem
 *     root) is rejected outright — this is the cheap, real check that
 *     catches "no user profile root deletion"/"no source-tree deletion"
 *     class mistakes at the CALL SITE, even though this Arc cannot prove
 *     a deeper path is not, say, a symlinked profile directory (the
 *     symlink/reparse-point check in
 *     `fedos_conversation_archive_cli_file_system.ts`'s own `deleteFile`
 *     is the deeper, real defense for that).
 */

const BARE_ROOT_PATTERNS: readonly RegExp[] = [
  /^[A-Za-z]:\\?$/, // "C:" or "C:\"
  /^\/$/, // "/"
  /^\\\\?$/, // "\" or "\\"
];

export type FedosDeletionArchiveDirectoryValidation = "allowed" | "empty-path" | "bare-root-denied";

/** Structural check only — see this file's own header for what it does and does not prove. */
export function validateFedosDeletionArchiveDirectoryRoot(directoryPath: string): FedosDeletionArchiveDirectoryValidation {
  const trimmed = directoryPath.trim();
  if (trimmed.length === 0) return "empty-path";
  if (BARE_ROOT_PATTERNS.some((pattern) => pattern.test(trimmed))) return "bare-root-denied";
  return "allowed";
}

/** `true` iff `fileName` is a single path segment: no separator, no `.`/`..`, non-empty. Never resolved/normalized against a filesystem — a pure string-shape check. */
export function isFedosDeletionArchiveSingleSegmentFileName(fileName: string): boolean {
  if (fileName.length === 0) return false;
  if (fileName === "." || fileName === "..") return false;
  if (fileName.includes("/") || fileName.includes("\\")) return false;
  if (fileName.includes("..")) return false;
  return true;
}
