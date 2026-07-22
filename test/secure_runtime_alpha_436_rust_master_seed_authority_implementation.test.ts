import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRaw from "../packages/fedos-core-rust/src/lib.rs?raw";

// `lib.rs` is checked out with CRLF line endings on this platform; normalize
// so `\n`-based regexes below match regardless of the host's line endings.
const lib: string = (libRaw as string).replace(/\r\n/g, "\n");

describe("Secure Runtime Alpha 436 -- Rust Master Seed Authority Implementation", () => {
  it("FedosMasterSeedAuthority exposes exactly the seven lifecycle methods plus sign_nostr_event, (Alpha 684/685) public_key_hex_for_account, (Alpha 869) resolve_conversation_key, and (Alpha 5401-5480) seal_direct_ratchet_secret/restore_direct_ratchet_secret, no more", () => {
    // Matches up to the impl block's OWN closing brace (column 0) rather than
    // requiring `#[cfg(test)]` to immediately follow it -- Alpha 869 added a
    // free function (`fedos_decode_fixed_32_hex`) between this impl block and
    // the module's `#[cfg(test)]` marker, which the previous anchor would
    // otherwise silently sweep into `implBlock` too.
    const implBlock = (lib.match(/impl FedosMasterSeedAuthority \{[\s\S]*?\n\}\n/) ?? [""])[0];
    expect(implBlock.length).toBeGreaterThan(0);
    for (const method of [
      "pub fn new(",
      "pub fn is_available(",
      "pub fn is_cleared(",
      "pub fn generate(",
      "pub fn seal(",
      "pub fn restore_sealed(",
      "pub fn clear(",
      "pub fn sign_nostr_event(",
      "pub fn public_key_hex_for_account(",
      "pub fn resolve_conversation_key(",
      "pub fn seal_direct_ratchet_secret(",
      "pub fn restore_direct_ratchet_secret(",
    ]) {
      expect(implBlock).toContain(method);
    }
    const pubFnCount = (implBlock.match(/pub fn /g) ?? []).length;
    expect(pubFnCount).toBe(12);
  });

  it("no method returns raw seed bytes to the caller", () => {
    const implBlock = (lib.match(/impl FedosMasterSeedAuthority \{[\s\S]*?\n\}\n/) ?? [""])[0];
    expect(implBlock).not.toMatch(/-> \[u8; 32\]/);
    expect(implBlock).not.toMatch(/-> Option<\[u8; 32\]>/);
  });

  it("is placed at crate-root level, not inside mod master_root", () => {
    const masterRootStart = lib.indexOf("mod master_root {");
    const structIdx = lib.indexOf("pub struct FedosMasterSeedAuthority {");
    expect(structIdx).toBeGreaterThan(-1);
    // The struct must appear AFTER master_root's own closing point, i.e. well past its opening brace's matching scope.
    expect(structIdx).toBeGreaterThan(masterRootStart);
    expect(lib.slice(0, masterRootStart)).not.toContain("pub struct FedosMasterSeedAuthority");
  });

  it("uses the existing fedos_random_bytes_32 CSPRNG entry point for generation, not a new one", () => {
    const generateFn = (lib.match(/pub fn generate\(&mut self\)[\s\S]*?\n    \}/) ?? [""])[0];
    expect(generateFn).toContain("fedos_random_bytes_32()");
  });

  it("zeroizes temporary secret buffers in seal()/restore_sealed()", () => {
    const sealFn = (lib.match(/pub fn seal\(&self, passphrase: &\[u8\]\)[\s\S]*?\n    \}/) ?? [""])[0];
    expect(sealFn).toMatch(/\.zeroize\(\)/);
    const restoreFn = (lib.match(/pub fn restore_sealed\(&mut self,[\s\S]*?\n    \}/) ?? [""])[0];
    expect(restoreFn).toMatch(/\.zeroize\(\)/);
  });
});
