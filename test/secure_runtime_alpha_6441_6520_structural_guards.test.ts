import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import directRatchetSessionSource from "../packages/fedos-core-rust/src/crypto/direct_ratchet_session.rs?raw";

/**
 * Secure Runtime Alpha 6441-6520 (FedOS Secure Memory Secret-Flow
 * Migration and Native Page-Locking Readiness Arc) — Phase C/F structural
 * guards for this Arc's own migration target: the
 * `FedosDirectRatchetSession::seal_*`/`restore` WASM-exported methods
 * (`lib.rs`) and `DirectRatchetSessionState::restore` (`direct_ratchet_session.rs`).
 */

function extractFn(source: string, marker: string): string {
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

describe("Secure Runtime Alpha 6441-6520 -- Direct Ratchet seal/restore zeroization closure", () => {
  it("1. every seal_* method zeroizes its own local byte copy after use", () => {
    for (const fnName of ["fn seal_root_key(", "fn seal_sending_chain_key(", "fn seal_receiving_chain_key(", "fn seal_local_ratchet_private_key("]) {
      const body = extractFn(libRsSource, fnName);
      expect(body, `${fnName} must zeroize its own bytes copy`).toMatch(/bytes\.zeroize\(\)/);
    }
    const skippedBody = extractFn(libRsSource, "fn seal_all_skipped_keys(");
    expect(skippedBody).toMatch(/bytes\.zeroize\(\)/);
  });

  it("2. restore_32's own decrypted Vec<u8> plaintext is zeroized on every exit path", () => {
    const restoreBody = extractFn(libRsSource, "fn restore(");
    const restore32 = extractFn(restoreBody, "fn restore_32(");
    // Two exits: the length-mismatch early return, and the success path.
    const zeroizeCount = (restore32.match(/bytes\.zeroize\(\)/g) ?? []).length;
    expect(zeroizeCount).toBeGreaterThanOrEqual(2);
  });

  it("3. the outer restore() zeroizes its own root/sending/receiving/local-private-key stack copies after handing them to DirectRatchetSessionState::restore", () => {
    const restoreBody = extractFn(libRsSource, "fn restore(");
    expect(restoreBody).toMatch(/root_key_bytes\.zeroize\(\)/);
    expect(restoreBody).toMatch(/sending_chain_key_bytes\.zeroize\(\)/);
    expect(restoreBody).toMatch(/receiving_chain_key_bytes\.zeroize\(\)/);
    expect(restoreBody).toMatch(/local_ratchet_private_key_bytes\.zeroize\(\)/);
  });

  it("4. DirectRatchetSessionState::restore zeroizes every raw parameter copy after wrapping it in a SecretHandle", () => {
    const restoreBody = extractFn(directRatchetSessionSource, "pub(crate) fn restore(");
    expect(restoreBody).toMatch(/local_ratchet_private_key_bytes\.zeroize\(\)/);
    expect(restoreBody).toMatch(/root_key_bytes\.zeroize\(\)/);
    expect(restoreBody).toMatch(/bytes\.zeroize\(\)/); // sending/receiving closures + skipped-keys loop
  });

  it("5. no println!/eprintln!/dbg! anywhere in the touched files", () => {
    expect(libRsSource).not.toMatch(/\bprintln!\(|\beprintln!\(|\bdbg!\(/);
    expect(directRatchetSessionSource).not.toMatch(/\bprintln!\(|\beprintln!\(|\bdbg!\(/);
  });

  it("6. the seal/restore region never hex-encodes or format!s a raw secret local -- only the public key and the already-sealed (ciphertext) blob", () => {
    const sealAllSkipped = extractFn(libRsSource, "fn seal_all_skipped_keys(");
    const formatCalls = [...sealAllSkipped.matchAll(/format!\(([^)]*)\)/g)].map((m) => m[1]);
    for (const args of formatCalls) {
      expect(args).not.toMatch(/\bbytes\b/);
    }
  });

  it("7. FedosDirectRatchetSession and DirectRatchetSessionState still carry zero derives (no Clone/Debug/Serialize) -- unchanged by this Arc", () => {
    const structIndex = libRsSource.indexOf("pub struct FedosDirectRatchetSession {");
    expect(structIndex).toBeGreaterThan(-1);
    const preceding = libRsSource.slice(Math.max(0, structIndex - 200), structIndex);
    expect(preceding).not.toMatch(/#\[derive\(/);

    const stateIndex = directRatchetSessionSource.indexOf("pub(crate) struct DirectRatchetSessionState {");
    expect(stateIndex).toBeGreaterThan(-1);
    const statePreceding = directRatchetSessionSource.slice(Math.max(0, stateIndex - 200), stateIndex);
    expect(statePreceding).not.toMatch(/#\[derive\(/);
  });

  it("8. seal_* methods return only Option<String>/Vec<String> (opaque sealed blobs), never raw bytes -- restore() returns only Option<FedosDirectRatchetSession>", () => {
    expect(libRsSource).toMatch(/pub fn seal_root_key\([^)]*\)\s*->\s*Option<String>/s);
    expect(libRsSource).toMatch(/pub fn seal_all_skipped_keys\([^)]*\)\s*->\s*Vec<String>/s);
    expect(libRsSource).toMatch(/pub fn restore\(/);
    const restoreSignature = libRsSource.slice(
      libRsSource.indexOf("pub fn restore(", libRsSource.indexOf("impl FedosDirectRatchetSession")),
      libRsSource.indexOf("{", libRsSource.indexOf("pub fn restore(", libRsSource.indexOf("impl FedosDirectRatchetSession"))),
    );
    expect(restoreSignature).toMatch(/->\s*Option<FedosDirectRatchetSession>/);
  });
});
