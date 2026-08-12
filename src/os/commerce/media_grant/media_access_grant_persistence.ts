/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent G) — durable, append-only persistence for
 * `MediaAccessGrantEnvelope` (`./media_access_grant_types.ts`).
 *
 * Mirrors `../../messenger/sync/persistence/append_only_fedos_sync_journal_persistence.ts`'s
 * own NDJSON-backend discipline exactly, per this arc's own instruction to
 * follow that SAME convention (Agent D is not covering this new grant
 * type, so this file builds its own independent backend rather than
 * reaching into Agent D's in-flight persistence work): independent log
 * file, insert-only, deterministic replay, fail-closed on corruption (one
 * unparseable line, one off-schema line, or one irreconcilable duplicate
 * key throws unconditionally), zero new dependency, no compaction/delete/
 * rewrite, no path construction of its own beyond the caller-supplied
 * `filePath`.
 *
 * DEDUP KEY: every stored entry is keyed by `(mediaId, buyerPubkey,
 * orderId, grantVersion)` — see `mediaAccessGrantKey()`
 * (`./media_access_grant_types.ts`) for the triple, extended here with
 * `grantVersion` because, UNLIKE the Sync Journal's single-shot
 * `changeId`, a `MediaAccessGrant` triple legitimately has MULTIPLE valid
 * entries over time (one per issued/superseding/revoking version) — this
 * backend keeps every one, forever, exactly as `./media_access_grant_types.ts`'s
 * own header requires ("revocation as a new version... a real, replayable
 * audit trail, not a destructive edit").
 *
 * WHAT THIS BACKEND DOES NOT DO: it does not verify signatures and does
 * not apply `evaluateMediaAccessGrant()`'s business rules — it only
 * durably stores and structurally validates candidate envelopes (mirrors
 * `AppendOnlyFedosSyncJournalPersistence`'s own "storage, not authority"
 * scope). A caller MUST still run every replayed envelope through
 * `evaluateMediaAccessGrant()` before treating it as a real access
 * decision; `latestGrantVersion()` below exists specifically to feed that
 * function's own `latestKnownGrantVersion` input.
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  isWellFormedMediaAccessGrantPayload,
  mediaAccessGrantKey,
  type MediaAccessGrantEnvelope,
} from "./media_access_grant_types.js";

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

/**
 * Minimal structural gate applied to every replayed line — mirrors
 * `verifyMediaAccessGrantEnvelope()`'s own `isWellFormedEnvelopeShape()`
 * check but is intentionally NOT that function itself (this backend does
 * not check signatures — see this file's own header). A line whose
 * top-level shape or payload shape is off-schema is corruption, exactly
 * like a JSON-parse failure; a line with a syntactically valid but
 * cryptographically wrong signature is NOT corruption here (that is
 * `evaluateMediaAccessGrant()`'s job at read time) and is stored as-is.
 */
function isStructurallyWellFormedEnvelope(value: unknown): value is MediaAccessGrantEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.version !== "number") return false;
  if (typeof candidate.type !== "string" || candidate.type.length === 0) return false;
  if (typeof candidate.issuer !== "string" || candidate.issuer.length === 0) return false;
  if (typeof candidate.issuedAt !== "number") return false;
  if (typeof candidate.signatureAlgorithm !== "string" || candidate.signatureAlgorithm.length === 0) return false;
  if (typeof candidate.keyId !== "string" || candidate.keyId.length === 0) return false;
  if (typeof candidate.signature !== "string" || candidate.signature.length === 0) return false;
  return isWellFormedMediaAccessGrantPayload(candidate.payload);
}

/** `(mediaId, buyerPubkey, orderId, grantVersion)` — the FULL dedup key this backend stores by. */
function entryStorageKey(envelope: MediaAccessGrantEnvelope): string {
  return `${mediaAccessGrantKey(envelope.payload)}#${envelope.payload.grantVersion}`;
}

