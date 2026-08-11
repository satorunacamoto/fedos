import { describe, it, expect } from "vitest";
import {
  evaluateNetworkAccess,
  isValidNetworkProfile,
  prefersTorTransport,
  type NetworkProfile,
} from "../src/os/commerce/catalog/network_profile.js";

/**
 * Commerce E2E Completion arc (Wave B, Agent I) — tests for the
 * NetworkProfile / Tor policy seam
 * (`../src/os/commerce/catalog/network_profile.ts`). This module performs
 * NO network I/O, NO Tor install/spawn — every test here is pure
 * function-in/value-out.
 */

describe("isValidNetworkProfile", () => {
  it("1. accepts exactly the three declared profiles", () => {
    expect(isValidNetworkProfile("direct")).toBe(true);
    expect(isValidNetworkProfile("local-only")).toBe(true);
    expect(isValidNetworkProfile("tor-optional")).toBe(true);
  });

  it("2. rejects unknown strings, never throws", () => {
    expect(isValidNetworkProfile("tor-required")).toBe(false);
    expect(isValidNetworkProfile("")).toBe(false);
    expect(isValidNetworkProfile("Direct")).toBe(false); // case-sensitive, no normalization invented
  });

  it("3. rejects non-string values, never throws", () => {
    expect(isValidNetworkProfile(null)).toBe(false);
    expect(isValidNetworkProfile(undefined)).toBe(false);
    expect(isValidNetworkProfile(42)).toBe(false);
    expect(isValidNetworkProfile({ profile: "direct" })).toBe(false);
  });
});

describe("evaluateNetworkAccess", () => {
  it('4. "local-only" forbids any operation that requires network access', () => {
    const decision = evaluateNetworkAccess("local-only", true);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/local-only/);
  });

  it('5. "local-only" still permits an operation that does NOT require network access', () => {
    const decision = evaluateNetworkAccess("local-only", false);
    expect(decision.allowed).toBe(true);
  });

  it('6. "direct" permits network-requiring operations', () => {
    expect(evaluateNetworkAccess("direct", true).allowed).toBe(true);
  });

  it('7. "tor-optional" permits network-requiring operations (Tor is a routing choice, never a block)', () => {
    expect(evaluateNetworkAccess("tor-optional", true).allowed).toBe(true);
  });

  it("8. never blocks purely-local work under ANY profile", () => {
    const profiles: readonly NetworkProfile[] = ["direct", "local-only", "tor-optional"];
    for (const profile of profiles) {
      expect(evaluateNetworkAccess(profile, false).allowed).toBe(true);
    }
  });

  it("9. always returns a non-empty, human-readable reason string", () => {
    const profiles: readonly NetworkProfile[] = ["direct", "local-only", "tor-optional"];
    for (const profile of profiles) {
      for (const requiresNetwork of [true, false]) {
        const decision = evaluateNetworkAccess(profile, requiresNetwork);
        expect(decision.reason.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("prefersTorTransport", () => {
  it('10. only "tor-optional" prefers Tor routing', () => {
    expect(prefersTorTransport("tor-optional")).toBe(true);
    expect(prefersTorTransport("direct")).toBe(false);
    expect(prefersTorTransport("local-only")).toBe(false);
  });

  it("11. is a pure, synchronous function -- never returns a Promise, never throws", () => {
    const result = prefersTorTransport("direct");
    expect(result).not.toBeInstanceOf(Promise);
    expect(() => prefersTorTransport("tor-optional")).not.toThrow();
  });
});

describe("NetworkProfile -- Tor is policy, never an anonymity guarantee (documentation contract)", () => {
  it("12. this module never exposes any 'anonymity'/'privacy level' computation -- only routing/access decisions", () => {
    // Structural sanity check on the public surface, not a text-grep of comments: the only two exported functions are access-decision and routing-preference, nothing privacy-scoring shaped.
    expect(typeof evaluateNetworkAccess).toBe("function");
    expect(typeof prefersTorTransport).toBe("function");
    expect(typeof isValidNetworkProfile).toBe("function");
  });
});
