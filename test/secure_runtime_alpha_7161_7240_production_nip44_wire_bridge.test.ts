/**
 * Secure Runtime Alpha 7161-7240 — FedOS Conversation-Level Production
 * Crypto and Identity Authority Wiring Arc. Mirrors
 * `secure_runtime_alpha_6841_6920_production_direct_ratchet_sealing.test.ts`'s
 * own suite exactly, but proves `FedosProductionMasterSeedAuthority.encryptNip44Wire()`/
 * `decryptNip44Wire()` (this Arc's own new methods) round-trip real NIP-44
 * v2 wire ciphertext through the REAL production activation path (host
 * attestation + pinned manifest verification) — **`NODE_ENV` is never
 * read or set anywhere in this file**, proving these two methods reach
 * the SAME real, already-tested Rust bridge
 * (`encrypt_nip44_wire_from_master_seed_internal`/
 * `decrypt_nip44_wire_from_master_seed_internal`, `lib.rs`) without ever
 * opening the Dev-only Gate.
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

/** Real production activation for one independent identity -- the SAME call site `buildFreshCoordinator()` (the packaged Beta entry point) uses. Never opens the Dev-only Gate. */
async function productionAuthority(appId: string): Promise<FedosProductionMasterSeedAuthority> {
  const attestation = createElectronMainHostAttestation({ appId, appVersion: "0.0.1" })!;
  const activation = await activateFedosProductionProfileMasterSeed({ attestation });
  expect(activation.outcome).toBe("activated");
  if (activation.outcome !== "activated") throw new Error("unreachable");
  expect(activation.masterSeedAuthority).toBeInstanceOf(FedosProductionMasterSeedAuthority);
  return activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
}

async function generatedAuthority(appId: string): Promise<FedosProductionMasterSeedAuthority> {
  const authority = await productionAuthority(appId);
  const generated = await authority.generate();
  expect(generated).toBe(true);
  return authority;
}

async function accountPublicKeyHex(authority: FedosProductionMasterSeedAuthority, accountIndex: number): Promise<string> {
  const handle = await authority.accessForNostrSigningAuthorityInternalUse();
  expect(handle).not.toBeNull();
  const hex = (handle as unknown as { public_key_hex_for_account(i: number): string }).public_key_hex_for_account(accountIndex);
  expect(typeof hex).toBe("string");
  return hex;
}

