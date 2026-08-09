/**
 * Secure Runtime Alpha 5401-5480 — Phase D/E: the closed, fixed resource
 * limits this Arc enforces. Exact figures from the normative review
 * (`review/fedos-forward-secrecy-double-ratchet-v1` @ `b34d608`,
 * `11_out_of_order_and_skipped_keys.md` §2, restated
 * `20_normative_recommendation.md` §6): the review deliberately reuses
 * ONE number for both the max-skipped-keys bound and the max-chain-gap
 * bound, "to avoid two numbers that could silently disagree" -- this
 * file follows that exactly, `MAX_SKIPPED_KEYS_PER_CHAIN` doing double
 * duty as `MAX_CHAIN_GAP` is intentional, not an oversight.
 */

export const FEDOS_DIRECT_RATCHET_LIMITS = Object.freeze({
  /** Review §11 §2 -- exact figure. Also the max chain-gap bound (same number, deliberately). */
  maxSkippedKeysPerChain: 1000,
  /** Same number as `maxSkippedKeysPerChain`, named separately for call-site clarity only -- never a second, independently-tunable constant. */
  maxChainGap: 1000,
  /** Review §11 §2 -- exact figure, in milliseconds. */
  skippedKeyRetentionMs: 14 * 24 * 60 * 60 * 1000,
  /** Same 14-day window a superseded session is retained before full discard (review §11 §2). */
  supersededSessionRetentionMs: 14 * 24 * 60 * 60 * 1000,
  /** 32-bit counter ceiling -- a send/receive/previous-chain counter or generation may never exceed this. */
  maxCounterValue: 0xffffffff,
});

export type FedosDirectRatchetLimits = typeof FEDOS_DIRECT_RATCHET_LIMITS;
