import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44MessageKeysSource from "../packages/fedos-core-rust/src/crypto/nip44_message_keys.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireEncryptSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_encrypt.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireDecryptSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_decrypt.rs?raw";

/**
 * Secure Runtime Alpha 6281-6360 (FedOS Secure Memory Secret Buffer and
 * Zeroization Foundation Arc) — Phase N structural guards. Mirrors this
 * crate's own established two-layer convention (see the reconciliation
 * report's own §7): a Rust `#[cfg(test)]` structural guard inside the
 * crate itself (`lib.rs`'s own `secret_handle_store`/`page_locking`/
 * `secure_memory_diagnostics` test modules) PLUS this TypeScript
 * `?raw`-import source-string-scan layer, proving the SAME invariants
 * from outside the crate too.
 */

function extractModule(source: string, marker: string): string {
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
  throw new Error(`unbalanced braces while extracting module: ${marker}`);
}

const storeModule = extractModule(libRsSource, "mod secret_handle_store {");
const pageLockingModule = extractModule(libRsSource, "mod page_locking {");
const diagnosticsModule = extractModule(libRsSource, "mod secure_memory_diagnostics {");

describe("Secure Runtime Alpha 6281-6360 -- SecretHandleStore structural guards", () => {
  it("1. the store module and every new type are pub(crate) at most -- never pub", () => {
    expect(storeModule).not.toMatch(/\bpub\s+mod\s+secret_handle_store\b/);
    expect(storeModule).not.toMatch(/\bpub\s+struct\s+SecretHandleStore\b/);
    expect(storeModule).not.toMatch(/\bpub\s+struct\s+SecretHandleId\b/);
    expect(storeModule).not.toMatch(/\bpub\s+enum\s+SecretHandleStoreDenial\b/);
    expect(storeModule).not.toMatch(/\bpub\s+enum\s+SecretHandleStoreDestroyOutcome\b/);
    expect(storeModule).not.toMatch(/\bpub\s+enum\s+SecretHandleStoreInsertOutcome\b/);
  });

  it("2. SecretHandleStore is never Clone/Copy -- no derive attribute above its struct definition includes them", () => {
    const structIndex = storeModule.indexOf("pub(crate) struct SecretHandleStore {");
    expect(structIndex).toBeGreaterThan(-1);
    const precedingSlice = storeModule.slice(Math.max(0, structIndex - 400), structIndex);
    const lastDerive = [...precedingSlice.matchAll(/#\[derive\(([^)]*)\)\]/g)].pop();
    expect(lastDerive, "SecretHandleStore must have no #[derive(...)] immediately above it").toBeUndefined();
  });

  it("3. no Debug impl anywhere in the store module that could enumerate secret content -- and no #[derive(Debug)] on SecretHandleStore itself", () => {
    expect(storeModule).not.toMatch(/impl\s+(?:std::fmt::)?Debug\s+for\s+SecretHandleStore\b/);
    const structIndex = storeModule.indexOf("pub(crate) struct SecretHandleStore {");
    const precedingSlice = storeModule.slice(Math.max(0, structIndex - 400), structIndex);
    expect(precedingSlice).not.toMatch(/#\[derive\([^)]*\bDebug\b[^)]*\)\]\s*$/);
  });

  it("4. no Serialize/Deserialize anywhere in the store module", () => {
    expect(storeModule).not.toMatch(/\bSerialize\b/);
    expect(storeModule).not.toMatch(/\bDeserialize\b/);
    expect(storeModule).not.toMatch(/serde/);
  });

  it("5. no public iterator or raw-content accessor -- the only way to touch a held handle's bytes is the scoped use_handle closure", () => {
    expect(storeModule).not.toMatch(/fn\s+iter\s*\(/);
    expect(storeModule).not.toMatch(/impl\s+Iterator\s+for\s+SecretHandleStore/);
    expect(storeModule).not.toMatch(/fn\s+handles\s*\(/);
    expect(storeModule).not.toMatch(/fn\s+all\s*\(/);
    expect(storeModule).toMatch(/fn\s+use_handle\s*<R>/);
  });

  it("6. bounded capacity -- insert fails closed at a fixed constant, checked before any growth", () => {
    expect(storeModule).toMatch(/const\s+DEFAULT_CAPACITY:\s*usize\s*=\s*\d+/);
    expect(storeModule).toMatch(/CapacityExceeded/);
    const insertBody = extractModule(storeModule, "fn insert(&mut self, handle: SecretHandle) ->");
    const capacityCheckIndex = insertBody.indexOf("CapacityExceeded");
    const firstPushIndex = insertBody.indexOf(".push(");
    expect(capacityCheckIndex).toBeGreaterThan(-1);
    expect(firstPushIndex).toBeGreaterThan(-1);
    expect(capacityCheckIndex, "the capacity check must appear before any slot growth").toBeLessThan(firstPushIndex);
  });

  it("7. destroy zeroizes via SecretHandle's own clear() -- never a raw byte overwrite reimplemented in the store", () => {
    expect(storeModule).toMatch(/handle\.clear\(\)/);
    expect(storeModule).not.toMatch(/unsafe\s*\{/);
  });

  it("8. generation counter advances on every destroy -- stale-id detection is structurally present", () => {
    expect(storeModule).toMatch(/generation\.wrapping_add\(1\)/);
    expect(storeModule).toMatch(/StaleGeneration/);
  });

  it("9. Drop is implemented as a backstop that clears every live handle", () => {
    expect(storeModule).toMatch(/impl\s+Drop\s+for\s+SecretHandleStore/);
    expect(storeModule).toMatch(/fn\s+drop\s*\(&mut self\)\s*\{\s*\n\s*self\.clear_all\(\)/);
  });

  it("10. no #[wasm_bindgen] anywhere in the store/page-locking/diagnostics modules -- this Arc adds zero new WASM export surface", () => {
    expect(storeModule).not.toMatch(/#\[wasm_bindgen\]/);
    expect(pageLockingModule).not.toMatch(/#\[wasm_bindgen\]/);
    expect(diagnosticsModule).not.toMatch(/#\[wasm_bindgen\]/);
  });
});

describe("Secure Runtime Alpha 6281-6360 -- page-locking capability, no overclaim", () => {
  it("11. mlock/VirtualLock/libc/windows-sys/region/memsec are named as VOCABULARY ONLY -- never called, imported, or implemented", () => {
    // The mission itself requires naming this fixed vocabulary in prose
    // ("so a future implementation stage has a fixed vocabulary") --
    // this guard checks for actual IMPLEMENTATION, not mention: no FFI
    // call syntax, no crate import, no unsafe block.
    expect(pageLockingModule).not.toMatch(/\bmlock\s*\(|\bmunlock\s*\(|\bVirtualLock\s*\(|\bVirtualUnlock\s*\(/);
    expect(pageLockingModule).not.toMatch(/use\s+libc\b|use\s+windows_sys\b|use\s+region\b|use\s+memsec\b/);
    expect(pageLockingModule).not.toMatch(/unsafe\s*\{/);
  });

  it("12. the capability function never returns Active in source -- Active exists only as a named, unreachable future variant", () => {
    const fnBody = extractModule(pageLockingModule, "fn page_locking_capability() ->");
    expect(fnBody).not.toMatch(/PageLockingCapability::Active/);
  });

  it("13. closed, four-variant vocabulary -- no fifth variant silently added", () => {
    const enumBlock = extractModule(pageLockingModule, "pub(crate) enum PageLockingCapability {");
    const variants = [...enumBlock.matchAll(/^\s{8}(\w+),/gm)].map((m) => m[1]);
    expect(variants).toEqual(["Unsupported", "NotRequested", "FutureNativeOnly", "Active"]);
  });
});

describe("Secure Runtime Alpha 6281-6360 -- safe diagnostics only (Phase K)", () => {
  it("14. SecureMemoryFoundationDiagnostics has no field capable of holding a secret byte -- every field is usize/bool/a closed enum", () => {
    const structBlock = extractModule(
      diagnosticsModule,
      "pub(crate) struct SecureMemoryFoundationDiagnostics {",
    );
    const fieldTypes = [...structBlock.matchAll(/pub\(crate\)\s+\w+:\s*([^,\n]+)/g)].map((m) => (m[1] ?? "").trim());
    for (const fieldType of fieldTypes) {
      expect(["usize", "bool", "PageLockingCapability"]).toContain(fieldType);
    }
  });

  it("15. no secret byte, size-that-narrows-a-secret, fingerprint, handle enumeration, memory address, or allocator detail anywhere in this module", () => {
    expect(diagnosticsModule).not.toMatch(/\[u8;\s*32\]/);
    expect(diagnosticsModule).not.toMatch(/Vec<u8>/);
    expect(diagnosticsModule).not.toMatch(/fingerprint|address|allocator/i);
    expect(diagnosticsModule).not.toMatch(/fn\s+handles\s*\(|fn\s+iter\s*\(/);
  });
});

describe("Secure Runtime Alpha 6281-6360 -- NIP-44 zeroization closure, no raw export/no regression", () => {
  it("16. Nip44MessageKeyDecision's ChachaKey/HmacKey are SecretHandle-backed -- 'handle' field exists alongside 'bytes'", () => {
    expect(nip44MessageKeysSource).toMatch(
      /pub\(crate\)\s+handle:\s*Option<SecretHandle>/,
    );
  });

  it("17. the classification labels stay algorithm-agnostic in lib.rs -- no concrete cipher name (chacha/poly1305/xchacha/aes/gcm) inside the secret_handle module itself", () => {
    const secretHandleModule = extractModule(libRsSource, "mod secret_handle {");
    // Excludes the sibling `secret_handle_store`/deeper modules this file
    // also declares elsewhere in lib.rs -- `extractModule`'s own brace
    // matching stops at `secret_handle`'s own closing brace.
    expect(secretHandleModule).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
  });

  it("18. wire encrypt/decrypt never call a generic expose()/as_bytes() -- only the narrow, named accessor", () => {
    expect(nip44WireEncryptSource).toMatch(/expose_bytes_for_internal_nip44_message_key/);
    expect(nip44WireDecryptSource).toMatch(/expose_bytes_for_internal_nip44_message_key/);
    expect(nip44WireEncryptSource).not.toMatch(/\.expose\(\)|\.as_bytes\(\)/);
    expect(nip44WireDecryptSource).not.toMatch(/\.expose\(\)|\.as_bytes\(\)/);
  });

  it("19. local ChachaKey/HmacKey copies are explicitly zeroized in both wire encrypt and wire decrypt after use", () => {
    expect(nip44WireEncryptSource).toMatch(/chacha_key\.zeroize\(\)/);
    expect(nip44WireEncryptSource).toMatch(/hmac_key\.zeroize\(\)/);
    expect(nip44WireDecryptSource).toMatch(/chacha_key\.zeroize\(\)/);
    expect(nip44WireDecryptSource).toMatch(/hmac_key\.zeroize\(\)/);
  });

  it("20. chacha_nonce is deliberately NOT handle-wrapped -- it stays a plain byte extraction (not confidential, transmitted on the wire)", () => {
    expect(nip44MessageKeysSource).toMatch(
      /Nip44DerivedKeyKind::ChachaNonce,\s*\n\s*status:\s*Nip44MessageKeyStatus::Ready,\s*\n\s*bytes:\s*Some\(okm\[32\.\.44\]\.to_vec\(\)\),\s*\n\s*handle:\s*None,/,
    );
  });
});
