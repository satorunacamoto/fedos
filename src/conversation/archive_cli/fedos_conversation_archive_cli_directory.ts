/**
 * Secure Runtime Alpha 2341–2420 ("Conversation Archive CLI and User
 * Packaging") — CLI Directory Export / Import / List ("directory
 * export", "directory import", "archive list", "metadata manifest").
 *
 * A directory of many Packages (`./fedos_conversation_archive_cli_package.ts`,
 * one file per conversation) plus ONE index file — this Arc's own
 * `FedosConversationArchiveCliDirectoryManifestV1` ("metadata
 * manifest") — naming every Package's file name alongside its already-
 * cleartext `FedosConversationArchiveManifestV1`. "archive list" reads
 * ONLY this index, never a raw directory scan — a directory may contain
 * files this Arc did not write; trusting an index this Arc itself
 * produced is preferred over guessing which arbitrary file is a
 * Package.
 *
 * Every read/write goes through the injected
 * `FedosConversationArchiveCliFileSystem`
 * (`./fedos_conversation_archive_cli_file_system.ts`) — no direct
 * `node:fs` call anywhere in this file.
 *
 * HARD GUARDRAILS:
 *   - `exportFedosConversationArchiveCliDirectory` never aborts the
 *     whole batch on one conversation's failure — every outcome is
 *     tallied per-conversation, mirroring Restore's own Alpha 1541–1610
 *     "a partially-invalid Archive should not block the rest" discipline.
 *   - `importFedosConversationArchiveCliDirectory` reads the directory
 *     index strictly — `null` (missing/corrupt index) fails the WHOLE
 *     directory import closed rather than falling back to scanning.
 *   - Never throws.
 */

import type { FedosConversationArchiveCollectorDependencies } from "../archive/fedos_conversation_archive_collector.js";
import type { FedosConversationArchiveEncryptionAuthority } from "../archive/fedos_conversation_archive_encryption.js";
import type { FedosConversationArchiveManifestV1 } from "../archive/fedos_conversation_archive_manifest.js";
import { deserializeFedosConversationArchiveManifest } from "../archive/fedos_conversation_archive_manifest_codec.js";
import type { FedosConversationArchiveRestoreDependencies, FedosConversationArchiveRestoreResult } from "../archive/fedos_conversation_archive_restore.js";
import type { FedosConversationEnvelopeEncryptionSuite } from "../envelope/fedos_conversation_message_envelope.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import { exportFedosConversationArchiveCliPackage, type FedosConversationArchiveCliExportRequest } from "./fedos_conversation_archive_cli_export.js";
import { fedosConversationArchiveCliNodeFileSystem, joinFedosConversationArchiveCliPath, type FedosConversationArchiveCliFileSystem } from "./fedos_conversation_archive_cli_file_system.js";
import { importFedosConversationArchiveCliPackage } from "./fedos_conversation_archive_cli_import.js";
import { FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, type FedosConversationArchiveCliPackageFormatVersion } from "./fedos_conversation_archive_cli_package.js";
import {
  deserializeFedosConversationArchiveCliPackageFromBytes,
  serializeFedosConversationArchiveCliPackageToBytes,
} from "./fedos_conversation_archive_cli_package_codec.js";

export const FEDOS_CONVERSATION_ARCHIVE_CLI_DIRECTORY_MANIFEST_FILE_NAME = "index.fedos-archive-manifest.json";
const PACKAGE_FILE_EXTENSION = ".fedos-archive.json";

/** Deterministic, filesystem-safe file name for one conversation's Package — every non `[A-Za-z0-9_-]` character (including Alpha 743's own `::` id separator) is replaced with `_`. */
export function fedosConversationArchiveCliPackageFileName(conversationId: string): string {
  return `${conversationId.replace(/[^A-Za-z0-9_-]/g, "_")}${PACKAGE_FILE_EXTENSION}`;
}

export interface FedosConversationArchiveCliDirectoryEntryV1 {
  readonly fileName: string;
  readonly manifest: FedosConversationArchiveManifestV1;
}

/** "metadata manifest" — the one index file a directory of Packages carries, entirely in the clear. */
export interface FedosConversationArchiveCliDirectoryManifestV1 {
  readonly formatVersion: FedosConversationArchiveCliPackageFormatVersion;
  readonly generatedAt: number;
  readonly entries: readonly FedosConversationArchiveCliDirectoryEntryV1[];
}

function serializeDirectoryManifest(manifest: FedosConversationArchiveCliDirectoryManifestV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(manifest));
}

function deserializeDirectoryManifest(bytes: Uint8Array): FedosConversationArchiveCliDirectoryManifestV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const { formatVersion, generatedAt, entries } = parsed as { formatVersion: unknown; generatedAt: unknown; entries: unknown };
  if (formatVersion !== FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION) return null;
  if (typeof generatedAt !== "number") return null;
  if (!Array.isArray(entries)) return null;

  const decoded: FedosConversationArchiveCliDirectoryEntryV1[] = [];
  for (const raw of entries) {
    if (raw === null || typeof raw !== "object") return null;
    const { fileName, manifest } = raw as { fileName: unknown; manifest: unknown };
    if (typeof fileName !== "string" || fileName.length === 0) return null;
    const decodedManifest = deserializeFedosConversationArchiveManifest(manifest);
    if (decodedManifest === null) return null;
    decoded.push({ fileName, manifest: decodedManifest });
  }

  return { formatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, generatedAt, entries: decoded };
}

export type FedosConversationArchiveCliDirectoryExportEntryOutcome = "exported" | "conversation-not-found" | "key-unavailable" | "invalid-input" | "failed" | "write-failed";

