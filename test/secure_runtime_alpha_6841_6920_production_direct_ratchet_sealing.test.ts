/**
 * Secure Runtime Alpha 6841-6920 — FedOS Direct Ratchet Production Crypto
 * Graph Unification Arc. Mirrors
 * `secure_runtime_alpha_5401_5480_direct_ratchet_sealing_authority.test.ts`'s
 * own 10-case suite exactly, but constructs `FedosProductionMasterSeedAuthority`
 * via the REAL production activation path
 * (`activateFedosProductionProfileMasterSeed()` — host attestation + pinned
 * manifest verification) instead of `FedosWasmMasterSeedAuthority` via the
 * Dev-only Gate. **`NODE_ENV` is never read or set anywhere in this file** —
 * proving, by direct real-WASM execution, this Arc's own central claim:
 * the canonical production authority can now seal/restore real Direct
 * Ratchet secret material without ever opening the development gate.
 *
 * Skips itself with a clear message if the real
 * `packages/fedos-core-rust/pkg/` (+ pinned manifest) is absent.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { createElectronMainHostAttestation } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_host_attestation.js";
import { activateFedosProductionProfileMasterSeed } from "../src/os/messenger/desktop/production_activation/fedos_production_profile_activation.js";
import { FedosProductionMasterSeedAuthority } from "../src/os/messenger/desktop/production_activation/fedos_production_master_seed_authority.js";
import { FEDOS_PRODUCTION_ARTIFACT_DIR } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.js";

declare const process: { cwd(): string };

const PKG_DIR = join(process.cwd(), FEDOS_PRODUCTION_ARTIFACT_DIR);
const WASM_PATH = join(PKG_DIR, "fedos_core_rust_bg.wasm");
const MANIFEST_PATH = join(PKG_DIR, "fedos_wasm_artifact_manifest.v1.json");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH) && existsSync(MANIFEST_PATH);

const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

/** Real production activation -- the SAME call site `buildFreshCoordinator()` (the packaged Beta entry point) uses. Never opens the Dev-only Gate. */
async function productionAuthority(): Promise<FedosProductionMasterSeedAuthority> {
  const attestation = createElectronMainHostAttestation({ appId: "com.fedos.desktop.test", appVersion: "0.0.1" })!;
  const activation = await activateFedosProductionProfileMasterSeed({ attestation });
  expect(activation.outcome).toBe("activated");
  if (activation.outcome !== "activated") throw new Error("unreachable");
  expect(activation.masterSeedAuthority).toBeInstanceOf(FedosProductionMasterSeedAuthority);
  return activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
}

async function generatedAuthority(): Promise<FedosProductionMasterSeedAuthority> {
  const authority = await productionAuthority();
  const generated = await authority.generate();
  expect(generated).toBe(true);
  return authority;
}

suite("Alpha 6841-6920 — Direct Ratchet sealed-secret authority through the REAL PRODUCTION path (REAL WASM, no NODE_ENV=development anywhere)", () => {
  it("0. FedosProductionMasterSeedAuthority now implements sealDirectRatchetSecret/restoreDirectRatchetSecret", async () => {
    const authority = await productionAuthority();
    expect(typeof authority.sealDirectRatchetSecret).toBe("function");
    expect(typeof authority.restoreDirectRatchetSecret).toBe("function");
  });

  it("1. seal then restore round-trips the exact plaintext under the real Rust boundary", async () => {
    const authority = await generatedAuthority();
    const secret = new TextEncoder().encode("placeholder ratchet secret, never a real derived key");
    const sealed = await authority.sealDirectRatchetSecret("local-device-1", "remote-device-1", "conv-1", 0, secret);
    expect(sealed).not.toBeNull();
    expect(typeof sealed).toBe("string");

    const restored = await authority.restoreDirectRatchetSecret("local-device-1", "remote-device-1", "conv-1", 0, sealed as string);
    expect(restored).not.toBeNull();
    expect(Array.from(restored as Uint8Array)).toEqual(Array.from(secret));
  });

  it("2. the sealed blob is opaque hex -- no plaintext marker leaks into it", async () => {
    const authority = await generatedAuthority();
    const secret = new TextEncoder().encode("do-not-leak-this-marker-anywhere");
    const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, secret);
    expect(sealed).not.toBeNull();
    const blob = sealed as string;
    expect(blob).not.toContain("do-not-leak-this-marker-anywhere");
    expect(/^[0-9a-f]+$/.test(blob)).toBe(true);
  });

  it("3. restore fails closed under a different local device", async () => {
    const authority = await generatedAuthority();
    const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([9, 9, 9]));
    const restored = await authority.restoreDirectRatchetSecret("local-WRONG", "remote-1", "conv-1", 0, sealed as string);
    expect(restored).toBeNull();
  });

  it("4. restore fails closed under a different remote device", async () => {
    const authority = await generatedAuthority();
    const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([9, 9, 9]));
    const restored = await authority.restoreDirectRatchetSecret("local-1", "remote-WRONG", "conv-1", 0, sealed as string);
    expect(restored).toBeNull();
  });

  it("5. restore fails closed under a different conversation", async () => {
    const authority = await generatedAuthority();
    const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([9, 9, 9]));
    const restored = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-WRONG", 0, sealed as string);
    expect(restored).toBeNull();
  });

  it("6. restore fails closed under a different generation", async () => {
    const authority = await generatedAuthority();
    const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([9, 9, 9]));
    const restored = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-1", 1, sealed as string);
    expect(restored).toBeNull();
  });

  it("7. restore fails closed on a tampered sealed blob", async () => {
    const authority = await generatedAuthority();
    const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([9, 9, 9]));
    const chars = (sealed as string).split("");
    const flipIndex = 30 % chars.length;
    chars[flipIndex] = chars[flipIndex] === "0" ? "1" : "0";
    const tampered = chars.join("");
    const restored = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, tampered);
    expect(restored).toBeNull();
  });

  it("8. restore fails closed on a malformed sealed blob", async () => {
    const authority = await generatedAuthority();
    for (const malformed of ["", "not-hex-zz", "abc"]) {
      const restored = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, malformed);
      expect(restored).toBeNull();
    }
  });

  it("9. two independent sessions (different conversations) derive independent sealed blobs that never cross-open", async () => {
    const authority = await generatedAuthority();
    const secretA = new TextEncoder().encode("session A secret");
    const secretB = new TextEncoder().encode("session B secret");
    const sealedA = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-A", 0, secretA);
    const sealedB = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-B", 0, secretB);

    const crossOpen = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-B", 0, sealedA as string);
    expect(crossOpen).toBeNull();

    const restoredA = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-A", 0, sealedA as string);
    const restoredB = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-B", 0, sealedB as string);
    expect(Array.from(restoredA as Uint8Array)).toEqual(Array.from(secretA));
    expect(Array.from(restoredB as Uint8Array)).toEqual(Array.from(secretB));
  });

  it("10. seal fails closed before generate() -- a constructed-but-empty authority never seals", async () => {
    const authority = await productionAuthority();
    const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([1]));
    expect(sealed).toBeNull();
  });

  it("11. clear() invalidates sealing -- a post-lock seal/restore both fail closed (proves the SAME clear() lock() already calls also invalidates Ratchet's own capability)", async () => {
    const authority = await generatedAuthority();
    const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([1, 2, 3]));
    expect(sealed).not.toBeNull();
    await authority.clear();
    const sealedAfterClear = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([1, 2, 3]));
    expect(sealedAfterClear).toBeNull();
    const restoredAfterClear = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, sealed as string);
    expect(restoredAfterClear).toBeNull();
  });
});