function envelopesAreEqual(a: MediaAccessGrantEnvelope, b: MediaAccessGrantEnvelope): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * PRIVATE — replays the append log into a deduplicated array, in the
 * ORIGINAL append order (never re-sorted: unlike the Sync Journal's
 * numeric `sequence`, grant history has no single global order that
 * matters across different `(mediaId, buyerPubkey, orderId)` triples —
 * callers that care about per-triple ordering use `grantVersion`, not
 * file position). A parse failure, an off-schema line, or two DIFFERENT
 * envelopes claiming the identical `(mediaId, buyerPubkey, orderId,
 * grantVersion)` key throws unconditionally — fail-closed on corruption,
 * exactly like every sibling append-only backend in this codebase.
 */
function replayLog(filePath: string): MediaAccessGrantEnvelope[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, MediaAccessGrantEnvelope>();
  const order: string[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (!isStructurallyWellFormedEnvelope(parsedJson)) {
      throw new Error("AppendOnlyMediaAccessGrantPersistence: corrupt or schema-invalid record found in log file.");
    }
    const key = entryStorageKey(parsedJson);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsedJson);
      order.push(key);
    } else if (!envelopesAreEqual(existing, parsedJson)) {
      throw new Error(`AppendOnlyMediaAccessGrantPersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return order.map((key) => byKey.get(key) as MediaAccessGrantEnvelope);
}

export type MediaAccessGrantPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface MediaAccessGrantPersistence {
  /** Durably records one grant envelope. `"already-present"` for a byte-identical duplicate of an existing `(mediaId, buyerPubkey, orderId, grantVersion)`; `"conflict"` for a DIFFERENT envelope reusing that same key — never silently overwritten. */
  putGrant(envelope: MediaAccessGrantEnvelope): MediaAccessGrantPersistenceWriteResult;
  /** Every durably recorded envelope, deduplicated by `(mediaId, buyerPubkey, orderId, grantVersion)`, in append order. A backend fails closed (throws) on structurally corrupt or irreconcilably conflicting stored content. */
  listGrants(): readonly MediaAccessGrantEnvelope[];
}

export class AppendOnlyMediaAccessGrantPersistence implements MediaAccessGrantPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putGrant(envelope: MediaAccessGrantEnvelope): MediaAccessGrantPersistenceWriteResult {
    const key = entryStorageKey(envelope);
    const existing = replayLog(this.#filePath).find((e) => entryStorageKey(e) === key) ?? null;
    if (existing !== null) {
      return envelopesAreEqual(existing, envelope) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(envelope) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  listGrants(): readonly MediaAccessGrantEnvelope[] {
    return replayLog(this.#filePath);
  }
}

/**
 * Highest `grantVersion` found among all STRUCTURALLY well-formed envelopes
 * for one `(mediaId, buyerPubkey, orderId)` triple in `entries` — the
 * exact value `evaluateMediaAccessGrant()`'s own `latestKnownGrantVersion`
 * input expects. Returns `0` when no entry exists for the triple (meaning
 * "no version has ever been seen yet", so any candidate `grantVersion >= 1`
 * passes that gate). Does NOT verify signatures — a forged high-version
 * envelope could inflate this number, but `evaluateMediaAccessGrant()`
 * always verifies the CANDIDATE it is asked to judge independently, so an
 * attacker gains nothing by polluting this count beyond making their OWN
 * later (legitimately signed) grants look superseded — a self-defeating
 * attack, not a privilege escalation.
 */
export function latestGrantVersion(
  entries: readonly MediaAccessGrantEnvelope[],
  mediaId: string,
  buyerPubkey: string,
  orderId: string,
): number {
  const targetKey = mediaAccessGrantKey({ mediaId, buyerPubkey, orderId });
  let max = 0;
  for (const entry of entries) {
    if (mediaAccessGrantKey(entry.payload) !== targetKey) continue;
    if (entry.payload.grantVersion > max) max = entry.payload.grantVersion;
  }
  return max;
}
