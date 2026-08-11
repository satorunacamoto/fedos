/**
 * Secure Runtime Alpha 1541–1610 ("Conversation Export, Restore, Archive
 * Foundation") — Archive Bundle Codec.
 *
 * Converts a `FedosConversationArchiveBundleV1` to/from the canonical
 * byte form this Arc hashes (`fedos_conversation_archive_integrity.ts`)
 * and encrypts (`fedos_conversation_archive_encryption.ts`).
 *
 * Unlike `encodeFedosConversationEnvelopeAssociatedData()`'s own
 * length-prefixed BINARY encoding (Alpha 856 — chosen there because
 * that header's fields could legitimately contain the `::` separator a
 * naive delimiter-joined text encoding would collide on), this codec
 * uses `JSON.stringify` over an object THIS FILE ITSELF constructs
 * fresh, in one fixed field order, every call — a safe, deterministic
 * use of `JSON.stringify` (whose insertion-order-preserving behavior
 * for string keys is spec-guaranteed) specifically BECAUSE the object's
 * shape is never taken from external/untrusted input, unlike the
 * associated-data header's own caller-supplied-field concern. Array
 * order is independently made deterministic by sorting every nested
 * list by its own natural key (`id`, or the composite Capability event
 * key) BEFORE serializing — necessary because two different backends,
 * or the same backend at two different points in time, may otherwise
 * enumerate identical content in different orders (`Map` iteration
 * order, NDJSON append order), which would make the Integrity hash
 * (`./fedos_conversation_archive_integrity.ts`) a function of
 * enumeration order rather than of CONTENT.
 *
 * `deserializeFedosConversationArchiveBundleFromBytes` performs only
 * COARSE, structural validation (JSON parses; top-level shape/keys;
 * `schemaVersion` matches; every nested list is itself an array) — it
 * deliberately does NOT deep-validate every nested record, since doing
 * so would require re-implementing every one of the five reused
 * domains' own existing field-level validators. Deep, per-record
 * validation is Restore's own job
 * (`fedos_conversation_archive_restore.ts`), which reuses each domain's
 * EXISTING `deserializeX`/`validateX` function directly rather than
 * duplicating any check here — the same "coarse-then-fine,
 * never-duplicated" layering `fedos_conversation_archive_manifest_codec.ts`
 * also follows.
 *
 * HARD GUARDRAILS:
 *   - `deserializeFedosConversationArchiveBundleFromBytes` fails closed:
 *     `null` for anything malformed, never throws.
 *   - `schemaVersion` checked EXACTLY against
 *     `FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION` — no silent migration.
 *   - Unknown top-level fields are REJECTED.
 *   - Pure, deterministic, synchronous.
 */

import { fedosConversationCapabilityEventKey } from "../capability/persistence/fedos_conversation_capability_persistence.js";
import type { FedosConversationArchiveBundleV1 } from "./fedos_conversation_archive_bundle.js";
import type { FedosConversationArchiveGroupSectionV1 } from "./fedos_conversation_archive_group_section.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "./fedos_conversation_archive_schema_version.js";

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "conversationId",
  "exportedAt",
  "conversation",
  "memberships",
  "capabilityEvents",
  "envelopes",
  "payloads",
]);

/** Secure Runtime Alpha 1921–1980 — the ONE new optional top-level key. Never REQUIRED (see this file's own header, "old Direct archives remain readable"). */
const GROUP_KEY = "group";

const GROUP_SECTION_KEYS: ReadonlySet<string> = new Set(["generations", "paths", "messages", "fanoutDeliveries", "childConversations"]);

function byNaturalKey<T>(key: (value: T) => string): (a: T, b: T) => number {
  return (a, b) => {
    const keyA = key(a);
    const keyB = key(b);
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  };
}

/** Canonicalizes a Group Section into deterministic, JSON-serializable plain data — every nested list sorted by its own natural key, mirroring the bundle's own top-level discipline. Recurses into each child conversation bundle via `canonicalizeBundle` itself. */
function canonicalizeGroupSection(group: FedosConversationArchiveGroupSectionV1): Record<string, unknown> {
  return {
    generations: [...group.generations].sort((a, b) => a.generationNumber - b.generationNumber),
    paths: [...group.paths].sort(byNaturalKey((p) => p.pathId)),
    messages: [...group.messages].sort(byNaturalKey((m) => m.id)),
    fanoutDeliveries: [...group.fanoutDeliveries].sort(byNaturalKey((d) => `${d.groupMessageId}::${d.recipientMembershipId}`)),
    childConversations: [...group.childConversations].sort(byNaturalKey((c) => c.conversationId)).map(canonicalizeBundle),
  };
}

/** Canonicalizes `bundle` into a plain, deterministic, JSON-serializable object: fixed top-level field order, every nested list sorted by its own natural key. Recursive — a Group Section's own `childConversations` are each canonicalized identically. */
function canonicalizeBundle(bundle: FedosConversationArchiveBundleV1): Record<string, unknown> {
  const canonical: Record<string, unknown> = {
    schemaVersion: bundle.schemaVersion,
    conversationId: bundle.conversationId,
    exportedAt: bundle.exportedAt,
    conversation: bundle.conversation,
    memberships: [...bundle.memberships].sort(byNaturalKey((m) => m.id)),
    capabilityEvents: [...bundle.capabilityEvents].sort(byNaturalKey(fedosConversationCapabilityEventKey)),
    envelopes: [...bundle.envelopes].sort(byNaturalKey((e) => e.id)),
    payloads: [...bundle.payloads].sort(byNaturalKey((p) => p.id)),
  };
  // Alpha 1921-1980 -- the key is omitted ENTIRELY when absent, so a Direct-only bundle serializes
  // BYTE-FOR-BYTE identically to every Archive this codebase produced before this Arc (see this
  // file's own header and the Phase I compatibility regression test).
  if (bundle.group !== undefined) {
    canonical.group = canonicalizeGroupSection(bundle.group);
  }
  return canonical;
}

