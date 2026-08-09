/**
 * Secure Runtime Alpha 2341–2420 ("Conversation Archive CLI and User
 * Packaging") — CLI Metadata / Inspect / Summary / Version / Hash
 * Verification.
 *
 * Every function here is PURE and SYNCHRONOUS — no key resolution, no
 * decrypt, no persistence — because a `FedosConversationArchiveManifestV1`
 * ALREADY travels in the clear alongside its ciphertext (Alpha
 * 1541–1610's own "Sealed Master Seed Envelope cost-params" precedent,
 * `../archive/fedos_conversation_archive_manifest.ts`'s own header): a
 * caller can inspect record counts, ids, and hashes for a Package it
 * has never decrypted and holds no key for at all.
 *
 *   - "archive metadata"        -- `fedosConversationArchiveCliPackageManifest`
 *     (a one-line accessor, named as its own function so a caller never
 *     reaches into `package.manifest` by hand at more than one call
 *     site).
 *   - "archive inspect"         -- `describeFedosConversationArchiveCliPackage`
 *     (human-readable, multi-line).
 *   - "archive summary"         -- `summarizeFedosConversationArchiveCliManifests`
 *     (aggregate over many Manifests — "archive list"'s own numeric
 *     rollup).
 *   - "archive version display" -- `FEDOS_CONVERSATION_ARCHIVE_CLI_VERSION_INFO`.
 *   - "archive hash verification" -- `fedosConversationArchiveCliContentHashMatches`,
 *     a thin, named wrapper over the EXISTING
 *     `computeFedosConversationArchiveContentHash`/
 *     `fedosConversationArchiveContentHashesAreEqual`
 *     (`../archive/fedos_conversation_archive_integrity.ts`, Alpha
 *     1541–1610, unchanged) for a caller that already holds a decrypted
 *     bundle and a manifest and wants to re-check the binding WITHOUT
 *     going through the full async `authority.import()` path again
 *     (`../archive_cli/fedos_conversation_archive_cli_import.ts`'s own
 *     "archive verify" already does that full path; this is the
 *     narrower, synchronous, already-decrypted-bundle case).
 *
 * HARD GUARDRAILS:
 *   - No function in this file ever accepts or returns key material or
 *     ciphertext bytes it would need to interpret.
 *   - Pure, deterministic, synchronous, never throws.
 */

import { computeFedosConversationArchiveContentHash, fedosConversationArchiveContentHashesAreEqual } from "../../../../conversation/archive/fedos_conversation_archive_integrity.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../../../../conversation/archive/fedos_conversation_archive_schema_version.js";
import type { FedosConversationArchiveBundleV1 } from "../../../../conversation/archive/fedos_conversation_archive_bundle.js";
import type { FedosConversationArchiveManifestV1 } from "../../../../conversation/archive/fedos_conversation_archive_manifest.js";
import { FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, type FedosConversationArchiveCliPackageV1 } from "../../../../conversation/archive_cli/fedos_conversation_archive_cli_package.js";

/** "archive version display" — this Arc's own CLI packaging format version, alongside the (unmodified) Archive schema version it packages. */
export const FEDOS_CONVERSATION_ARCHIVE_CLI_VERSION_INFO = {
  packageFormatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION,
  archiveSchemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
} as const;

/** "archive metadata" — the Manifest a Package already carries in the clear. */
export function fedosConversationArchiveCliPackageManifest(pkg: FedosConversationArchiveCliPackageV1): FedosConversationArchiveManifestV1 {
  return pkg.manifest;
}

/** "archive inspect" — a human-readable, multi-line rendering of a Package's own cleartext Manifest. Never decrypts. */
export function describeFedosConversationArchiveCliPackage(pkg: FedosConversationArchiveCliPackageV1): string {
  const m = pkg.manifest;
  return [
    `conversationId: ${m.conversationId}`,
    `exportedAt: ${new Date(m.exportedAt).toISOString()}`,
    `schemaVersion: ${m.schemaVersion} (package formatVersion: ${pkg.formatVersion})`,
    `memberships: ${m.membershipCount}`,
    `capabilityEvents: ${m.capabilityEventCount}`,
    `envelopes: ${m.envelopeCount}`,
    `payloads: ${m.payloadCount}`,
    `contentHash: ${m.contentHash}`,
  ].join("\n");
}

export interface FedosConversationArchiveCliManifestSummary {
  readonly conversationCount: number;
  readonly totalMembershipCount: number;
  readonly totalCapabilityEventCount: number;
  readonly totalEnvelopeCount: number;
  readonly totalPayloadCount: number;
  readonly earliestExportedAt: number | null;
  readonly latestExportedAt: number | null;
}

/** "archive summary" — an aggregate rollup over many Manifests (e.g. every Package a "directory list"/"archive list" call turned up). `null` earliest/latest for an empty input — fails closed rather than guessing a sentinel timestamp. */
export function summarizeFedosConversationArchiveCliManifests(manifests: readonly FedosConversationArchiveManifestV1[]): FedosConversationArchiveCliManifestSummary {
  let totalMembershipCount = 0;
  let totalCapabilityEventCount = 0;
  let totalEnvelopeCount = 0;
  let totalPayloadCount = 0;
  let earliestExportedAt: number | null = null;
  let latestExportedAt: number | null = null;

  for (const manifest of manifests) {
    totalMembershipCount += manifest.membershipCount;
    totalCapabilityEventCount += manifest.capabilityEventCount;
    totalEnvelopeCount += manifest.envelopeCount;
    totalPayloadCount += manifest.payloadCount;
    earliestExportedAt = earliestExportedAt === null ? manifest.exportedAt : Math.min(earliestExportedAt, manifest.exportedAt);
    latestExportedAt = latestExportedAt === null ? manifest.exportedAt : Math.max(latestExportedAt, manifest.exportedAt);
  }

  return {
    conversationCount: manifests.length,
    totalMembershipCount,
    totalCapabilityEventCount,
    totalEnvelopeCount,
    totalPayloadCount,
    earliestExportedAt,
    latestExportedAt,
  };
}

/** "archive hash verification" — re-checks an ALREADY-DECRYPTED `bundle` against `manifest.contentHash`, reusing Integrity's own hash function/comparator verbatim. For the still-sealed case, "archive verify" (`./fedos_conversation_archive_cli_import.ts`) already performs this same check as part of a full decrypt. */
export function fedosConversationArchiveCliContentHashMatches(bundle: FedosConversationArchiveBundleV1, manifest: FedosConversationArchiveManifestV1): boolean {
  return fedosConversationArchiveContentHashesAreEqual(computeFedosConversationArchiveContentHash(bundle), manifest.contentHash);
}
