/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Trusted Archive-File Removal
 * Authority.
 *
 * Phase H — the one genuinely new local capability this Arc's own
 * normative review (`cf5b870`) identified as missing: a real, tracked,
 * best-effort local Archive-file `remove-file` operation. Built entirely
 * on top of the EXISTING Archive CLI directory index
 * (`../archive_cli/fedos_conversation_archive_cli_directory.ts`) — never
 * a raw filesystem scan, never a caller-supplied path.
 *
 * A `FedosDeletionArchiveFileHandle` is the ONLY way this module accepts
 * an Archive-file target: it is produced exclusively by
 * `resolveFedosDeletionArchiveFileHandle`, which consults the directory's
 * own trusted index (`listFedosConversationArchiveCliDirectory`) and
 * requires the resolved entry's OWN `manifest.conversationId` to match
 * the caller's requested `conversationId` — closing the "wrong Archive
 * identity" class of mistake even in the narrow case where two different
 * conversation ids sanitize (`fedosConversationArchiveCliPackageFileName`)
 * to the same file name.
 *
 * `removeFedosDeletionArchiveFile` additionally re-checks that same
 * identity at removal time (never trusting a handle resolved in a
 * possibly-stale earlier call) and requires an explicit, non-empty
 * `planId` confirmation token — this Arc's own execution coordinator
 * (`fedos_deletion_execution_coordinator.ts`) is the only caller
 * authorized to supply one, always derived from an already-confirmed
 * plan, never invented ad hoc.
 *
 * HARD GUARDRAILS (restated, enforced here):
 *   - Exactly one file, never a directory, never a wildcard.
 *   - Deleting an Archive file never touches live Conversation history —
 *     this module imports nothing from `../retention/`, `../search/`, or
 *     `../persistence/`.
 *   - Missing-file idempotent: a retry after a prior successful removal
 *     (or a removal that raced with the file already being gone) reports
 *     `"already-removed"`, never an error.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import {
  fedosConversationArchiveCliPackageFileName,
  listFedosConversationArchiveCliDirectory,
  removeFedosConversationArchiveCliDirectoryEntry,
} from "../archive_cli/fedos_conversation_archive_cli_directory.js";
import {
  fedosConversationArchiveCliNodeFileSystem,
  type FedosConversationArchiveCliFileSystem,
} from "../archive_cli/fedos_conversation_archive_cli_file_system.js";
import {
  isFedosDeletionArchiveSingleSegmentFileName,
  validateFedosDeletionArchiveDirectoryRoot,
} from "./fedos_deletion_archive_path_authority.js";

export interface FedosDeletionArchiveFileHandle {
  readonly directoryPath: string;
  readonly conversationId: FedosConversationId;
  readonly fileName: string;
}

export type FedosDeletionArchiveFileResolveOutcome =
  | { readonly outcome: "found"; readonly handle: FedosDeletionArchiveFileHandle }
  | { readonly outcome: "index-unavailable" }
  | { readonly outcome: "not-tracked" }
  | { readonly outcome: "invalid-directory" };

/**
 * Resolves a canonical handle for `conversationId`'s own tracked Archive
 * Package file, ONLY by consulting the directory's own trusted index —
 * never by constructing or guessing a path. `"not-tracked"` if the index
 * does not currently name a file for this conversation (already removed,
 * or never exported here).
 */
export function resolveFedosDeletionArchiveFileHandle(
  directoryPath: string,
  conversationId: FedosConversationId,
  fileSystem: FedosConversationArchiveCliFileSystem = fedosConversationArchiveCliNodeFileSystem,
): FedosDeletionArchiveFileResolveOutcome {
  if (validateFedosDeletionArchiveDirectoryRoot(directoryPath) !== "allowed") return { outcome: "invalid-directory" };

  const entries = listFedosConversationArchiveCliDirectory(directoryPath, fileSystem);
  if (entries === null) return { outcome: "index-unavailable" };

  const expectedFileName = fedosConversationArchiveCliPackageFileName(conversationId);
  const entry = entries.find((candidate) => candidate.fileName === expectedFileName && candidate.manifest.conversationId === conversationId);
  if (entry === undefined) return { outcome: "not-tracked" };
  if (!isFedosDeletionArchiveSingleSegmentFileName(entry.fileName)) return { outcome: "not-tracked" };

  return { outcome: "found", handle: { directoryPath, conversationId, fileName: entry.fileName } };
}

export interface FedosDeletionArchiveFileRemovalConfirmation {
  /** Must be a non-empty identifier for an already-confirmed plan — never invented ad hoc by this module's own caller path. */
  readonly planId: string;
}

export type FedosDeletionArchiveFileRemovalOutcome =
  | "removed"
  | "already-removed"
  | "identity-mismatch"
  | "invalid-directory"
  | "index-unavailable"
  | "failed";

/**
 * Removes EXACTLY the one Archive Package file `handle` names. Requires
 * a non-empty confirmation token. Re-checks the directory index's own
 * current entry for `handle.fileName` and requires its
 * `manifest.conversationId` to still equal `handle.conversationId` —
 * refuses (`"identity-mismatch"`) rather than deleting a file that no
 * longer matches the identity this handle was resolved for.
 */
export function removeFedosDeletionArchiveFile(
  handle: FedosDeletionArchiveFileHandle,
  confirmation: FedosDeletionArchiveFileRemovalConfirmation,
  fileSystem: FedosConversationArchiveCliFileSystem = fedosConversationArchiveCliNodeFileSystem,
): FedosDeletionArchiveFileRemovalOutcome {
  if (confirmation.planId.trim().length === 0) return "failed";
  if (validateFedosDeletionArchiveDirectoryRoot(handle.directoryPath) !== "allowed") return "invalid-directory";
  if (!isFedosDeletionArchiveSingleSegmentFileName(handle.fileName)) return "failed";

  const entries = listFedosConversationArchiveCliDirectory(handle.directoryPath, fileSystem);
  if (entries === null) return "index-unavailable";

  const entry = entries.find((candidate) => candidate.fileName === handle.fileName);
  if (entry === undefined) return "already-removed";
  if (entry.manifest.conversationId !== handle.conversationId) return "identity-mismatch";

  const outcome = removeFedosConversationArchiveCliDirectoryEntry(handle.directoryPath, handle.fileName, fileSystem);
  switch (outcome) {
    case "removed":
      return "removed";
    case "not-found":
      return "already-removed";
    case "index-unavailable":
      return "index-unavailable";
    case "failed":
      return "failed";
  }
}
