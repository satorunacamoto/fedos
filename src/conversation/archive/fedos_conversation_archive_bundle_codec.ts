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

/** Canonicalizes `bundle` into deterministic byte form: fixed top-level field order, every nested list sorted by its own natural key. */
export function serializeFedosConversationArchiveBundleToBytes(bundle: FedosConversationArchiveBundleV1): Uint8Array {
  const canonical = {
    schemaVersion: bundle.schemaVersion,
    conversationId: bundle.conversationId,
    exportedAt: bundle.exportedAt,
    conversation: bundle.conversation,
    memberships: [...bundle.memberships].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    capabilityEvents: [...bundle.capabilityEvents].sort((a, b) => {
      const keyA = fedosConversationCapabilityEventKey(a);
      const keyB = fedosConversationCapabilityEventKey(b);
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    }),
    envelopes: [...bundle.envelopes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    payloads: [...bundle.payloads].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
  return new TextEncoder().encode(JSON.stringify(canonical));
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
}

/** Coarse, structural-only decode — see this file's own header for why deep per-record validation is deliberately NOT performed here. Fails closed to `null`, never throws. */
export function deserializeFedosConversationArchiveBundleFromBytes(bytes: Uint8Array): FedosConversationArchiveBundleV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const keys = Object.keys(parsed);
  if (!keys.every((key) => TOP_LEVEL_KEYS.has(key)) || keys.length !== TOP_LEVEL_KEYS.size) return null;

  const { schemaVersion, conversationId, exportedAt, conversation, memberships, capabilityEvents, envelopes, payloads } =
    parsed as RawTopLevelFields;

  if (schemaVersion !== FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION) return null;
  if (typeof conversationId !== "string") return null;
  if (typeof exportedAt !== "number") return null;
  if (conversation === null || typeof conversation !== "object") return null;
  if (!Array.isArray(memberships)) return null;
  if (!Array.isArray(capabilityEvents)) return null;
  if (!Array.isArray(envelopes)) return null;
  if (!Array.isArray(payloads)) return null;

  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId,
    exportedAt,
    conversation: conversation as FedosConversationArchiveBundleV1["conversation"],
    memberships: memberships as FedosConversationArchiveBundleV1["memberships"],
    capabilityEvents: capabilityEvents as FedosConversationArchiveBundleV1["capabilityEvents"],
    envelopes: envelopes as FedosConversationArchiveBundleV1["envelopes"],
    payloads: payloads as FedosConversationArchiveBundleV1["payloads"],
  };
}
