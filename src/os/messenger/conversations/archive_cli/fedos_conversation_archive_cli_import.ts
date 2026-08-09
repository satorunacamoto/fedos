/**
 * Secure Runtime Alpha 2341–2420 ("Conversation Archive CLI and User
 * Packaging") — CLI Verify / Preflight / Import.
 *
 * Three commands, ONE shared decrypt step
 * (`FedosConversationArchiveEncryptionAuthority.import()`, Alpha
 * 1541–1610, unchanged), each adding exactly the next existing,
 * unmodified Archive step on top of it and nothing else:
 *
 *   - "archive verify"    -- decrypt + Manifest/Header/content-hash
 *     check only (`authority.import()` ALREADY performs this whole
 *     check internally and never touches persistence — this command is
 *     a direct, un-embellished pass-through of that result).
 *   - "archive preflight" -- decrypt, then run the EXISTING read-only
 *     `detectFedosConversationArchiveDuplicates()`
 *     (`../archive/fedos_conversation_archive_duplicate_detection.ts`)
 *     — reports what an Import WOULD do, writes nothing.
 *   - "archive import"    -- decrypt, then run the EXISTING
 *     `restoreFedosConversationArchiveBundle()`
 *     (`../archive/fedos_conversation_archive_restore.ts`) — the only
 *     one of the three that writes.
 *
 * HARD GUARDRAILS:
 *   - "archive verify" and "archive preflight" never call any `put*`
 *     method — verified by construction: neither imports
 *     `fedos_conversation_archive_restore.ts`.
 *   - Every function here fails closed by forwarding the Authority's
 *     own outcome verbatim on anything other than `"decrypted"` — no
 *     new failure vocabulary is invented for the decrypt step itself.
 */

import type { FedosConversationArchiveEncryptionAuthority, FedosConversationArchiveImportResult } from "../archive/fedos_conversation_archive_encryption.js";
import {
  detectFedosConversationArchiveDuplicates,
  type FedosConversationArchiveDuplicateDetectionDependencies,
  type FedosConversationArchiveDuplicateReport,
} from "../archive/fedos_conversation_archive_duplicate_detection.js";
import {
  restoreFedosConversationArchiveBundle,
  type FedosConversationArchiveRestoreDependencies,
  type FedosConversationArchiveRestoreResult,
} from "../archive/fedos_conversation_archive_restore.js";
import type { FedosConversationEnvelopeEncryptionSuite } from "../envelope/fedos_conversation_message_envelope.js";
import type { FedosConversationArchiveCliPackageV1 } from "./fedos_conversation_archive_cli_package.js";

export interface FedosConversationArchiveCliOpenRequest {
  readonly package: FedosConversationArchiveCliPackageV1;
  readonly suite: FedosConversationEnvelopeEncryptionSuite;
  readonly localAccountIndex: number;
  readonly counterpartyPublicKeyHex: string;
}

function openPackage(request: FedosConversationArchiveCliOpenRequest, authority: FedosConversationArchiveEncryptionAuthority): Promise<FedosConversationArchiveImportResult> {
  return authority.import({
    manifest: request.package.manifest,
    ciphertext: request.package.ciphertext,
    suite: request.suite,
    localAccountIndex: request.localAccountIndex,
    counterpartyPublicKeyHex: request.counterpartyPublicKeyHex,
  });
}

/** "archive verify" — decrypt-and-check only, never touches persistence. Returns the Authority's own outcome verbatim. */
export function verifyFedosConversationArchiveCliPackage(
  request: FedosConversationArchiveCliOpenRequest,
  authority: FedosConversationArchiveEncryptionAuthority,
): Promise<FedosConversationArchiveImportResult> {
  return openPackage(request, authority);
}

export type FedosConversationArchiveCliPreflightResult =
  | { readonly outcome: "decrypted"; readonly report: FedosConversationArchiveDuplicateReport }
  | Exclude<FedosConversationArchiveImportResult, { outcome: "decrypted" }>;

/** "archive preflight" — decrypt, then report what Import WOULD do. Never writes. */
export async function preflightFedosConversationArchiveCliPackage(
  request: FedosConversationArchiveCliOpenRequest,
  authority: FedosConversationArchiveEncryptionAuthority,
  duplicateDetectionDeps: FedosConversationArchiveDuplicateDetectionDependencies,
): Promise<FedosConversationArchiveCliPreflightResult> {
  const opened = await openPackage(request, authority);
  if (opened.outcome !== "decrypted") return opened;
  return { outcome: "decrypted", report: detectFedosConversationArchiveDuplicates(opened.bundle, duplicateDetectionDeps) };
}

export type FedosConversationArchiveCliImportResult =
  | { readonly outcome: "decrypted"; readonly result: FedosConversationArchiveRestoreResult }
  | Exclude<FedosConversationArchiveImportResult, { outcome: "decrypted" }>;

/** "archive import" — decrypt, then actually restore into `restoreDeps`'s five persistence ports. */
export async function importFedosConversationArchiveCliPackage(
  request: FedosConversationArchiveCliOpenRequest,
  authority: FedosConversationArchiveEncryptionAuthority,
  restoreDeps: FedosConversationArchiveRestoreDependencies,
): Promise<FedosConversationArchiveCliImportResult> {
  const opened = await openPackage(request, authority);
  if (opened.outcome !== "decrypted") return opened;
  return { outcome: "decrypted", result: restoreFedosConversationArchiveBundle(opened.bundle, restoreDeps) };
}
