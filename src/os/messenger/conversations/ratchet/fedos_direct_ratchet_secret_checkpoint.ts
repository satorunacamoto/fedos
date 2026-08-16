/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — bridges the Cryptographic Core
 * Arc's own real, Rust-sealed `FedosDirectRatchetSealedState`
 * (`./fedos_direct_ratchet_cryptographic_session.js`'s own `sealState()`,
 * Alpha 5481–5560, UNCHANGED — every hex field it returns is ALREADY
 * sealed ciphertext, produced by the real Rust ratchet-secret sealing
 * primitive) into durable persistence.
 *
 * This file performs NO sealing/unsealing of its own — it only WRAPS
 * already-sealed hex strings into records and back.
 *
 * TWO DIFFERENT DURABILITY SHAPES, reconciled honestly (see
 * `docs/secure_runtime_alpha_5561_5640_atomic_state_outbox_retry.md`
 * for the full writeup):
 *   - The four "fixed-kind" secrets (root key, sending/receiving chain
 *     key, local Device ratchet private key) go through the NEW, additive
 *     `FedosDirectRatchetLiveStateSnapshotPersistence`
 *     (`./persistence/fedos_direct_ratchet_live_state_snapshot_persistence.js`)
 *     — a CURRENT-VALUE, last-write-wins cache. The real Rust ratchet
 *     core's own `encrypt()`/`decrypt()` advance the sending/receiving
 *     chain key on EVERY message within the SAME generation (confirmed
 *     against the real Rust boundary: `FedosDirectRatchetSession::restore()`
 *     takes the given chain-key bytes literally, never re-deriving or
 *     fast-forwarding them from the counter) — the Foundation Arc's own
 *     `FedosSealedDirectRatchetSecretPersistence` (Alpha 5401–5480) is
 *     insert-only, ONE FIXED key per `(sessionId, secretKind, generation)`
 *     for these four kinds, and would `"conflict"` on the very next
 *     message's own re-seal. Rather than force-fit an event-sourced port
 *     to a genuinely mutable current-value need (or redesign that
 *     already-reviewed, already-tested Foundation port), this Arc adds
 *     ONE small, dedicated, additive port for exactly this — mirroring
 *     `FedosDirectRatchetRemotePublicKeyPersistence`'s own identical
 *     "small additive current-value port" precedent, itself established
 *     one file earlier in this SAME Arc.
 *   - `"skipped-message-key"` entries DO go through the Foundation's own
 *     `FedosSealedDirectRatchetSecretPersistence` UNCHANGED — each carries
 *     a genuinely unique `chainCounter`, so it is a real one-shot event,
 *     never re-written, exactly the shape that port was designed for.
 */
import {
  createFedosSealedDirectRatchetSecretRecordV1,
  fedosSealedDirectRatchetSecretRecordKey,
  FEDOS_DIRECT_RATCHET_SECRET_KINDS,
} from "./fedos_sealed_direct_ratchet_secret_record.js";
import type { FedosSealedDirectRatchetSecretPersistence } from "./persistence/fedos_sealed_direct_ratchet_secret_persistence.js";
import {
  checkFedosDirectRatchetLiveStateSnapshotFreshness,
  readFedosDirectRatchetLiveStateSnapshotSafe,
  type FedosDirectRatchetLiveStateSnapshotPersistence,
} from "./persistence/fedos_direct_ratchet_live_state_snapshot_persistence.js";
import type { FedosDirectRatchetSessionId, FedosDirectRatchetSuite } from "./fedos_direct_ratchet_session_id.js";
import type { FedosDirectRatchetCounters } from "./fedos_direct_ratchet_counters.js";
import type {
  FedosDirectRatchetSealedSkippedKey,
  FedosDirectRatchetSealedState,
} from "./fedos_direct_ratchet_cryptographic_session.js";

function composeSkippedKeyBlob(entry: FedosDirectRatchetSealedSkippedKey): string {
  return `${entry.counter}:${entry.remoteRatchetPublicKeyHex}:${entry.createdAtMs}:${entry.sealedBlob}`;
}

function parseSkippedKeyBlob(blob: string): FedosDirectRatchetSealedSkippedKey | null {
  const parts = blob.split(":");
  if (parts.length < 4) return null;
  const [counterStr, remoteRatchetPublicKeyHex, createdAtMsStr, ...blobParts] = parts;
  if (counterStr === undefined || remoteRatchetPublicKeyHex === undefined || createdAtMsStr === undefined) return null;
  const counter = Number(counterStr);
  const createdAtMs = Number(createdAtMsStr);
  if (!Number.isInteger(counter) || !Number.isFinite(createdAtMs)) return null;
  return { counter, remoteRatchetPublicKeyHex, createdAtMs, sealedBlob: blobParts.join(":") };
}

