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
  const base: FedosConversationArchiveManifestV1 = {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId: bundle.conversationId,
    exportedAt: bundle.exportedAt,
    membershipCount: bundle.memberships.length,
    capabilityEventCount: bundle.capabilityEvents.length,
    envelopeCount: bundle.envelopes.length,
    payloadCount: bundle.payloads.length,
    contentHash: computeFedosConversationArchiveContentHash(bundle),
  };
  if (bundle.group === undefined) return base;

  const group = bundle.group;
  const groupChildRecordCount = group.childConversations.reduce(
    (sum, child) => sum + child.memberships.length + child.capabilityEvents.length + child.envelopes.length + child.payloads.length,
    0,
  );
  return {
    ...base,
    groupGenerationCount: group.generations.length,
    groupPathCount: group.paths.length,
    groupMessageCount: group.messages.length,
    groupFanoutDeliveryCount: group.fanoutDeliveries.length,
    groupChildConversationCount: group.childConversations.length,
    groupChildRecordCount,
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

/** Secure Runtime Alpha 1921–1980 — the SIX new optional keys, present ALL-OR-NOTHING (a partial subset is malformed and rejected). */
const GROUP_KEYS: readonly string[] = [
  "groupGenerationCount",
  "groupPathCount",
  "groupMessageCount",
  "groupFanoutDeliveryCount",
  "groupChildConversationCount",
  "groupChildRecordCount",
];
const GROUP_KEY_SET: ReadonlySet<string> = new Set(GROUP_KEYS);

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly conversationId: unknown;
  readonly exportedAt: unknown;
  readonly membershipCount: unknown;
  readonly capabilityEventCount: unknown;
  readonly envelopeCount: unknown;
  readonly payloadCount: unknown;
  readonly contentHash: unknown;
  readonly groupGenerationCount?: unknown;
  readonly groupPathCount?: unknown;
  readonly groupMessageCount?: unknown;
  readonly groupFanoutDeliveryCount?: unknown;
  readonly groupChildConversationCount?: unknown;
  readonly groupChildRecordCount?: unknown;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. */
export function deserializeFedosConversationArchiveManifest(record: unknown): FedosConversationArchiveManifestV1 | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  const presentGroupKeys = keys.filter((key) => GROUP_KEY_SET.has(key));
  // All-or-nothing: a partial subset of the six Group keys is malformed, fails closed.
  if (presentGroupKeys.length !== 0 && presentGroupKeys.length !== GROUP_KEYS.length) return null;
  const hasGroup = presentGroupKeys.length === GROUP_KEYS.length;
  const expectedSize = TOP_LEVEL_KEYS.size + (hasGroup ? GROUP_KEYS.length : 0);
  if (!keys.every((key) => TOP_LEVEL_KEYS.has(key) || GROUP_KEY_SET.has(key)) || keys.length !== expectedSize) return null;

  const {
    schemaVersion,
    conversationId,
    exportedAt,
    membershipCount,
    capabilityEventCount,
    envelopeCount,
    payloadCount,
    contentHash,
    groupGenerationCount,
    groupPathCount,
    groupMessageCount,
    groupFanoutDeliveryCount,
    groupChildConversationCount,
    groupChildRecordCount,
  } = record as RawTopLevelFields;

  if (schemaVersion !== FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION) return null;
  if (typeof conversationId !== "string" || conversationId.length === 0) return null;
  if (typeof exportedAt !== "number") return null;
  if (!isNonNegativeInteger(membershipCount)) return null;
  if (!isNonNegativeInteger(capabilityEventCount)) return null;
  if (!isNonNegativeInteger(envelopeCount)) return null;
  if (!isNonNegativeInteger(payloadCount)) return null;
  if (typeof contentHash !== "string" || contentHash.length === 0) return null;

  const base: FedosConversationArchiveManifestV1 = {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId,
    exportedAt,
    membershipCount,
    capabilityEventCount,
    envelopeCount,
    payloadCount,
    contentHash,
  };
  if (!hasGroup) return base;

  if (!isNonNegativeInteger(groupGenerationCount)) return null;
  if (!isNonNegativeInteger(groupPathCount)) return null;
  if (!isNonNegativeInteger(groupMessageCount)) return null;
  if (!isNonNegativeInteger(groupFanoutDeliveryCount)) return null;
  if (!isNonNegativeInteger(groupChildConversationCount)) return null;
  if (!isNonNegativeInteger(groupChildRecordCount)) return null;

  return {
    ...base,
    groupGenerationCount,
    groupPathCount,
    groupMessageCount,
    groupFanoutDeliveryCount,
    groupChildConversationCount,
    groupChildRecordCount,
  };
}
