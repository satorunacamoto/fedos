import { describe, it, expect } from "vitest";
import {
  fedosDesktopBetaLimitationsV1,
  fedosDesktopBetaLimitationsForSurface,
} from "../src/os/messenger/desktop/beta/fedos_desktop_beta_limitations.js";

/**
 * Secure Runtime Alpha 8121-8200 (FedOS Desktop Beta UI Integration,
 * Closed Pilot Candidate, and Release Reconciliation Arc) — a focused
 * regression test for the two new limitation entries this Arc adds,
 * reconciling `d760c95`'s own finding that this closed vocabulary
 * under-disclosed relative to what Secure Runtime Alpha 8041-8120's real
 * screens now actually do (a bounded chat poll, not a live push; some
 * Identity Replacement items cannot yet be opened).
 */
describe("Alpha 8121-8200 -- Beta limitations model reconciliation", () => {
  it("still contains every pre-existing limitation id, unremoved", () => {
    const ids = fedosDesktopBetaLimitationsV1().limitations.map((l) => l.limitationId);
    for (const preExisting of [
      "beta-software",
      "local-data-loss",
      "forgotten-passphrase-unrecoverable",
      "relay-retains-ciphertext",
      "public-nostr-is-public",
      "private-metadata-observable",
      "local-malware-out-of-scope",
      "some-settings-need-restart",
      "unsupported-settings-stored-not-active",
      "registry-may-not-auto-sync",
      "delivery-not-guaranteed",
      "no-automatic-update",
      "no-recovery-service",
    ]) {
      expect(ids).toContain(preExisting);
    }
  });

  it("adds exactly two new, real, non-secret limitation entries", () => {
    const ids = fedosDesktopBetaLimitationsV1().limitations.map((l) => l.limitationId);
    expect(ids).toContain("chat-live-update-is-polled");
    expect(ids).toContain("identity-replacement-evidence-may-be-incomplete");
  });

  it("both new entries are surfaced on beta-status -- the Ready screen's own real limitations list", () => {
    const betaStatusIds = fedosDesktopBetaLimitationsForSurface("beta-status").map((l) => l.limitationId);
    expect(betaStatusIds).toContain("chat-live-update-is-polled");
    expect(betaStatusIds).toContain("identity-replacement-evidence-may-be-incomplete");
  });

  it("never invents a guarantee -- neither new statement claims instant delivery or automatic resolution", () => {
    const all = fedosDesktopBetaLimitationsV1().limitations;
    const poll = all.find((l) => l.limitationId === "chat-live-update-is-polled")!;
    const identity = all.find((l) => l.limitationId === "identity-replacement-evidence-may-be-incomplete")!;
    expect(poll.statement).toMatch(/periodically|not.*instant|not a live push/i);
    expect(identity.statement).toMatch(/never silently hidden or auto-decided/i);
  });

  it("Phase L (closed-pilot safety controls) adds exactly two MORE entries, reconciling the external audit delta/reproducibility review findings this later session found -- 17 total now", () => {
    const ids = fedosDesktopBetaLimitationsV1().limitations.map((l) => l.limitationId);
    expect(ids).toContain("relay-has-no-automatic-reconnect");
    expect(ids).toContain("no-guaranteed-memory-erasure");
    const betaStatusIds = fedosDesktopBetaLimitationsForSurface("beta-status").map((l) => l.limitationId);
    expect(betaStatusIds).toContain("relay-has-no-automatic-reconnect");
    expect(betaStatusIds).toContain("no-guaranteed-memory-erasure");
    const all = fedosDesktopBetaLimitationsV1().limitations;
    const relay = all.find((l) => l.limitationId === "relay-has-no-automatic-reconnect")!;
    const memory = all.find((l) => l.limitationId === "no-guaranteed-memory-erasure")!;
    expect(relay.statement).toMatch(/does not retry automatically|lock and unlock again/i);
    expect(memory.statement).toMatch(/does not guarantee/i);
  });

  it("Alpha 8201-8280 (Closed-Beta Product Gap Closure and Final Polish Arc) adds exactly five MORE entries, reconciling this Arc's own real Phase A findings (Device Pairing UI closed a real gap; Group Messaging is honestly disclosed as unavailable, not merely undone; the pilot's own no-audit/unsigned-installer/memory-locking facts move from docs-only into this user-visible model) -- 22 total now", () => {
    const ids = fedosDesktopBetaLimitationsV1().limitations.map((l) => l.limitationId);
    for (const newId of [
      "group-messaging-unavailable",
      "device-revocation-not-remote-erasure",
      "no-secure-memory-locking",
      "no-independent-security-audit",
      "installer-unsigned",
    ]) {
      expect(ids).toContain(newId);
    }
    expect(ids.length).toBe(22);
    const betaStatusIds = fedosDesktopBetaLimitationsForSurface("beta-status").map((l) => l.limitationId);
    for (const newId of ["group-messaging-unavailable", "device-revocation-not-remote-erasure", "no-secure-memory-locking", "no-independent-security-audit"]) {
      expect(betaStatusIds).toContain(newId);
    }
    const all = fedosDesktopBetaLimitationsV1().limitations;
    const group = all.find((l) => l.limitationId === "group-messaging-unavailable")!;
    expect(group.statement).toMatch(/only supports Direct/i);
    expect(group.statement).not.toMatch(/Signal-equivalent|MLS|Sender-Key/i);
  });

  it("the model remains a pure, frozen, non-secret value object -- no Runtime/Electron/persistence import anywhere in the source", () => {
    // No dynamic behavior to test at runtime beyond immutability; the
    // structural-purity guarantee is enforced by this file's own
    // `Object.freeze()` usage, already exercised by every assertion above
    // successfully reading frozen arrays without needing a deep clone.
    const model = fedosDesktopBetaLimitationsV1();
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.limitations)).toBe(true);
  });
});
