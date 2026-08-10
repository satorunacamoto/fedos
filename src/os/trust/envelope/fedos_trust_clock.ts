/**
 * Trust — injectable clock.
 *
 * Follows this repo's own repeated-per-module convention (e.g.
 * `src/os/messenger/board/runtime/fedos_board_runtime_clock.ts`:
 * `type FedosBoardRuntimeClock = () => number`) rather than a shared
 * `Clock` port that doesn't exist in this codebase. Expiry validation must
 * never call `Date.now()` directly — always through an injected clock, so
 * tests can be deterministic (arc brief §35).
 */

/** Unix seconds. */
export type FedosTrustClock = () => number;

export function defaultFedosTrustClock(): number {
  return Math.floor(Date.now() / 1000);
}

/** Test helper: a clock fixed at a given Unix-seconds instant. */
export function fixedFedosTrustClock(unixSeconds: number): FedosTrustClock {
  return () => unixSeconds;
}
