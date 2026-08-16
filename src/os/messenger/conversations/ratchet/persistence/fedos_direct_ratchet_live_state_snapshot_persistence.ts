/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — a small, additive, CURRENT-VALUE
 * sealed-state snapshot port this integration Arc needs and no earlier
 * Arc's own port can represent.
 *
 * The Foundation Arc's own dedicated `FedosSealedDirectRatchetSecretPersistence`
 * (`./fedos_sealed_direct_ratchet_secret_persistence.js`, Alpha 5401–5480)
 * is DELIBERATELY insert-only, one fixed key per
 * `(sessionId, secretKind, generation)` for every kind except
 * `"skipped-message-key"` (`chainCounter` is forced `null` for the other
 * four kinds by that file's own frozen validator) — correct for
 * `"skipped-message-key"` entries (each is a genuine one-shot event with
 * its own unique `chainCounter`, never re-written) but structurally unable
 * to represent the SENDING/RECEIVING CHAIN KEY, which the real Rust
 * ratchet core's own `encrypt()`/`decrypt()`
 * (`packages/fedos-core-rust/src/crypto/direct_ratchet_session.rs`)
 * genuinely advances on EVERY message within the SAME generation — a
 * second seal of a changed chain key under the identical
 * `(sessionId, secretKind, generation)` key would `"conflict"`, never
 * overwrite (confirmed by direct reproduction against the real Rust
 * boundary during this Arc's own development: a restored session built
 * from a STALE chain key snapshot combined with an up-to-date plain
 * counter decrypts/encrypts incorrectly, because `FedosDirectRatchetSession::restore()`
 * takes the given chain-key bytes literally — it never re-derives or
 * fast-forwards them from the counter).
 *
 * This port is therefore a CURRENT-VALUE cache (last-write-wins per
 * `sessionId`), not an event log — mirrors
 * `FedosDirectRatchetRemotePublicKeyPersistence`'s own identical
 * "one additive, small, dedicated port for one CURRENT public fact"
 * shape exactly, applied to the (still non-plaintext, still Rust-sealed)
 * chain-key/root-key/private-key hex strings instead of the remote
 * public key.
 *
 * Direct Ratchet Live-State Durability arc — TWO real problems in this
 * file's own PRIOR file-backed implementation, found by live-proof-driven
 * investigation before this arc's own wiring work landed, fixed here:
 *
 * 1. Forward-secrecy-at-rest: the prior `FileFedosDirectRatchetLiveStateSnapshotPersistence`
 *    was append-forever NDJSON, "last line wins" on read. That durably
 *    retains EVERY historical sealed root/chain-key value on disk
 *    forever — combined with Master Seed access, an attacker could
 *    decrypt the session's entire historical key sequence, defeating
 *    forward secrecy at rest even though in-memory forward secrecy holds.
 *    Worse, it was actively exploitable, not merely a passive-exposure
 *    risk: restoring/replaying an OLDER valid NDJSON line rolls the
 *    RUNNING session's chain key backward on the next lazy restore (a
 *    one-way hash-ratchet chain can always be walked forward again from
 *    an earlier position). Fixed below by atomic rewrite-in-place — one
 *    current record per `sessionId`, no historical lines ever retained,
 *    mirroring `FileFedosSealedMasterSeedEnvelopePersistence`'s own
 *    established durable-secret-port precedent (this codebase's
 *    documented atomic-rename discipline,
 *    `docs/secure_runtime_alpha_366_compaction_architecture_review.md`:
 *    `renameSync` is atomic on the same filesystem volume on both POSIX
 *    and Windows — a reader either sees the full old file or the full
 *    new file, never a half-written one).
 * 2. "Decrypts successfully" was implicitly treated as sufficient proof
 *    of restore FRESHNESS — it is not. A validly-sealed record can still
 *    be a stale chain position (see problem 1's own active-exploit case,
 *    and independently: a snapshot file replaced wholesale by an
 *    attacker with an old backup copy, which the storage-shape fix alone
 *    does NOT catch, since it operates only on the CURRENT file).
 *    Fixed below by embedding the `FedosDirectRatchetCounters` this
 *    snapshot was captured alongside INTO the snapshot record itself, so
 *    a caller can compare it against the SEPARATELY, durably-persisted
 *    session record's own `counters` (which `commitCounters()` writes
 *    durably strictly BEFORE this checkpoint on both send and receive
 *    paths — a real, independent, already-durable "ratchet position
 *    ceiling" this port's own storage-shape fix cannot itself forge) —
 *    see `restoreFedosDirectRatchetLiveStateSnapshotIfFresh()` below.
 *    A snapshot whose own embedded counters are BEHIND that ceiling in
 *    any dimension must never be restored, regardless of whether it
 *    decrypts.
 *
 * HARD GUARDRAILS (unchanged):
 *   - Every sealed field here is the SAME already-sealed (Rust
 *     `seal_direct_ratchet_secret`-produced) hex ciphertext
 *     `FedosDirectRatchetCryptographicSession.sealState()` already
 *     returns — this file never seals/unseals anything itself, and never
 *     carries a raw/plaintext key of any kind. The embedded `counters`
 *     field is NOT secret (it is the exact same non-secret shape already
 *     durably persisted in plain form by `FedosDirectRatchetSessionRecordV1.counters`)
 *     — embedding it here does not newly expose anything.
 *   - Last-write-wins per `sessionId` ONLY — never a delete, never a
 *     cross-session read.
 */

import { readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { isWellFormedFedosDirectRatchetCounters, type FedosDirectRatchetCounters } from "../fedos_direct_ratchet_counters.js";

export interface FedosDirectRatchetLiveStateSnapshotV1 {
  readonly schemaVersion: 1;
  readonly sealedRootKey: string;
  readonly sealedSendingChainKey: string | null;
  readonly sealedReceivingChainKey: string | null;
  readonly sealedLocalRatchetPrivateKey: string;
  /** The durable session counters this snapshot was captured alongside — see this file's own header, problem 2. Never itself secret. */
  readonly counters: FedosDirectRatchetCounters;
}

export interface FedosDirectRatchetLiveStateSnapshotPersistence {
  putSnapshot(sessionId: string, snapshot: FedosDirectRatchetLiveStateSnapshotV1): void;
  getSnapshot(sessionId: string): FedosDirectRatchetLiveStateSnapshotV1 | null;
}

export class InMemoryFedosDirectRatchetLiveStateSnapshotPersistence implements FedosDirectRatchetLiveStateSnapshotPersistence {
  readonly #snapshots = new Map<string, FedosDirectRatchetLiveStateSnapshotV1>();

  putSnapshot(sessionId: string, snapshot: FedosDirectRatchetLiveStateSnapshotV1): void {
    this.#snapshots.set(sessionId, snapshot);
  }

  getSnapshot(sessionId: string): FedosDirectRatchetLiveStateSnapshotV1 | null {
    return this.#snapshots.get(sessionId) ?? null;
  }
}

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

function isWellFormedSnapshot(candidate: unknown): candidate is FedosDirectRatchetLiveStateSnapshotV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (typeof r.sealedRootKey !== "string" || r.sealedRootKey.length === 0) return false;
  if (r.sealedSendingChainKey !== null && typeof r.sealedSendingChainKey !== "string") return false;
  if (r.sealedReceivingChainKey !== null && typeof r.sealedReceivingChainKey !== "string") return false;
  if (typeof r.sealedLocalRatchetPrivateKey !== "string" || r.sealedLocalRatchetPrivateKey.length === 0) return false;
  if (!isWellFormedFedosDirectRatchetCounters(r.counters)) return false;
  return true;
}

/**
 * Restart-safe file-backed variant — one JSON object, keyed by `sessionId`,
 * rewritten ATOMICALLY (temp-file-then-rename, see this file's own header)
 * on every write. A current-value cache, not an event log: no historical
 * line for any `sessionId` is ever retained once superseded — this is the
 * whole point of the storage-shape fix this file's own header documents.
 */