suite("Alpha 7161-7240 — FedosProductionMasterSeedAuthority.encryptNip44Wire/decryptNip44Wire through the REAL PRODUCTION path (REAL WASM, no NODE_ENV=development anywhere)", () => {
  it("0. FedosProductionMasterSeedAuthority now implements encryptNip44Wire/decryptNip44Wire", async () => {
    const authority = await productionAuthority("com.fedos.desktop.test.7161-0");
    expect(typeof authority.encryptNip44Wire).toBe("function");
    expect(typeof authority.decryptNip44Wire).toBe("function");
  });

  it("1. encrypt then decrypt round-trips real plaintext between two real, independent identities", async () => {
    const alice = await generatedAuthority("com.fedos.desktop.test.7161-alice-1");
    const bob = await generatedAuthority("com.fedos.desktop.test.7161-bob-1");
    const bobPub = await accountPublicKeyHex(bob, 0);
    const alicePub = await accountPublicKeyHex(alice, 0);

    const payload = await alice.encryptNip44Wire(0, bobPub, new TextEncoder().encode("hello bob, real nip-44 wire"));
    expect(payload).not.toBeNull();
    expect(typeof payload).toBe("string");

    const plaintext = await bob.decryptNip44Wire(0, alicePub, payload as string);
    expect(plaintext).not.toBeNull();
    expect(new TextDecoder().decode(plaintext as Uint8Array)).toBe("hello bob, real nip-44 wire");
  });

  it("2. the wire payload is opaque -- no plaintext marker leaks into it", async () => {
    const alice = await generatedAuthority("com.fedos.desktop.test.7161-alice-2");
    const bob = await generatedAuthority("com.fedos.desktop.test.7161-bob-2");
    const bobPub = await accountPublicKeyHex(bob, 0);
    const payload = await alice.encryptNip44Wire(0, bobPub, new TextEncoder().encode("do-not-leak-this-marker-anywhere"));
    expect(payload).not.toBeNull();
    expect(payload as string).not.toContain("do-not-leak-this-marker-anywhere");
  });

  it("3. decrypt fails closed for the wrong recipient", async () => {
    const alice = await generatedAuthority("com.fedos.desktop.test.7161-alice-3");
    const bob = await generatedAuthority("com.fedos.desktop.test.7161-bob-3");
    const mallory = await generatedAuthority("com.fedos.desktop.test.7161-mallory-3");
    const bobPub = await accountPublicKeyHex(bob, 0);
    const alicePub = await accountPublicKeyHex(alice, 0);
    const payload = await alice.encryptNip44Wire(0, bobPub, new TextEncoder().encode("only for bob"));
    expect(payload).not.toBeNull();
    const wrongDecrypt = await mallory.decryptNip44Wire(0, alicePub, payload as string);
    expect(wrongDecrypt).toBeNull();
  });

  it("4. decrypt fails closed on a tampered payload", async () => {
    const alice = await generatedAuthority("com.fedos.desktop.test.7161-alice-4");
    const bob = await generatedAuthority("com.fedos.desktop.test.7161-bob-4");
    const bobPub = await accountPublicKeyHex(bob, 0);
    const alicePub = await accountPublicKeyHex(alice, 0);
    const payload = await alice.encryptNip44Wire(0, bobPub, new TextEncoder().encode("tamper me not"));
    expect(payload).not.toBeNull();
    const chars = (payload as string).split("");
    const flipIndex = 10 % chars.length;
    chars[flipIndex] = chars[flipIndex] === "A" ? "B" : "A";
    const tampered = chars.join("");
    const result = await bob.decryptNip44Wire(0, alicePub, tampered);
    expect(result).toBeNull();
  });

  it("5. decrypt fails closed on a malformed payload", async () => {
    const bob = await generatedAuthority("com.fedos.desktop.test.7161-bob-5");
    const alicePub = await accountPublicKeyHex(bob, 0);
    for (const malformed of ["", "not-base64-or-whatever-!!!", "abc"]) {
      const result = await bob.decryptNip44Wire(0, alicePub, malformed);
      expect(result).toBeNull();
    }
  });

  it("6. encrypt fails closed before generate() -- a constructed-but-empty authority never encrypts", async () => {
    const alice = await productionAuthority("com.fedos.desktop.test.7161-alice-6");
    const result = await alice.encryptNip44Wire(0, "0".repeat(64), new TextEncoder().encode("x"));
    expect(result).toBeNull();
  });

  it("7. encrypt fails closed on a malformed counterparty public key", async () => {
    const alice = await generatedAuthority("com.fedos.desktop.test.7161-alice-7");
    const result = await alice.encryptNip44Wire(0, "not-a-real-hex-key", new TextEncoder().encode("x"));
    expect(result).toBeNull();
  });

  it("8. clear() invalidates the bridge -- a post-lock encrypt/decrypt both fail closed", async () => {
    const alice = await generatedAuthority("com.fedos.desktop.test.7161-alice-8");
    const bob = await generatedAuthority("com.fedos.desktop.test.7161-bob-8");
    const bobPub = await accountPublicKeyHex(bob, 0);
    const alicePub = await accountPublicKeyHex(alice, 0);
    const payload = await alice.encryptNip44Wire(0, bobPub, new TextEncoder().encode("before clear"));
    expect(payload).not.toBeNull();
    await alice.clear();
    const afterClear = await alice.encryptNip44Wire(0, bobPub, new TextEncoder().encode("after clear"));
    expect(afterClear).toBeNull();
    await bob.clear();
    const decryptAfterClear = await bob.decryptNip44Wire(0, alicePub, payload as string);
    expect(decryptAfterClear).toBeNull();
  });

  it("9. two independent account indices on the SAME authority derive independent identities that never cross-decrypt", async () => {
    const alice = await generatedAuthority("com.fedos.desktop.test.7161-alice-9");
    const bob = await generatedAuthority("com.fedos.desktop.test.7161-bob-9");
    const bobAccount0 = await accountPublicKeyHex(bob, 0);
    const bobAccount1 = await accountPublicKeyHex(bob, 1);
    expect(bobAccount0).not.toBe(bobAccount1);
    const alicePub = await accountPublicKeyHex(alice, 0);

    const payloadForAccount0 = await alice.encryptNip44Wire(0, bobAccount0, new TextEncoder().encode("account-scoped secret"));
    expect(payloadForAccount0).not.toBeNull();

    const crossAccountDecrypt = await bob.decryptNip44Wire(1, alicePub, payloadForAccount0 as string);
    expect(crossAccountDecrypt).toBeNull();

    const correctDecrypt = await bob.decryptNip44Wire(0, alicePub, payloadForAccount0 as string);
    expect(correctDecrypt).not.toBeNull();
  });
});
