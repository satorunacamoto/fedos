/**
 * Secure Runtime Alpha 5401-5480 — Phase H/I: the narrow Direct Ratchet
 * State Runtime facade. Owns session metadata persistence, sealed-secret
 * persistence, and an injected sealing authority -- nothing else.
 *
 * ALLOWED responsibilities only (mission Phase H): create empty session
 * state, inspect metadata, report readiness, suspend/mark-reset-required/
 * expire/revoke, update validated counters, register/remove skipped-key
 * references, seal opaque placeholder secret bytes and persist the
 * result (the counterpart the mission's own "recover sealed state
 * through the injected sealing authority" responsibility implies must
 * exist somewhere -- this Runtime owns both directions of the SAME
 * injected authority), recover sealed state, lock, stop.
 *
 * NOT implemented anywhere in this file, by construction: no `encrypt`/
 * `decrypt` of message content, no send, no Relay publish, no NIP-17
 * event, no peer negotiation, no automatic Conversation migration. Every
 * "seal"/"recover" call here operates on OPAQUE PLACEHOLDER SECRET BYTES
 * this Arc's own callers supply for testing -- never message content,
 * never a claim of real ratchet cryptography.
 */
import {
  isFedosDirectRatchetSessionLifecycleTransitionAllowed,
  type FedosDirectRatchetSessionLifecycleState,
} from "./fedos_direct_ratchet_session_lifecycle.js";
import { fedosDirectRatchetSealingDeviceContext, type FedosDirectRatchetSessionBinding } from "./fedos_direct_ratchet_session_binding.js";
import { advanceFedosDirectRatchetCounters, FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS } from "./fedos_direct_ratchet_counters.js";
import { FedosDirectRatchetSkippedKeyIndex, type FedosDirectRatchetSkippedKeyRejectionReason } from "./fedos_direct_ratchet_skipped_key_index.js";
import type { FedosDirectRatchetSessionId } from "./fedos_direct_ratchet_session_id.js";
import type { FedosDirectRatchetSessionRecordV1 } from "./fedos_direct_ratchet_session_record.js";
import type { FedosDirectRatchetSessionPersistence } from "./persistence/fedos_direct_ratchet_session_persistence.js";
import type { FedosSealedDirectRatchetSecretPersistence } from "./persistence/fedos_sealed_direct_ratchet_secret_persistence.js";
import {
  createFedosSealedDirectRatchetSecretRecordV1,
  fedosSealedDirectRatchetSecretRecordKey,
  type FedosDirectRatchetSecretKind,
} from "./fedos_sealed_direct_ratchet_secret_record.js";
import type { FedosDirectRatchetSealingAuthority } from "./fedos_direct_ratchet_sealing_authority.js";
import { fedosDirectRatchetReadinessIsReady, type FedosDirectRatchetReadiness } from "./fedos_direct_ratchet_readiness.js";
import type { FedosDirectRatchetRecoveryOutcome } from "./fedos_direct_ratchet_recovery_outcome.js";
import { FedosDirectRatchetRecoveredSecretHandle } from "./fedos_direct_ratchet_recovered_secret_handle.js";

const SEALING_SUITE = "direct-ratchet-sealing-v1" as const;

export type FedosDirectRatchetSessionCreateOutcome =
  | { readonly outcome: "created"; readonly record: FedosDirectRatchetSessionRecordV1 }
  | { readonly outcome: "already-exists" }
  | { readonly outcome: "conflict" }
  | { readonly outcome: "rejected"; readonly reason: "malformed-binding" | "runtime-stopped" }
  | { readonly outcome: "failed" };

export type FedosDirectRatchetLifecycleTransitionOutcome =
  | { readonly outcome: "transitioned"; readonly record: FedosDirectRatchetSessionRecordV1 }
  | { readonly outcome: "rejected"; readonly reason: "session-not-found" | "invalid-transition" | "runtime-stopped" }
  | { readonly outcome: "failed" };

