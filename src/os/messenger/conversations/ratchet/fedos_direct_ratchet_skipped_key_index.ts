/**
 * Secure Runtime Alpha 5401-5480 — Phase E: the bounded, non-secret
 * skipped-message-key metadata/index. This file stores and evicts
 * REFERENCES only (`sealedRecordId`, pointing at an opaque sealed
 * secret record, `./fedos_sealed_direct_ratchet_secret_record.ts`) --
 * it never derives, stores, or exposes an actual message key, matching
 * this Arc's own absolute prohibition on message-key derivation.
 *
 * Limits are `FEDOS_DIRECT_RATCHET_LIMITS.maxSkippedKeysPerChain`/
 * `maxChainGap` (both 1000, deliberately the same number) and
 * `skippedKeyRetentionMs` (14 days) -- see
 * `./fedos_direct_ratchet_limits.ts` for the citation.
 */
import { FEDOS_DIRECT_RATCHET_LIMITS } from "../../../../conversation/ratchet/fedos_direct_ratchet_limits.js";

export interface FedosDirectRatchetSkippedKeyReference {
  /** The receiving-chain position this reference stands in for -- never itself a key. */
  readonly chainCounter: number;
  /** Opaque pointer into the sealed-secret persistence backend (`./persistence/fedos_sealed_direct_ratchet_secret_persistence.ts`) -- never a key byte. */
  readonly sealedRecordId: string;
  readonly createdAt: number;
}

export type FedosDirectRatchetSkippedKeyRejectionReason =
  | "malformed-counter"
  | "counter-overflow"
  | "duplicate-counter"
  | "chain-gap-exceeded"
  | "index-full";

export type FedosDirectRatchetSkippedKeyInsertOutcome =
  | { readonly outcome: "inserted"; readonly evicted: readonly FedosDirectRatchetSkippedKeyReference[] }
  | { readonly outcome: "rejected"; readonly reason: FedosDirectRatchetSkippedKeyRejectionReason };

/**
 * A bounded, session-isolated (one instance per session) skipped-key
 * index -- never an unbounded `Map`. Duplicate `chainCounter` insertion
 * is rejected outright (review §11 §3: "a duplicate/already-consumed
 * chain position is rejected, never re-derived"). Deterministic
 * eviction: once at the cap, the OLDEST reference (by `createdAt`, ties
 * broken by lowest `chainCounter`) is evicted to make room -- never a
 * random/unspecified choice.
 */
export class FedosDirectRatchetSkippedKeyIndex {
  readonly #baseChainCounter: number;
  readonly #references = new Map<number, FedosDirectRatchetSkippedKeyReference>();

  constructor(baseChainCounter = 0) {
    this.#baseChainCounter = baseChainCounter;
  }

  size(): number {
    return this.#references.size;
  }

  get(chainCounter: number): FedosDirectRatchetSkippedKeyReference | null {
    return this.#references.get(chainCounter) ?? null;
  }

  list(): readonly FedosDirectRatchetSkippedKeyReference[] {
    return Array.from(this.#references.values()).sort((a, b) => a.chainCounter - b.chainCounter);
  }

  insert(reference: FedosDirectRatchetSkippedKeyReference): FedosDirectRatchetSkippedKeyInsertOutcome {
    if (
      !Number.isInteger(reference.chainCounter) ||
      reference.chainCounter < 0 ||
      reference.chainCounter > FEDOS_DIRECT_RATCHET_LIMITS.maxCounterValue
    ) {
      return { outcome: "rejected", reason: "malformed-counter" };
    }
    const gap = reference.chainCounter - this.#baseChainCounter;
    if (gap < 0 || gap > FEDOS_DIRECT_RATCHET_LIMITS.maxChainGap) {
      return { outcome: "rejected", reason: gap < 0 ? "malformed-counter" : "chain-gap-exceeded" };
    }
    if (this.#references.has(reference.chainCounter)) {
      return { outcome: "rejected", reason: "duplicate-counter" };
    }

    const evicted: FedosDirectRatchetSkippedKeyReference[] = [];
    while (this.#references.size >= FEDOS_DIRECT_RATCHET_LIMITS.maxSkippedKeysPerChain) {
      const oldest = this.#oldest();
      if (!oldest) return { outcome: "rejected", reason: "index-full" };
      this.#references.delete(oldest.chainCounter);
      evicted.push(oldest);
    }

    this.#references.set(reference.chainCounter, Object.freeze({ ...reference }));
    return { outcome: "inserted", evicted };
  }

  /** Removes and returns every reference whose `createdAt` is older than `nowMs - skippedKeyRetentionMs` -- restart-safe: callers persist the removal explicitly, this method only mutates in-memory state. */
  evictExpired(nowMs: number): readonly FedosDirectRatchetSkippedKeyReference[] {
    const cutoff = nowMs - FEDOS_DIRECT_RATCHET_LIMITS.skippedKeyRetentionMs;
    const expired: FedosDirectRatchetSkippedKeyReference[] = [];
    for (const [counter, reference] of this.#references) {
      if (reference.createdAt < cutoff) {
        expired.push(reference);
        this.#references.delete(counter);
      }
    }
    return expired;
  }

  remove(chainCounter: number): boolean {
    return this.#references.delete(chainCounter);
  }

  #oldest(): FedosDirectRatchetSkippedKeyReference | null {
    let oldest: FedosDirectRatchetSkippedKeyReference | null = null;
    for (const reference of this.#references.values()) {
      if (
        oldest === null ||
        reference.createdAt < oldest.createdAt ||
        (reference.createdAt === oldest.createdAt && reference.chainCounter < oldest.chainCounter)
      ) {
        oldest = reference;
      }
    }
    return oldest;
  }
}
