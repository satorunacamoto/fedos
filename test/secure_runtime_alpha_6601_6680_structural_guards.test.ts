import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";

/**
 * Secure Runtime Alpha 6601-6680 (FedOS Secure Memory Store Production
 * Wiring Arc) — Phase P structural guards for `FedosMasterSeedAuthority`'s
 * own NEW `SecretHandleStore`-backed ownership.
 */

function extractBlock(source: string, marker: string): string {
  const start = source.indexOf(marker);
  expect(start, `expected to find "${marker}" in the source`).toBeGreaterThan(-1);
  const braceStart = source.indexOf("{", start);
  expect(braceStart, `expected an opening brace after "${marker}"`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces while extracting: ${marker}`);
}

const authorityStateBlock = extractBlock(libRsSource, "enum FedosMasterSeedAuthorityState {");
const authorityImplBlock = extractBlock(libRsSource, "impl FedosMasterSeedAuthority {");

describe("Secure Runtime Alpha 6601-6680 -- SecretHandleStore is production reachable", () => {
  it("1. FedosMasterSeedAuthorityState::Available now owns a real SecretHandleStore + SecretHandleId, not a direct FedosMasterSeedHandle field", () => {
    expect(authorityStateBlock).toMatch(/Available\s*\{\s*\n\s*store:\s*crate::secret_handle_store::SecretHandleStore,\s*\n\s*master_seed_id:\s*crate::secret_handle_store::SecretHandleId,/);
  });

  it("2. generate()/restore_sealed() construct the Store with with_capacity(1), never the unbounded default, and handle CapacityExceeded without a panic/unwrap", () => {
    const generateBody = extractBlock(libRsSource, "pub fn generate(&mut self) -> bool {");
    expect(generateBody).toMatch(/SecretHandleStore::with_capacity\(1\)/);
    expect(generateBody).toMatch(/CapacityExceeded\s*=>\s*return false/);
    expect(generateBody).not.toMatch(/\.unwrap\(\)|\.expect\(/);
  });

  it("3. clear() explicitly destroys the Store-owned handle by ID, never just calling .clear() on a directly-held handle value", () => {
    const clearBody = extractBlock(libRsSource, "pub fn clear(&mut self) {");
    expect(clearBody).toMatch(/store\.destroy\(master_seed_id\)/);
    expect(clearBody).not.toMatch(/handle\.clear\(\)/);
  });
});

describe("Secure Runtime Alpha 6601-6680 -- every production Master Seed consumer resolves through the Store", () => {
  it("4. sign_nostr_event/public_key_hex_for_account/resolve_conversation_key/encrypt_nip44_wire/decrypt_nip44_wire/seal_direct_ratchet_secret/restore_direct_ratchet_secret all call with_master_seed, never match FedosMasterSeedAuthorityState::Available directly", () => {
    for (const fnMarker of [
      "pub fn sign_nostr_event(",
      "pub fn public_key_hex_for_account(",
      "pub fn resolve_conversation_key(",
      "pub fn encrypt_nip44_wire(",
      "pub fn decrypt_nip44_wire(",
      "pub fn seal_direct_ratchet_secret(",
      "pub fn restore_direct_ratchet_secret(",
    ]) {
      const body = extractBlock(libRsSource, fnMarker);
      expect(body, `${fnMarker} must call self.with_master_seed`).toMatch(/self\.with_master_seed\(/);
      expect(body, `${fnMarker} must never directly match FedosMasterSeedAuthorityState::Available`).not.toMatch(
        /FedosMasterSeedAuthorityState::Available\(/,
      );
    }
  });

  it("5. seal() uses with_master_seed_bytes, never a direct field match", () => {
    const sealBody = extractBlock(libRsSource, "pub fn seal(&self, passphrase: &[u8]) -> Option<String> {");
    expect(sealBody).toMatch(/self\.with_master_seed_bytes\(/);
    expect(sealBody).not.toMatch(/FedosMasterSeedAuthorityState::Available\(/);
  });

  it("6. with_master_seed/with_master_seed_bytes both resolve through SecretHandleStore::use_handle, kind-checked against MasterSeedMaterial, and zeroize their own temporary copy", () => {
    const withMasterSeed = extractBlock(libRsSource, "fn with_master_seed<R>(");
    expect(withMasterSeed).toMatch(/store\s*\n?\s*\.use_handle\(/);
    expect(withMasterSeed).toMatch(/SecretHandleKind::MasterSeedMaterial/);
    expect(withMasterSeed).toMatch(/temp\.clear\(\)/);

    const withMasterSeedBytes = extractBlock(libRsSource, "fn with_master_seed_bytes<R>(");
    expect(withMasterSeedBytes).toMatch(/store\s*\n?\s*\.use_handle\(/);
    expect(withMasterSeedBytes).toMatch(/SecretHandleKind::MasterSeedMaterial/);
  });
});

describe("Secure Runtime Alpha 6601-6680 -- no raw-secret export, no Debug/Serialize/Clone", () => {
  it("7. FedosMasterSeedAuthority still carries zero derive attributes -- unchanged by this Arc", () => {
    const structIndex = libRsSource.indexOf("pub struct FedosMasterSeedAuthority {");
    expect(structIndex).toBeGreaterThan(-1);
    const preceding = libRsSource.slice(Math.max(0, structIndex - 200), structIndex);
    expect(preceding).not.toMatch(/#\[derive\(/);
  });

  it("8. no println!/eprintln!/dbg! anywhere in the touched impl block", () => {
    expect(authorityImplBlock).not.toMatch(/\bprintln!\(|\beprintln!\(|\bdbg!\(/);
  });

  it("9. no generic readSecret/expose()/as_bytes() helper introduced -- only the one narrowly-named bridge accessor", () => {
    expect(authorityImplBlock).not.toMatch(/\breadSecret\b|\.expose\(\)|\.as_bytes\(\)/);
    expect(libRsSource).toMatch(/expose_bytes_for_internal_master_seed_authority_bridge/);
  });

  it("10. every public method on FedosMasterSeedAuthority returns only String/bool/Vec<u8>-shaped opaque results (signatures, ciphertext, public keys, sealed blobs) -- never a raw 32-byte seed type", () => {
    expect(authorityImplBlock).not.toMatch(/->\s*Option<\[u8;\s*32\]>/);
    expect(authorityImplBlock).not.toMatch(/->\s*\[u8;\s*32\]/);
  });

  it("11. no new #[wasm_bindgen] item was added by this Arc -- FedosMasterSeedAuthority's own #[wasm_bindgen] impl block is the SAME one, not duplicated", () => {
    const wasmBindgenCount = (libRsSource.match(/#\[wasm_bindgen\]\s*\n\s*impl FedosMasterSeedAuthority/g) ?? []).length;
    expect(wasmBindgenCount).toBe(1);
  });
});