export type FedosDirectRatchetCounterUpdateOutcome =
  | { readonly outcome: "updated"; readonly record: FedosDirectRatchetSessionRecordV1 }
  | {
      readonly outcome: "rejected";
      readonly reason: "session-not-found" | "session-not-active" | "counter-rollback-or-overflow" | "runtime-stopped";
    }
  | { readonly outcome: "failed" };

export type FedosDirectRatchetSkippedKeyOperationOutcome =
  | { readonly outcome: "applied"; readonly record: FedosDirectRatchetSessionRecordV1 }
  | {
      readonly outcome: "rejected";
      readonly reason:
        | "session-not-found"
        | "session-not-active"
        | "runtime-stopped"
        | FedosDirectRatchetSkippedKeyRejectionReason;
    }
  | { readonly outcome: "failed" };

export type FedosDirectRatchetSealOutcome =
  | { readonly outcome: "sealed"; readonly sealedRecordId: string }
  | {
      readonly outcome: "rejected";
      readonly reason: "session-not-found" | "session-not-active" | "sealing-authority-unavailable" | "seal-failed" | "runtime-stopped";
    };

export interface FedosDirectRatchetStateRuntimeDeps {
  readonly sessionPersistence: FedosDirectRatchetSessionPersistence;
  readonly sealedSecretPersistence: FedosSealedDirectRatchetSecretPersistence;
  /** `null` reports `"sealing-authority-unavailable"` from every seal/recover call -- never a thrown error, matching this Arc's own fail-closed discipline. */
  readonly sealingAuthority: FedosDirectRatchetSealingAuthority | null;
  readonly now?: () => number;
}

export class FedosDirectRatchetStateRuntime {
  readonly #sessionPersistence: FedosDirectRatchetSessionPersistence;
  readonly #sealedSecretPersistence: FedosSealedDirectRatchetSecretPersistence;
  readonly #sealingAuthority: FedosDirectRatchetSealingAuthority | null;
  readonly #now: () => number;
  readonly #skippedKeyIndexBySessionId = new Map<string, FedosDirectRatchetSkippedKeyIndex>();
  readonly #recoveredHandles = new Map<string, FedosDirectRatchetRecoveredSecretHandle>();
  #stopped = false;

  constructor(deps: FedosDirectRatchetStateRuntimeDeps) {
    this.#sessionPersistence = deps.sessionPersistence;
    this.#sealedSecretPersistence = deps.sealedSecretPersistence;
    this.#sealingAuthority = deps.sealingAuthority;
    this.#now = deps.now ?? (() => Date.now());
  }

  isStopped(): boolean {
    return this.#stopped;
  }

  /** Restart recovery (Phase G/I): replays every session record's own skipped-key references into a fresh, in-memory index -- public metadata only, no secret handle is ever recovered by this call. */
  restart(): void {
    this.#skippedKeyIndexBySessionId.clear();
    for (const record of this.#sessionPersistence.listSessions()) {
      const index = new FedosDirectRatchetSkippedKeyIndex();
      for (const reference of record.skippedKeyReferences) {
        index.insert(reference);
      }
      this.#skippedKeyIndexBySessionId.set(record.binding.sessionId, index);
    }
  }

