/**
 * Secure Runtime Alpha 5401-5480 — Phase D. Covers test requirements 6
 * (valid lifecycle transitions), 7 (invalid lifecycle transitions), 8
 * (terminal revocation), 9 (counter monotonicity), 10 (counter overflow).
 */
import { describe, it, expect } from "vitest";
import {
  isFedosDirectRatchetSessionLifecycleTransitionAllowed,
  isFedosDirectRatchetSessionLifecycleTerminal,
  FEDOS_DIRECT_RATCHET_SESSION_LIFECYCLE_STATES,
} from "../src/conversation/ratchet/fedos_direct_ratchet_session_lifecycle.js";
import {
  advanceFedosDirectRatchetCounters,
  isWellFormedFedosDirectRatchetCounters,
  FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS,
} from "../src/conversation/ratchet/fedos_direct_ratchet_counters.js";
import { FEDOS_DIRECT_RATCHET_LIMITS } from "../src/conversation/ratchet/fedos_direct_ratchet_limits.js";

describe("Alpha 5401-5480 — session lifecycle", () => {
  it("6. valid transitions: initialized -> active, active -> suspended -> active, active -> revoked", () => {
    expect(isFedosDirectRatchetSessionLifecycleTransitionAllowed("initialized", "active")).toBe(true);
    expect(isFedosDirectRatchetSessionLifecycleTransitionAllowed("active", "suspended")).toBe(true);
    expect(isFedosDirectRatchetSessionLifecycleTransitionAllowed("suspended", "active")).toBe(true);
    expect(isFedosDirectRatchetSessionLifecycleTransitionAllowed("active", "revoked")).toBe(true);
  });

  it("7. invalid transitions: revoked -> anything, corrupt -> anything, active -> initialized", () => {
    for (const to of FEDOS_DIRECT_RATCHET_SESSION_LIFECYCLE_STATES) {
      expect(isFedosDirectRatchetSessionLifecycleTransitionAllowed("revoked", to)).toBe(false);
      expect(isFedosDirectRatchetSessionLifecycleTransitionAllowed("corrupt", to)).toBe(false);
    }
    expect(isFedosDirectRatchetSessionLifecycleTransitionAllowed("active", "initialized")).toBe(false);
  });

  it("8. terminal revocation -- revoked and corrupt are both fully terminal (fail closed)", () => {
    expect(isFedosDirectRatchetSessionLifecycleTerminal("revoked")).toBe(true);
    expect(isFedosDirectRatchetSessionLifecycleTerminal("corrupt")).toBe(true);
    expect(isFedosDirectRatchetSessionLifecycleTerminal("active")).toBe(false);
  });

  it("every state has a name from the closed vocabulary only (no open-ended strings)", () => {
    expect(FEDOS_DIRECT_RATCHET_SESSION_LIFECYCLE_STATES).toEqual([
      "initialized",
      "active",
      "suspended",
      "reset-required",
      "expired",
      "revoked",
      "corrupt",
      "unavailable",
    ]);
  });

  it("unavailable can recover to active once the sealing authority returns", () => {
    expect(isFedosDirectRatchetSessionLifecycleTransitionAllowed("unavailable", "active")).toBe(true);
  });
});

describe("Alpha 5401-5480 — counters", () => {
  it("9. counter monotonicity -- advancing forward succeeds", () => {
    const advanced = advanceFedosDirectRatchetCounters(FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS, { sendCounter: 5 });
    expect(advanced).not.toBeNull();
    expect(advanced?.sendCounter).toBe(5);
  });

  it("9. counter monotonicity -- rolling back is rejected", () => {
    const advanced = advanceFedosDirectRatchetCounters({ ...FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS, sendCounter: 10 }, { sendCounter: 5 });
    expect(advanced).toBeNull();
  });

  it("10. counter overflow -- exceeding maxCounterValue is rejected", () => {
    const advanced = advanceFedosDirectRatchetCounters(FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS, {
      sendCounter: FEDOS_DIRECT_RATCHET_LIMITS.maxCounterValue + 1,
    });
    expect(advanced).toBeNull();
  });

  it("10. counter overflow -- a negative or non-integer counter is rejected", () => {
    expect(advanceFedosDirectRatchetCounters(FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS, { sendCounter: -1 })).toBeNull();
    expect(advanceFedosDirectRatchetCounters(FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS, { sendCounter: 1.5 })).toBeNull();
  });

  it("well-formed counters structural check", () => {
    expect(isWellFormedFedosDirectRatchetCounters(FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS)).toBe(true);
    expect(isWellFormedFedosDirectRatchetCounters({ sendCounter: -1, receiveCounter: 0, previousChainCounter: 0 })).toBe(false);
    expect(isWellFormedFedosDirectRatchetCounters(null)).toBe(false);
    expect(isWellFormedFedosDirectRatchetCounters("not an object")).toBe(false);
  });
});