/**
 * Checkpoints `sealedState` in full: the four fixed-kind fields into the
 * current-value snapshot store (always overwritten — never a conflict),
 * and every skipped-key entry into the Foundation's own event-sourced
 * sealed-secret store (each individually idempotent/`"already-present"`
 * on a genuine repeat, `"conflict"` only ever indicating real corruption,
 * never an expected condition). Never throws.
 */
export function checkpointFedosDirectRatchetSecretsV1(
  sealedSecretPersistence: FedosSealedDirectRatchetSecretPersistence,
  snapshotPersistence: FedosDirectRatchetLiveStateSnapshotPersistence,
  sessionId: FedosDirectRatchetSessionId,
  suite: FedosDirectRatchetSuite,
  generation: number,
  sealedState: FedosDirectRatchetSealedState,
  createdAt: number,
  /**
   * Direct Ratchet Live-State Durability arc — the SAME LIVE session's own
   * counters at the moment this checkpoint is taken (callers already read
   * these fresh from `stateRuntime` immediately before/after
   * `commitCounters()` for their own send/receive bookkeeping; never
   * re-derive them here). Embedded into the snapshot record so a later
   * restore attempt can prove freshness against the separately-durable
   * session record, per `fedos_direct_ratchet_live_state_snapshot_persistence.ts`'s
   * own header.
   */
  counters: FedosDirectRatchetCounters,
): void {
  snapshotPersistence.putSnapshot(sessionId as unknown as string, {
    schemaVersion: 1,
    sealedRootKey: sealedState.sealedRootKey,
    sealedSendingChainKey: sealedState.sealedSendingChainKey,
    sealedReceivingChainKey: sealedState.sealedReceivingChainKey,
    sealedLocalRatchetPrivateKey: sealedState.sealedLocalRatchetPrivateKey,
    counters,
  });

  for (const entry of sealedState.sealedSkippedKeys) {
    const record = createFedosSealedDirectRatchetSecretRecordV1({
      sessionId,
      secretKind: "skipped-message-key",
      generation,
      chainCounter: entry.counter,
      sealingSuite: "direct-ratchet-sealing-v1",
      suite,
      sealedBlob: composeSkippedKeyBlob(entry),
      createdAt,
    });
    if (record === null) continue;
    sealedSecretPersistence.putSealedSecret(record);
  }
}

/**
 * Reconstructs a `FedosDirectRatchetSealedState` from the current
 * snapshot plus every skipped-key entry ever recorded for this
 * `(sessionId, generation)`. `null` if no snapshot has ever been
 * checkpointed for this session (a session that was created but never
 * had `sealState()` called on it — should not happen in practice, this
 * Arc's own outbound/inbound integrations always checkpoint immediately
 * after creation and after every encrypt/decrypt) — OR, Direct Ratchet
 * Live-State Durability arc — if a snapshot exists but is STALE relative
 * to `durableCounters` (the caller's own already-durable
 * `FedosDirectRatchetSessionRecordV1.counters`, the real "ratchet
 * position ceiling" this function itself cannot forge). "Decrypts
 * successfully" is never treated as sufficient proof of freshness on its
 * own — see `checkFedosDirectRatchetLiveStateSnapshotFreshness()`'s own
 * header. A `null` return here is intentionally indistinguishable to the
 * caller from "never checkpointed" — both correctly route to the same
 * fail-closed, reset-required path; this function never partially trusts
 * a stale snapshot.
 */
export function restoreFedosDirectRatchetSealedStateV1(
  sealedSecretPersistence: FedosSealedDirectRatchetSecretPersistence,
  snapshotPersistence: FedosDirectRatchetLiveStateSnapshotPersistence,
  sessionId: FedosDirectRatchetSessionId,
  generation: number,
  durableCounters: FedosDirectRatchetCounters,
): FedosDirectRatchetSealedState | null {
  const { snapshot, corrupt } = readFedosDirectRatchetLiveStateSnapshotSafe(snapshotPersistence, sessionId as unknown as string);
  if (corrupt) return null;
  if (checkFedosDirectRatchetLiveStateSnapshotFreshness(snapshot, durableCounters) !== "fresh") return null;
  if (snapshot === null) return null;

  const sealedSkippedKeys: FedosDirectRatchetSealedSkippedKey[] = [];
  for (const record of sealedSecretPersistence.listSealedSecrets()) {
    if (record.sessionId !== sessionId || record.generation !== generation || record.secretKind !== "skipped-message-key") continue;
    const parsed = parseSkippedKeyBlob(record.sealedBlob);
    if (parsed !== null) sealedSkippedKeys.push(parsed);
  }

  return {
    sealedRootKey: snapshot.sealedRootKey,
    sealedSendingChainKey: snapshot.sealedSendingChainKey,
    sealedReceivingChainKey: snapshot.sealedReceivingChainKey,
    sealedLocalRatchetPrivateKey: snapshot.sealedLocalRatchetPrivateKey,
    sealedSkippedKeys,
  };
}

export { FEDOS_DIRECT_RATCHET_SECRET_KINDS, fedosSealedDirectRatchetSecretRecordKey };