export class FileFedosDirectRatchetLiveStateSnapshotPersistence implements FedosDirectRatchetLiveStateSnapshotPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  #readAll(): Record<string, FedosDirectRatchetLiveStateSnapshotV1> {
    let contents: string;
    try {
      contents = readFileSync(this.#filePath, "utf8") as string;
    } catch (err) {
      if (isEnoent(err)) return {};
      throw err;
    }
    if (contents.trim().length === 0) return {};
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      throw new Error(`FileFedosDirectRatchetLiveStateSnapshotPersistence: corrupt (invalid JSON) snapshot file at ${this.#filePath}.`);
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`FileFedosDirectRatchetLiveStateSnapshotPersistence: schema-invalid (not a plain object) snapshot file at ${this.#filePath}.`);
    }
    const result: Record<string, FedosDirectRatchetLiveStateSnapshotV1> = {};
    for (const [sessionId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isWellFormedSnapshot(value)) {
        throw new Error(`FileFedosDirectRatchetLiveStateSnapshotPersistence: schema-invalid snapshot record for sessionId "${sessionId}" in file at ${this.#filePath}.`);
      }
      result[sessionId] = value;
    }
    return result;
  }

  putSnapshot(sessionId: string, snapshot: FedosDirectRatchetLiveStateSnapshotV1): void {
    const all = this.#readAll();
    all[sessionId] = snapshot;
    const tempPath = `${this.#filePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(all), "utf8");
    try {
      renameSync(tempPath, this.#filePath);
    } catch (err) {
      try {
        unlinkSync(tempPath);
      } catch {
        /* best-effort cleanup of the temp file; the rename's own failure is the real error */
      }
      throw err;
    }
  }

  getSnapshot(sessionId: string): FedosDirectRatchetLiveStateSnapshotV1 | null {
    return this.#readAll()[sessionId] ?? null;
  }
}

export type FedosDirectRatchetLiveStateSnapshotFreshnessOutcome = "fresh" | "stale" | "not-found";

/**
 * Direct Ratchet Live-State Durability arc — acceptance matrix item 4
 * ("corrupt snapshot -> fail closed, `restore-attempted-and-failed`"):
 * `FileFedosDirectRatchetLiveStateSnapshotPersistence#getSnapshot()`
 * genuinely THROWS on corrupt/truncated/schema-invalid on-disk data (see
 * `#readAll()` above — a deliberate fail-LOUD choice at the storage layer,
 * never silently coalesced to "not found" there, so a caller can tell
 * "never checkpointed" apart from "checkpointed, but the record on disk is
 * now corrupt"). Every caller of `getSnapshot()` in this Arc's own
 * downstream code (`fedos_direct_ratchet_secret_checkpoint.ts`'s restore
 * path, `fedos_direct_ratchet_conversation_runtime.ts`'s live-verification
 * truthfulness query) must convert that throw into an honest, catchable
 * outcome rather than let it propagate as an unhandled exception through
 * an async send/receive call or a synchronous Security-State read — this
 * is the ONE place that conversion happens, so both callers stay
 * consistent.
 */
export function readFedosDirectRatchetLiveStateSnapshotSafe(
  persistence: FedosDirectRatchetLiveStateSnapshotPersistence,
  sessionId: string,
): { readonly snapshot: FedosDirectRatchetLiveStateSnapshotV1 | null; readonly corrupt: boolean } {
  try {
    return { snapshot: persistence.getSnapshot(sessionId), corrupt: false };
  } catch {
    return { snapshot: null, corrupt: true };
  }
}

/**
 * Direct Ratchet Live-State Durability arc — the ONE place a caller
 * should ask "is this persisted snapshot actually safe to restore," per
 * this file's own header, problem 2. `durableCounters` MUST come from the
 * separately-persisted `FedosDirectRatchetSessionRecordV1.counters` (the
 * real, already-durable "ratchet position ceiling"), never from the
 * snapshot's own embedded counters compared against themselves — that
 * would prove nothing. A snapshot behind the ceiling in ANY dimension is
 * `"stale"` — never partially trusted.
 */
export function checkFedosDirectRatchetLiveStateSnapshotFreshness(
  snapshot: FedosDirectRatchetLiveStateSnapshotV1 | null,
  durableCounters: FedosDirectRatchetCounters,
): FedosDirectRatchetLiveStateSnapshotFreshnessOutcome {
  if (snapshot === null) return "not-found";
  if (
    snapshot.counters.sendCounter < durableCounters.sendCounter ||
    snapshot.counters.receiveCounter < durableCounters.receiveCounter ||
    snapshot.counters.previousChainCounter < durableCounters.previousChainCounter
  ) {
    return "stale";
  }
  return "fresh";
}