export interface FedosConversationArchiveCliDirectoryExportEntryResult {
  readonly conversationId: FedosConversationId;
  readonly fileName: string | null;
  readonly outcome: FedosConversationArchiveCliDirectoryExportEntryOutcome;
}

export interface FedosConversationArchiveCliDirectoryExportResult {
  readonly entries: readonly FedosConversationArchiveCliDirectoryExportEntryResult[];
  readonly directoryManifestWritten: boolean;
}

/** "directory export" — exports every request into its own Package file under `directoryPath`, plus the one "metadata manifest" index file. Every conversation's own outcome is independently tallied; one failure never aborts the rest. */
export async function exportFedosConversationArchiveCliDirectory(
  requests: readonly FedosConversationArchiveCliExportRequest[],
  collectorDeps: FedosConversationArchiveCollectorDependencies,
  authority: FedosConversationArchiveEncryptionAuthority,
  directoryPath: string,
  generatedAt: number,
  fileSystem: FedosConversationArchiveCliFileSystem = fedosConversationArchiveCliNodeFileSystem,
): Promise<FedosConversationArchiveCliDirectoryExportResult> {
  const entries: FedosConversationArchiveCliDirectoryExportEntryResult[] = [];
  const directoryEntries: FedosConversationArchiveCliDirectoryEntryV1[] = [];

  for (const request of requests) {
    const result = await exportFedosConversationArchiveCliPackage(request, collectorDeps, authority);
    if (result.outcome !== "exported") {
      entries.push({ conversationId: request.conversationId, fileName: null, outcome: result.outcome });
      continue;
    }

    const fileName = fedosConversationArchiveCliPackageFileName(request.conversationId);
    const written = fileSystem.writeFile(joinFedosConversationArchiveCliPath(directoryPath, fileName), serializeFedosConversationArchiveCliPackageToBytes(result.package));
    if (!written) {
      entries.push({ conversationId: request.conversationId, fileName: null, outcome: "write-failed" });
      continue;
    }

    entries.push({ conversationId: request.conversationId, fileName, outcome: "exported" });
    directoryEntries.push({ fileName, manifest: result.package.manifest });
  }

  const directoryManifestWritten = fileSystem.writeFile(
    joinFedosConversationArchiveCliPath(directoryPath, FEDOS_CONVERSATION_ARCHIVE_CLI_DIRECTORY_MANIFEST_FILE_NAME),
    serializeDirectoryManifest({ formatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, generatedAt, entries: directoryEntries }),
  );

  return { entries, directoryManifestWritten };
}

/** "archive list" — reads ONLY the directory's own index file. `null` if the index is missing or corrupt — fails the whole listing closed rather than falling back to a raw directory scan. */
export function listFedosConversationArchiveCliDirectory(
  directoryPath: string,
  fileSystem: FedosConversationArchiveCliFileSystem = fedosConversationArchiveCliNodeFileSystem,
): readonly FedosConversationArchiveCliDirectoryEntryV1[] | null {
  const bytes = fileSystem.readFile(joinFedosConversationArchiveCliPath(directoryPath, FEDOS_CONVERSATION_ARCHIVE_CLI_DIRECTORY_MANIFEST_FILE_NAME));
  if (bytes === null) return null;
  const manifest = deserializeDirectoryManifest(bytes);
  return manifest === null ? null : manifest.entries;
}

export interface FedosConversationArchiveCliDirectoryImportOpenParams {
  readonly suite: FedosConversationEnvelopeEncryptionSuite;
  readonly localAccountIndex: number;
  readonly counterpartyPublicKeyHex: string;
}

export interface FedosConversationArchiveCliDirectoryImportEntryResult {
  readonly fileName: string;
  readonly conversationId: string;
  readonly outcome: "decrypted" | "read-failed" | "invalid-package" | "manifest-mismatch" | "key-unavailable" | "invalid-input" | "failed";
  readonly result: FedosConversationArchiveRestoreResult | null;
}

/** "directory import" — lists the directory (via its own index), then imports every Package it names, using the SAME `openParams` for each (every Package in one directory is assumed to belong to the same account/counterparty pairing, matching how "directory export" was itself invoked). `null` if the directory's own index cannot be read. */
export async function importFedosConversationArchiveCliDirectory(
  directoryPath: string,
  openParams: FedosConversationArchiveCliDirectoryImportOpenParams,
  authority: FedosConversationArchiveEncryptionAuthority,
  restoreDeps: FedosConversationArchiveRestoreDependencies,
  fileSystem: FedosConversationArchiveCliFileSystem = fedosConversationArchiveCliNodeFileSystem,
): Promise<readonly FedosConversationArchiveCliDirectoryImportEntryResult[] | null> {
  const directoryEntries = listFedosConversationArchiveCliDirectory(directoryPath, fileSystem);
  if (directoryEntries === null) return null;

  const results: FedosConversationArchiveCliDirectoryImportEntryResult[] = [];
  for (const entry of directoryEntries) {
    const bytes = fileSystem.readFile(joinFedosConversationArchiveCliPath(directoryPath, entry.fileName));
    if (bytes === null) {
      results.push({ fileName: entry.fileName, conversationId: entry.manifest.conversationId, outcome: "read-failed", result: null });
      continue;
    }

    const pkg = deserializeFedosConversationArchiveCliPackageFromBytes(bytes);
    if (pkg === null) {
      results.push({ fileName: entry.fileName, conversationId: entry.manifest.conversationId, outcome: "invalid-package", result: null });
      continue;
    }

    const imported = await importFedosConversationArchiveCliPackage({ package: pkg, ...openParams }, authority, restoreDeps);
    results.push({
      fileName: entry.fileName,
      conversationId: entry.manifest.conversationId,
      outcome: imported.outcome,
      result: imported.outcome === "decrypted" ? imported.result : null,
    });
  }

  return results;
}
