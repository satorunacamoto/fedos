import { describe, it, expect } from "vitest";
import { NoopVaultBoundary } from "../src/vault/noop_vault.js";
import { InMemoryVaultBoundary } from "../src/vault/memory_vault.js";
import type { VaultUnlockRequest } from "../src/vault/types.js";
// Runtime / Worker sources as strings: prove the vault is NOT auto-wired.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Stage 33 — Vault boundary tests.
 *
 * These assert the SEAM behaves as a boundary: it derives no key, stores no
 * secret, never throws, never mutates input, and is not wired into the core.
 */
describe("NoopVaultBoundary", () => {
  it("constructor does not unlock", () => {
    const vault = new NoopVaultBoundary();
    expect(vault.isUnlocked()).toBe(false);
  });

  it("stays unavailable and never unlocks", async () => {
    const vault = new NoopVaultBoundary();
    expect(vault.getState()).toBe("unavailable");
    const decision = await vault.unlock({ kind: "apple_id" });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
    expect(vault.isUnlocked()).toBe(false);
  });

  it("advertises no capabilities", () => {
    expect(new NoopVaultBoundary().getCapabilities()).toEqual([]);
  });

  it("lock is a total no-op that never throws", async () => {
    const vault = new NoopVaultBoundary();
    const decision = await vault.lock();
    expect(decision.state).toBe("unavailable");
    expect(vault.getState()).toBe("unavailable");
  });
});

describe("InMemoryVaultBoundary", () => {
  it("constructor does not unlock and starts locked", () => {
    const vault = new InMemoryVaultBoundary();
    expect(vault.isUnlocked()).toBe(false);
    expect(vault.getState()).toBe("locked");
  });

  it("unlock does not derive a key or expose secret material", async () => {
    const vault = new InMemoryVaultBoundary();
    const decision = await vault.unlock({ kind: "passphrase", reference: "handle" });
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("unlocked");
    expect(vault.isUnlocked()).toBe(true);
    // The decision reason is non-sensitive and mentions no key/seed and never
    // echoes the (opaque, non-secret) reference.
    expect(decision.reason).toMatch(/no key derived/);
    expect(decision.reason).not.toContain("handle");
    // No secret/key/seed field is exposed anywhere on the vault.
    const keys = Object.keys(vault as unknown as Record<string, unknown>);
    expect(keys.join(" ")).not.toMatch(/secret|seed|key|private|token|passphrase/i);
  });

  it("Apple ID request does not create a seed", async () => {
    const vault = new InMemoryVaultBoundary();
    const decision = await vault.unlock({ kind: "apple_id", reference: "user-sub-123" });
    expect(decision.allowed).toBe(true);
    // Auth factor authorizes a placeholder transition only — nothing is derived.
    expect(decision.reason).not.toContain("user-sub-123");
    const serialized = JSON.stringify(vault);
    expect(serialized).not.toContain("user-sub-123");
    expect(serialized).not.toMatch(/seed/i);
  });

  it("Passkey request does not create a seed", async () => {
    const vault = new InMemoryVaultBoundary();
    const decision = await vault.unlock({ kind: "passkey", reference: "cred-abc" });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).not.toContain("cred-abc");
    expect(JSON.stringify(vault)).not.toMatch(/seed/i);
  });

  it("lock returns to the locked state", async () => {
    const vault = new InMemoryVaultBoundary();
    await vault.unlock({ kind: "passkey" });
    expect(vault.isUnlocked()).toBe(true);
    const decision = await vault.lock();
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("locked");
    expect(vault.getState()).toBe("locked");
    expect(vault.isUnlocked()).toBe(false);
  });

  it("advertises placeholder capabilities only", () => {
    const caps = new InMemoryVaultBoundary().getCapabilities();
    for (const cap of caps) {
      expect(cap).toMatch(/_placeholder$/);
    }
  });

  it("error handling does not throw on a malformed request", async () => {
    const vault = new InMemoryVaultBoundary();
    const bad = { kind: "not_a_real_kind" } as unknown as VaultUnlockRequest;
    const decision = await vault.unlock(bad);
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("error");
    expect(vault.getState()).toBe("error");
    expect(vault.isUnlocked()).toBe(false);
  });

  it("does not mutate the input request", async () => {
    const vault = new InMemoryVaultBoundary();
    const request: VaultUnlockRequest = { kind: "apple_id", reference: "handle" };
    const snapshot = JSON.stringify(request);
    await vault.unlock(request);
    expect(JSON.stringify(request)).toBe(snapshot);
    expect(request.kind).toBe("apple_id");
    expect(request.reference).toBe("handle");
  });
});

describe("Vault is not auto-wired into the core", () => {
  it("Runtime source has no vault auto-wire", () => {
    expect(runtimeSource).not.toMatch(/vault/i);
  });

  it("Worker source has no vault auto-wire", () => {
    expect(workerSource).not.toMatch(/vault/i);
  });
});
