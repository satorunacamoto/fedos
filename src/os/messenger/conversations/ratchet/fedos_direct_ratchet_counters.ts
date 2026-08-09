/**
 * Secure Runtime Alpha 5401-5480 — Phase C: the closed, public counter
 * metadata a Direct Ratchet session carries. Every counter here is a
 * PUBLIC fact (review §10 §2 lists send/receive/previous-chain counters
 * as `[public]`) -- no secret ever derives from, or is exposed by, this
 * file.
 */
import { FEDOS_DIRECT_RATCHET_LIMITS } from "../../../../conversation/ratchet/fedos_direct_ratchet_limits.js";

export interface FedosDirectRatchetCounters {
  readonly sendCounter: number;
  readonly receiveCounter: number;
  readonly previousChainCounter: number;
}

export const FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS: FedosDirectRatchetCounters = Object.freeze({
  sendCounter: 0,
  receiveCounter: 0,
  previousChainCounter: 0,
});

function isValidCounterValue(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= FEDOS_DIRECT_RATCHET_LIMITS.maxCounterValue;
}

export function isWellFormedFedosDirectRatchetCounters(candidate: unknown): candidate is FedosDirectRatchetCounters {
  if (typeof candidate !== "object" || candidate === null) return false;
  const c = candidate as Record<string, unknown>;
  return (
    isValidCounterValue(c.sendCounter as number) &&
    isValidCounterValue(c.receiveCounter as number) &&
    isValidCounterValue(c.previousChainCounter as number)
  );
}

/**
 * Validated monotonic advance of `sendCounter`/`receiveCounter` only --
 * `previousChainCounter` is set explicitly by a chain-reset event, never
 * by this function (it does not itself imply one occurred). Returns
 * `null` (never throws, never wraps) on: a non-increasing value, a
 * malformed (non-integer/negative) value, or a value that would exceed
 * `maxCounterValue` (overflow rejection) -- fail closed, the caller must
 * treat this as a corruption/reset signal, never silently clamp.
 */
export function advanceFedosDirectRatchetCounters(
  current: FedosDirectRatchetCounters,
  next: { readonly sendCounter?: number; readonly receiveCounter?: number },
): FedosDirectRatchetCounters | null {
  const nextSend = next.sendCounter ?? current.sendCounter;
  const nextReceive = next.receiveCounter ?? current.receiveCounter;
  if (!isValidCounterValue(nextSend) || !isValidCounterValue(nextReceive)) return null;
  if (nextSend < current.sendCounter || nextReceive < current.receiveCounter) return null;
  return Object.freeze({ ...current, sendCounter: nextSend, receiveCounter: nextReceive });
}