  createSession(binding: FedosDirectRatchetSessionBinding): FedosDirectRatchetSessionCreateOutcome {
    if (this.#stopped) return { outcome: "rejected", reason: "runtime-stopped" };
    const record: FedosDirectRatchetSessionRecordV1 = Object.freeze({
      schemaVersion: 1,
      revision: 0,
      binding,
      lifecycleState: "initialized",
      counters: FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS,
      createdAt: this.#now(),
      lastActivityAt: this.#now(),
      skippedKeyReferences: [],
      sealedSecretRecordIds: [],
    });
    const result = this.#sessionPersistence.putSession(record);
    if (result === "inserted") {
      this.#skippedKeyIndexBySessionId.set(binding.sessionId, new FedosDirectRatchetSkippedKeyIndex());
      return { outcome: "created", record };
    }
    if (result === "already-present") return { outcome: "already-exists" };
    if (result === "conflict") return { outcome: "conflict" };
    return { outcome: "failed" };
  }

  getSessionMetadata(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetSessionRecordV1 | null {
    return this.#sessionPersistence.getSession(sessionId);
  }

  readiness(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetReadiness {
    if (this.#stopped) return { state: "runtime-stopped", lifecycleState: null };
    const record = this.#sessionPersistence.getSession(sessionId);
    if (!record) return { state: "session-not-found", lifecycleState: null };
    if (record.lifecycleState !== "active" && record.lifecycleState !== "initialized") {
      return { state: "session-not-active", lifecycleState: record.lifecycleState };
    }
    if (this.#sealingAuthority === null) return { state: "sealing-authority-unavailable", lifecycleState: record.lifecycleState };
    return { state: "ready", lifecycleState: record.lifecycleState };
  }

  #transition(
    sessionId: FedosDirectRatchetSessionId,
    to: FedosDirectRatchetSessionLifecycleState,
  ): FedosDirectRatchetLifecycleTransitionOutcome {
    if (this.#stopped) return { outcome: "rejected", reason: "runtime-stopped" };
    const record = this.#sessionPersistence.getSession(sessionId);
    if (!record) return { outcome: "rejected", reason: "session-not-found" };
    if (!isFedosDirectRatchetSessionLifecycleTransitionAllowed(record.lifecycleState, to)) {
      return { outcome: "rejected", reason: "invalid-transition" };
    }
    const updated: FedosDirectRatchetSessionRecordV1 = Object.freeze({
      ...record,
      revision: record.revision + 1,
      lifecycleState: to,
      lastActivityAt: this.#now(),
    });
    const result = this.#sessionPersistence.putSession(updated);
    if (result !== "inserted" && result !== "already-present") return { outcome: "failed" };
    return { outcome: "transitioned", record: updated };
  }

  markActive(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetLifecycleTransitionOutcome {
    return this.#transition(sessionId, "active");
  }

  suspend(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetLifecycleTransitionOutcome {
    return this.#transition(sessionId, "suspended");
  }

  markResetRequired(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetLifecycleTransitionOutcome {
    return this.#transition(sessionId, "reset-required");
  }

  expire(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetLifecycleTransitionOutcome {
    return this.#transition(sessionId, "expired");
  }

  revoke(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetLifecycleTransitionOutcome {
    return this.#transition(sessionId, "revoked");
  }

  markCorrupt(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetLifecycleTransitionOutcome {
    return this.#transition(sessionId, "corrupt");
  }

  updateCounters(
    sessionId: FedosDirectRatchetSessionId,
    next: { readonly sendCounter?: number; readonly receiveCounter?: number },
  ): FedosDirectRatchetCounterUpdateOutcome {
    if (this.#stopped) return { outcome: "rejected", reason: "runtime-stopped" };
    const record = this.#sessionPersistence.getSession(sessionId);
    if (!record) return { outcome: "rejected", reason: "session-not-found" };
    if (record.lifecycleState !== "active") return { outcome: "rejected", reason: "session-not-active" };
    const advanced = advanceFedosDirectRatchetCounters(record.counters, next);
    if (advanced === null) return { outcome: "rejected", reason: "counter-rollback-or-overflow" };
    const updated: FedosDirectRatchetSessionRecordV1 = Object.freeze({
      ...record,
      revision: record.revision + 1,
      counters: advanced,
      lastActivityAt: this.#now(),
    });
    const result = this.#sessionPersistence.putSession(updated);
    if (result !== "inserted" && result !== "already-present") return { outcome: "failed" };
    return { outcome: "updated", record: updated };
  }

  registerSkippedKeyReference(
    sessionId: FedosDirectRatchetSessionId,
    chainCounter: number,
    sealedRecordId: string,
  ): FedosDirectRatchetSkippedKeyOperationOutcome {
    if (this.#stopped) return { outcome: "rejected", reason: "runtime-stopped" };
    const record = this.#sessionPersistence.getSession(sessionId);
    if (!record) return { outcome: "rejected", reason: "session-not-found" };
    if (record.lifecycleState !== "active") return { outcome: "rejected", reason: "session-not-active" };
    const index = this.#indexFor(sessionId);
    const insertOutcome = index.insert({ chainCounter, sealedRecordId, createdAt: this.#now() });
    if (insertOutcome.outcome === "rejected") {
      return { outcome: "rejected", reason: insertOutcome.reason };
    }
    const updated: FedosDirectRatchetSessionRecordV1 = Object.freeze({
      ...record,
      revision: record.revision + 1,
      skippedKeyReferences: index.list(),
      lastActivityAt: this.#now(),
    });
    const result = this.#sessionPersistence.putSession(updated);
    if (result !== "inserted" && result !== "already-present") return { outcome: "failed" };
    return { outcome: "applied", record: updated };
  }

  removeSkippedKeyReference(
    sessionId: FedosDirectRatchetSessionId,
    chainCounter: number,
  ): FedosDirectRatchetSkippedKeyOperationOutcome {
    if (this.#stopped) return { outcome: "rejected", reason: "runtime-stopped" };
    const record = this.#sessionPersistence.getSession(sessionId);
    if (!record) return { outcome: "rejected", reason: "session-not-found" };
    const index = this.#indexFor(sessionId);
    index.remove(chainCounter);
    const updated: FedosDirectRatchetSessionRecordV1 = Object.freeze({
      ...record,
      revision: record.revision + 1,
      skippedKeyReferences: index.list(),
      lastActivityAt: this.#now(),
    });
    const result = this.#sessionPersistence.putSession(updated);
    if (result !== "inserted" && result !== "already-present") return { outcome: "failed" };
    return { outcome: "applied", record: updated };
  }

  #indexFor(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetSkippedKeyIndex {
    let index = this.#skippedKeyIndexBySessionId.get(sessionId);
    if (!index) {
      index = new FedosDirectRatchetSkippedKeyIndex();
      this.#skippedKeyIndexBySessionId.set(sessionId, index);
    }
    return index;
  }

  /**
   * Seals `secretBytes` (opaque placeholder material this Arc's own
   * callers supply for testing -- never real derived ratchet key
   * material, since no ratchet math exists yet) via the injected
   * sealing authority, and persists the resulting sealed record. Does
   * NOT register it as a skipped-key reference or update
   * `sealedSecretRecordIds` -- callers do that explicitly via
   * `registerSkippedKeyReference()`/a follow-up `putSession()`, keeping
   * this method's own responsibility narrow (seal + persist only).
   */
  async sealAndPersistSecret(
    sessionId: FedosDirectRatchetSessionId,
    secretKind: FedosDirectRatchetSecretKind,
    chainCounter: number | null,
    secretBytes: Uint8Array,
  ): Promise<FedosDirectRatchetSealOutcome> {
    if (this.#stopped) return { outcome: "rejected", reason: "runtime-stopped" };
    const record = this.#sessionPersistence.getSession(sessionId);
    if (!record) return { outcome: "rejected", reason: "session-not-found" };
    if (record.lifecycleState !== "active" && record.lifecycleState !== "initialized") {
      return { outcome: "rejected", reason: "session-not-active" };
    }
    if (this.#sealingAuthority === null) return { outcome: "rejected", reason: "sealing-authority-unavailable" };

    const sealedBlob = await this.#sealingAuthority.sealDirectRatchetSecret(
      fedosDirectRatchetSealingDeviceContext(record.binding.localAccountRef, record.binding.localDeviceRef),
      fedosDirectRatchetSealingDeviceContext(record.binding.remoteAccountRef, record.binding.remoteDeviceRef),
      record.binding.conversationId,
      record.binding.generation,
      secretBytes,
    );
    if (sealedBlob === null) return { outcome: "rejected", reason: "seal-failed" };

    const sealedRecord = createFedosSealedDirectRatchetSecretRecordV1({
      sessionId: record.binding.sessionId,
      secretKind,
      generation: record.binding.generation,
      chainCounter,
      sealingSuite: SEALING_SUITE,
      suite: record.binding.suite,
      sealedBlob,
      createdAt: this.#now(),
    });
    if (sealedRecord === null) return { outcome: "rejected", reason: "seal-failed" };

    const writeResult = this.#sealedSecretPersistence.putSealedSecret(sealedRecord);
    if (writeResult !== "written" && writeResult !== "already-present") {
      return { outcome: "rejected", reason: "seal-failed" };
    }
    return { outcome: "sealed", sealedRecordId: fedosSealedDirectRatchetSecretRecordKey(sealedRecord) };
  }

  /**
   * Recovers the sealed secret referenced by `sealedRecordId` for
   * `sessionId`, storing the result as a disposable, in-memory-only
   * `FedosDirectRatchetRecoveredSecretHandle` -- never returned as a
   * bare `Uint8Array` to discourage a caller from holding onto it past
   * `lock()`. Never silently creates replacement secret state on any
   * failure path: a missing/tampered/mismatched sealed record always
   * returns a `"rejected"`/`"missing"` outcome, never a fresh handle.
   */
  async recover(sessionId: FedosDirectRatchetSessionId, sealedRecordId: string): Promise<FedosDirectRatchetRecoveryOutcome> {
    if (this.#stopped) return { outcome: "rejected", reason: "runtime-stopped" };
    const record = this.#sessionPersistence.getSession(sessionId);
    if (!record) return { outcome: "rejected", reason: "session-corrupt" };
    if (record.lifecycleState === "revoked") return { outcome: "rejected", reason: "session-revoked" };
    if (record.lifecycleState === "corrupt") return { outcome: "rejected", reason: "session-corrupt" };
    if (this.#sealingAuthority === null) return { outcome: "rejected", reason: "sealing-authority-unavailable" };

    const sealedRecord = this.#sealedSecretPersistence.getSealedSecret(sealedRecordId);
    if (!sealedRecord) return { outcome: "missing", reason: "no-sealed-record" };
    // Sealed-reference substitution guard: the sealed record's OWN
    // embedded `sessionId` must match the session it is being recovered
    // for -- rejected BEFORE ever reaching the sealing authority.
    if (sealedRecord.sessionId !== record.binding.sessionId) {
      return { outcome: "rejected", reason: "tamper-or-mismatch" };
    }

    const recoveredBytes = await this.#sealingAuthority.restoreDirectRatchetSecret(
      fedosDirectRatchetSealingDeviceContext(record.binding.localAccountRef, record.binding.localDeviceRef),
      fedosDirectRatchetSealingDeviceContext(record.binding.remoteAccountRef, record.binding.remoteDeviceRef),
      record.binding.conversationId,
      sealedRecord.generation,
      sealedRecord.sealedBlob,
    );
    if (recoveredBytes === null) return { outcome: "rejected", reason: "tamper-or-mismatch" };

    this.#recoveredHandles.set(sealedRecordId, new FedosDirectRatchetRecoveredSecretHandle(recoveredBytes));
    return { outcome: "recovered" };
  }

  /** `null` if `recover()` was never called for `sealedRecordId`, or the handle was already disposed (by `lock()` or directly). */
  recoveredSecret(sealedRecordId: string): FedosDirectRatchetRecoveredSecretHandle | null {
    return this.#recoveredHandles.get(sealedRecordId) ?? null;
  }

  /** Disposes (best-effort zeroizes) every currently-recovered in-memory secret handle and clears the tracking map -- does NOT stop the Runtime or affect durable persistence. Idempotent. */
  lock(): void {
    for (const handle of this.#recoveredHandles.values()) handle.dispose();
    this.#recoveredHandles.clear();
  }

  /** Irreversible for this instance: after `stop()`, every mutating method (`createSession`/transitions/`updateCounters`/skipped-key registration/`sealAndPersistSecret`/`recover`) fails closed with `"runtime-stopped"`. Read-only methods (`getSessionMetadata`/`readiness`/`recoveredSecret`) remain available. Also calls `lock()`. */
  stop(): void {
    this.lock();
    this.#stopped = true;
  }
}

export { fedosDirectRatchetReadinessIsReady };