/** Canonicalizes `bundle` into deterministic byte form: fixed top-level field order, every nested list sorted by its own natural key. */
export function serializeFedosConversationArchiveBundleToBytes(bundle: FedosConversationArchiveBundleV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(canonicalizeBundle(bundle)));
}

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly conversationId: unknown;
  readonly exportedAt: unknown;
  readonly conversation: unknown;
  readonly memberships: unknown;
  readonly capabilityEvents: unknown;
  readonly envelopes: unknown;
  readonly payloads: unknown;
  readonly group?: unknown;
}

/** Coarse, structural-only decode of a Group Section value — array-shaped fields only; deep per-record validation is Restore's own job, exactly like every other domain (see this file's own header). Fails closed to `null`. Each `childConversations` entry recurses through `decodeBundleValue` itself. */
function decodeGroupSectionValue(value: unknown): FedosConversationArchiveGroupSectionV1 | null {
  if (value === null || typeof value !== "object") return null;
  const keys = Object.keys(value);
  if (!keys.every((key) => GROUP_SECTION_KEYS.has(key)) || keys.length !== GROUP_SECTION_KEYS.size) return null;

  const { generations, paths, messages, fanoutDeliveries, childConversations } = value as {
    readonly generations: unknown;
    readonly paths: unknown;
    readonly messages: unknown;
    readonly fanoutDeliveries: unknown;
    readonly childConversations: unknown;
  };
  if (!Array.isArray(generations)) return null;
  if (!Array.isArray(paths)) return null;
  if (!Array.isArray(messages)) return null;
  if (!Array.isArray(fanoutDeliveries)) return null;
  if (!Array.isArray(childConversations)) return null;

  const decodedChildren: FedosConversationArchiveBundleV1[] = [];
  for (const child of childConversations) {
    const decodedChild = decodeBundleValue(child);
    if (decodedChild === null) return null; // fail closed -- one malformed child voids the whole Archive.
    decodedChildren.push(decodedChild);
  }

  return {
    generations: generations as FedosConversationArchiveGroupSectionV1["generations"],
    paths: paths as FedosConversationArchiveGroupSectionV1["paths"],
    messages: messages as FedosConversationArchiveGroupSectionV1["messages"],
    fanoutDeliveries: fanoutDeliveries as FedosConversationArchiveGroupSectionV1["fanoutDeliveries"],
    childConversations: decodedChildren,
  };
}

/** Coarse, structural-only decode of an already-`JSON.parse`d value — see this file's own header for why deep per-record validation is deliberately NOT performed here. Fails closed to `null`, never throws. Shared by the top-level decode below and, recursively, by every Group Section child conversation. */
function decodeBundleValue(parsed: unknown): FedosConversationArchiveBundleV1 | null {
  if (parsed === null || typeof parsed !== "object") return null;
  const keys = Object.keys(parsed);
  const hasGroup = keys.includes(GROUP_KEY);
  const expectedSize = TOP_LEVEL_KEYS.size + (hasGroup ? 1 : 0);
  if (!keys.every((key) => TOP_LEVEL_KEYS.has(key) || key === GROUP_KEY) || keys.length !== expectedSize) return null;

  const { schemaVersion, conversationId, exportedAt, conversation, memberships, capabilityEvents, envelopes, payloads, group } =
    parsed as RawTopLevelFields;

  if (schemaVersion !== FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION) return null;
  if (typeof conversationId !== "string") return null;
  if (typeof exportedAt !== "number") return null;
  if (conversation === null || typeof conversation !== "object") return null;
  if (!Array.isArray(memberships)) return null;
  if (!Array.isArray(capabilityEvents)) return null;
  if (!Array.isArray(envelopes)) return null;
  if (!Array.isArray(payloads)) return null;

  let decodedGroup: FedosConversationArchiveGroupSectionV1 | undefined;
  if (hasGroup) {
    const result = decodeGroupSectionValue(group);
    if (result === null) return null;
    decodedGroup = result;
  }

  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId,
    exportedAt,
    conversation: conversation as FedosConversationArchiveBundleV1["conversation"],
    memberships: memberships as FedosConversationArchiveBundleV1["memberships"],
    capabilityEvents: capabilityEvents as FedosConversationArchiveBundleV1["capabilityEvents"],
    envelopes: envelopes as FedosConversationArchiveBundleV1["envelopes"],
    payloads: payloads as FedosConversationArchiveBundleV1["payloads"],
    ...(decodedGroup !== undefined ? { group: decodedGroup } : {}),
  };
}

/** Coarse, structural-only decode — see this file's own header for why deep per-record validation is deliberately NOT performed here. Fails closed to `null`, never throws. */
export function deserializeFedosConversationArchiveBundleFromBytes(bytes: Uint8Array): FedosConversationArchiveBundleV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  return decodeBundleValue(parsed);
}
