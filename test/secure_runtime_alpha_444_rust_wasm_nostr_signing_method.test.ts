import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRaw from "../packages/fedos-core-rust/src/lib.rs?raw";

const lib: string = (libRaw as string).replace(/\r\n/g, "\n");

describe("Secure Runtime Alpha 444 -- Rust/WASM Nostr Signing Method", () => {
  it("sign_nostr_event checks kind against exactly 1 or 13 (Secure Runtime Alpha 1761-1840 Phase D added NIP-59 Seal signing, additively)", () => {
    const fn = (lib.match(/pub fn sign_nostr_event\([\s\S]*?\n    \}/) ?? [""])[0];
    expect(fn).toContain("if kind != 1 && kind != 13 {");
  });

  it("sign_nostr_event validates created_at as finite, non-negative, and a whole number", () => {
    const fn = (lib.match(/pub fn sign_nostr_event\([\s\S]*?\n    \}/) ?? [""])[0];
    expect(fn).toMatch(/is_finite\(\)/);
    expect(fn).toMatch(/created_at < 0\.0/);
    expect(fn).toMatch(/fract\(\) != 0\.0/);
  });

  it("clears the derived secret key on every exit path of the internal signing orchestrator", () => {
    const fn = (lib.match(
      /fn sign_nostr_event_from_master_seed_internal\([\s\S]*?\n    \}\n\n    #\[cfg\(test\)\]/,
    ) ?? [""])[0];
    const clearCalls = (fn.match(/secret_key\.clear\(\)/g) ?? []).length;
    expect(clearCalls).toBeGreaterThanOrEqual(3);
  });

  it("there is no generic sign(hash) escape hatch anywhere in lib.rs", () => {
    expect(lib).not.toMatch(/pub fn sign\(/);
  });

  it("reuses the existing BIP-340 signer and Event ID derivation, not a new implementation", () => {
    const fn = (lib.match(
      /fn sign_nostr_event_from_master_seed_internal\([\s\S]*?\n    \}\n\n    #\[cfg\(test\)\]/,
    ) ?? [""])[0];
    expect(fn).toContain("derive_nostr_event_id_internal(&event)");
    expect(fn).toContain("sign_nostr_event_internal(&event, &secret_key)");
  });
});
