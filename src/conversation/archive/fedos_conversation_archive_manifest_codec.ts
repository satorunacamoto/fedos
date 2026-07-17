/**
 * Secure Runtime Alpha 1541–1610 ("Conversation Export, Restore, Archive
 * Foundation") — Archive Manifest Codec.
 *
 * The ONLY two functions permitted to build/decode a
 * `FedosConversationArchiveManifestV1` — mirrors every existing
 * `Persisted*V1` codec's own exact discipline (Alpha 750/826/836/858).
 *
 * `buildFedosConversationArchiveManifest` is the ONLY constructor for a
 * Manifest — computes every count directly from the bundle's own array
 * lengths and delegates the hash to
 * `computeFedosConversationArchiveContentHash` rather than trusting a
 * caller-supplied count/hash pair.
 *
 * HARD GUARDRAILS:
 *   - `deserializeFedosConversationArchiveManifest` fails closed: `null`
 *     for anything malformed, never throws.
 *   - `schemaVersion` checked EXACTLY against
 *     `FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION` — no silent migration.
 *   - Unknown top-level fields are REJECTED.
 *   - Every count must be a non-negative integer.
 */

import type { FedosConversationArchiveBundleV1 } from "./fedos_conversation_archive_bundle.js";
import { computeFedosConversationArchiveContentHash } from "./fedos_conversation_archive_integrity.js";
import type { FedosConversationArchiveManifestV1 } from "./fedos_conversation_archive_manifest.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "./fedos_conversation_archive_schema_version.js";

/** The ONLY constructor for a `FedosConversationArchiveManifestV1` — every count/hash is derived from `bundle` itself, never caller-supplied. */
export function buildFedosConversationArchiveManifest(bundle: FedosConversationArchiveBundleV1): FedosConversationArchiveManifestV1 {
  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId: bundle.conversationId,
    exportedAt: bundle.exportedAt,
    membershipCount: bundle.memberships.length,
    capabilityEventCount: bundle.capabilityEvents.length,
    envelopeCount: bundle.envelopes.length,
    payloadCount: bundle.payloads.length,
    contentHash: computeFedosConversationArchiveContentHash(bundle),
  };
}

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "conversationId",
  "exportedAt",
  "membershipCount",
  "capabilityEventCount",
  "envelopeCount",
  "payloadCount",
  "contentHash",
]);

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly conversationId: unknown;
  readonly exportedAt: unknown;
  readonly membershipCount: unknown;
  readonly capabilityEventCount: unknown;
  readonly envelopeCount: unknown;
  readonly payloadCount: unknown;
  readonly contentHash: unknown;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. */
export function deserializeFedosConversationArchiveManifest(record: unknown): FedosConversationArchiveManifestV1 | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => TOP_LEVEL_KEYS.has(key)) || keys.length !== TOP_LEVEL_KEYS.size) return null;

  const { schemaVersion, conversationId, exportedAt, membershipCount, capabilityEventCount, envelopeCount, payloadCount, contentHash } =
    record as RawTopLevelFields;

  if (schemaVersion !== FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION) return null;
  if (typeof conversationId !== "string" || conversationId.length === 0) return null;
  if (typeof exportedAt !== "number") return null;
  if (!isNonNegativeInteger(membershipCount)) return null;
  if (!isNonNegativeInteger(capabilityEventCount)) return null;
  if (!isNonNegativeInteger(envelopeCount)) return null;
  if (!isNonNegativeInteger(payloadCount)) return null;
  if (typeof contentHash !== "string" || contentHash.length === 0) return null;

  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId,
    exportedAt,
    membershipCount,
    capabilityEventCount,
    envelopeCount,
    payloadCount,
    contentHash,
  };
}
