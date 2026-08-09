/**
 * Secure Runtime Alpha 2341–2420 ("Conversation Archive CLI and User
 * Packaging") — CLI Export ("archive export").
 *
 * Pure composition, zero new logic: collects a conversation's bundle
 * via the EXISTING `collectFedosConversationArchiveBundle()` (Alpha
 * 1541–1610, `../archive/fedos_conversation_archive_collector.ts`),
 * seals it via the EXISTING `FedosConversationArchiveEncryptionAuthority.export()`
 * (same Arc, `../archive/fedos_conversation_archive_encryption.ts`),
 * and names the pairing a `FedosConversationArchiveCliPackageV1`
 * (`./fedos_conversation_archive_cli_package.ts`, this Arc's own new
 * type). Adds exactly ONE new failure mode this Arc's own reused
 * functions did not already have a slot for —
 * `"conversation-not-found"` — for the one case the Collector signals
 * with `null` (Alpha 1541–1610's own "fail closed, matching every
 * existing lookup" discipline) that the Encryption Authority's own
 * outcome vocabulary has no member for, since it never sees a `null`
 * bundle at all.
 *
 * HARD GUARDRAILS:
 *   - Never calls any `put*`/write method — read-only against
 *     persistence, exactly like the Collector it wraps.
 *   - Never throws — every Authority failure passes through verbatim;
 *     the one new branch this file adds is itself a simple `null` check.
 */

import { collectFedosConversationArchiveBundle, type FedosConversationArchiveCollectorDependencies } from "../../../../conversation/archive/fedos_conversation_archive_collector.js";
import type {
  FedosConversationArchiveEncryptionAuthority,
  FedosConversationArchiveExportResult,
} from "../../../../conversation/archive/fedos_conversation_archive_encryption.js";
import type { FedosConversationEnvelopeEncryptionSuite } from "../../../../conversation/envelope/fedos_conversation_message_envelope.js";
import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import { FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, type FedosConversationArchiveCliPackageV1 } from "../../../../conversation/archive_cli/fedos_conversation_archive_cli_package.js";

export interface FedosConversationArchiveCliExportRequest {
  readonly conversationId: FedosConversationId;
  readonly exportedAt: number;
  readonly suite: FedosConversationEnvelopeEncryptionSuite;
  /** ALREADY RESOLVED by the caller — see `fedos_conversation_archive_encryption.ts`'s own header for why this codebase never resolves these two fields internally. */
  readonly localAccountIndex: number;
  readonly counterpartyPublicKeyHex: string;
}

export type FedosConversationArchiveCliExportResult =
  | { readonly outcome: "exported"; readonly package: FedosConversationArchiveCliPackageV1 }
  | { readonly outcome: "conversation-not-found" }
  | Exclude<FedosConversationArchiveExportResult, { outcome: "exported" }>;

/** "archive export" — collects, seals, and packages exactly one conversation. Never throws. */
export async function exportFedosConversationArchiveCliPackage(
  request: FedosConversationArchiveCliExportRequest,
  collectorDeps: FedosConversationArchiveCollectorDependencies,
  authority: FedosConversationArchiveEncryptionAuthority,
): Promise<FedosConversationArchiveCliExportResult> {
  const bundle = collectFedosConversationArchiveBundle(request.conversationId, collectorDeps, request.exportedAt);
  if (bundle === null) return { outcome: "conversation-not-found" };

  const exported = await authority.export({
    bundle,
    suite: request.suite,
    localAccountIndex: request.localAccountIndex,
    counterpartyPublicKeyHex: request.counterpartyPublicKeyHex,
  });
  if (exported.outcome !== "exported") return exported;

  return {
    outcome: "exported",
    package: { formatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, manifest: exported.manifest, ciphertext: exported.ciphertext },
  };
}
