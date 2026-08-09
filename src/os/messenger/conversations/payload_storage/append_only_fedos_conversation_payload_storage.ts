/**
 * Secure Runtime Alpha 808 ("Append-Only Payload Storage Decision") /
 * Alpha 809 ("Append-Only Implementation") — Stages 18-19 of the Alpha
 * 791–820 Conversation Retention & Private Payload Storage Boundary
 * Foundation Arc.
 *
 * Alpha 808 compares:
 *   A. payload bytes inline in JSON Lines (base64-encoded) — ADOPTED.
 *      One `FedosPersistedConversationPayloadV1` record per line,
 *      mirroring `AppendOnlyFedosConversationPersistence`'s own exact
 *      NDJSON discipline (Alpha 752). Smallest, zero-dependency V1;
 *      no path-traversal surface at all (a single log file, no
 *      per-payload filename ever derived from a payload id).
 *   B. metadata log + separate blob files — a real future upgrade path
 *      for larger payloads (noted, not built — this Arc's own
 *      instruction: "do not overbuild without current requirements";
 *      no private-message content exists yet to size against).
 *   C. one file per payload — REJECTED for V1: would need a
 *      payload-id-to-filename mapping and its own path-traversal
 *      defense surface, when Option A already avoids the problem
 *      entirely for typical V1 payload sizes.
 *   D. reuse the Conversation log — REJECTED per this Arc's own
 *      Absolute Prohibition (never duplicate/conflate Conversation
 *      metadata persistence with payload bytes).
 *
 * CRASH REVIEW: identical policy to Alpha 357/752 — "fail closed, never
 * repair automatically." An empty/missing file is NOT corruption. A
 * non-blank line that fails `JSON.parse`, or one that parses but fails
 * `deserializeFedosConversationPayload` (invalid base64, byteLength
 * mismatch, unknown schema), THROWS on read — no special-casing of a
 * trailing partial write versus a mid-file corrupt record, the same
 * reasoning Alpha 357 gives for Board persistence. Two lines sharing
 * the same `id` with identical content collapse (idempotent); with
 * different content, replay THROWS rather than silently picking a
 * winner.
 *
 * HARD GUARDRAILS:
 *   - `AppendOnlyFedosConversationPayloadStorage` is the ONLY export.
 *   - Implements `FedosConversationPayloadStorage` (Alpha 804) verbatim
 *     — no delete/compaction/rewrite method of any kind.
 *   - The constructor performs NO filesystem I/O — only stores the
 *     given file path and `maxPayloadByteLength`.
 *   - `maxPayloadByteLength` is a REQUIRED constructor parameter — this
 *     Arc does not invent an arbitrary default maximum without
 *     repository precedent (Alpha 805's own instruction); a caller must
 *     make an explicit, informed choice. A `putPayload` call whose
 *     `bytes.length` exceeds it is rejected with `"failed"`, never
 *     silently truncated.
 *   - NO external dependency — `node:fs`/`node:buffer` only, reached
 *     the SAME untyped way every other backend in this codebase
 *     already does.
 *   - No logging of byte content anywhere in this file.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosConversationPayloadBytesAreEqual,
  fedosConversationPayloadDescriptorsAreEqual,
  type FedosConversationPayload,
  type FedosConversationPayloadStorage,
  type FedosConversationPayloadStorageWriteResult,
} from "./fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadDescriptor } from "./fedos_conversation_payload_descriptor.js";
import type { FedosConversationPayloadId } from "./fedos_conversation_payload_id.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosPersistedConversationPayloadV1 } from "./fedos_persisted_conversation_payload_v1.js";
import {
  deserializeFedosConversationPayload,
  serializeFedosConversationPayload,
} from "./fedos_conversation_payload_codec.js";

/** PRIVATE — narrow, dependency-free check for a Node `ENOENT` error, without `@types/node`. Mirrors every other backend's own identical helper. */
function isEnoent(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

/** PRIVATE — replays the append log into a deduplicated array of payloads, in on-disk order. A parse/decode failure throws unconditionally (see this file's own header). */
function replayLog(filePath: string): FedosConversationPayload[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosConversationPayload>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationPayloadV1;
    const payload = deserializeFedosConversationPayload(parsed);
    if (payload === null) {
      throw new Error("AppendOnlyFedosConversationPayloadStorage: corrupt or invalid record found in log file.");
    }
    const existing = byId.get(payload.descriptor.id);
    if (existing === undefined) {
      byId.set(payload.descriptor.id, payload);
    } else if (
      !fedosConversationPayloadDescriptorsAreEqual(existing.descriptor, payload.descriptor) ||
      !fedosConversationPayloadBytesAreEqual(existing.bytes, payload.bytes)
    ) {
      throw new Error(
        `AppendOnlyFedosConversationPayloadStorage: conflicting duplicate records for id "${String(payload.descriptor.id)}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosConversationPayloadStorage implements FedosConversationPayloadStorage {
  readonly #filePath: string;
  readonly #maxPayloadByteLength: number;

  constructor(filePath: string, maxPayloadByteLength: number) {
    this.#filePath = filePath;
    this.#maxPayloadByteLength = maxPayloadByteLength;
  }

  putPayload(descriptor: FedosConversationPayloadDescriptor, bytes: Uint8Array): FedosConversationPayloadStorageWriteResult {
    if (bytes.length > this.#maxPayloadByteLength) return "failed";
    if (bytes.length !== descriptor.byteLength) return "failed";

    const existing = this.getPayload(descriptor.id);
    if (existing !== null) {
      const sameDescriptor = fedosConversationPayloadDescriptorsAreEqual(existing.descriptor, descriptor);
      const sameBytes = fedosConversationPayloadBytesAreEqual(existing.bytes, bytes);
      return sameDescriptor && sameBytes ? "already-present" : "conflict";
    }

    const persisted = serializeFedosConversationPayload({ descriptor, bytes });
    try {
      appendFileSync(this.#filePath, JSON.stringify(persisted) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getPayload(id: FedosConversationPayloadId): FedosConversationPayload | null {
    const found = replayLog(this.#filePath).find((payload) => payload.descriptor.id === id) ?? null;
    if (found === null) return null;
    return { descriptor: found.descriptor, bytes: Uint8Array.from(found.bytes) };
  }

  getDescriptor(id: FedosConversationPayloadId): FedosConversationPayloadDescriptor | null {
    return this.getPayload(id)?.descriptor ?? null;
  }

  listConversationPayloads(conversationId: FedosConversationId): readonly FedosConversationPayloadDescriptor[] {
    return replayLog(this.#filePath)
      .filter((payload) => payload.descriptor.conversationId === conversationId)
      .map((payload) => payload.descriptor);
  }
}
