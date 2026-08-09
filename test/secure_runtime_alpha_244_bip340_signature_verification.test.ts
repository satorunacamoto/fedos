import { describe, it, expect } from "vitest";
import { verifyNostrEventSignature } from "../src/desktop/nostr_signature_verifier.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_244_bip340_signature_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import verifierSource from "../src/os/messenger/desktop/nostr_signature_verifier.ts?raw";

const CANONICALIZATION_EVENT: FedosNostrWireEvent = {
  id: "42e04d5703c1ce6b135d167273eb4936720f008c517e2d9120445616b9e8c660",
  pubkey: "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
  created_at: 1700000300,
  kind: 1,
  tags: [],
  content:
    'quote:" backslash:\\ newline:\n cr:\r tab:\t backspace:\b formfeed:\f nonascii: héllo 世界 🎉',
  sig: "8096bd74d3289b9cc89dfb232f9be67c77cf38159752e1387793d1d527e707b6197aaadab40da763593806bebbdd75b614b165f81b5b8e1d118480d8b1ee6242",
};

/**
 * Secure Runtime Alpha 244 -- "BIP-340 Signature Verification": Stage
 * 4 of the Nostr Inbound Event Validation Arc. Adds
 * src/desktop/nostr_signature_verifier.ts, exporting
 * verifyNostrEventSignature -- calls schnorr.verify directly (Option
 * C), never wraps NobleSignatureVerifier, never re-verifies the id.
 */
describe("Secure Runtime Alpha 244 -- BIP-340 Signature Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/nostr_signature_verifier\.ts`\./,
    );
  });

  it("3. the design doc's own section 2 compares all four options and adopts exactly Option C", () => {
    expect(designDocSource).toMatch(/\*\*A\. Reuse `NobleSignatureVerifier` directly\.\*\* REJECTED/);
    expect(designDocSource).toMatch(/\*\*B\. Reuse an existing Rust verifier/);
    expect(designDocSource).toMatch(
      /\*\*C\. Add a new internal TypeScript verifier using current\s*\ndependencies\.\*\* \*\*ADOPTED\.\*\*/,
    );
    expect(designDocSource).toMatch(/\*\*D\. Add a new wasm export\.\*\* REJECTED/);
  });

  it("4. structural: verifyNostrEventSignature is the only export, and imports schnorr.verify but never schnorr.sign/getPublicKey", () => {
    const exportNames = [...verifierSource.matchAll(/^export function (\w+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(exportNames).toEqual(["verifyNostrEventSignature"]);
    expect(verifierSource).toMatch(/import \{ schnorr \} from "@noble\/curves\/secp256k1\.js";/);
    const codeOnly = verifierSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/schnorr\.sign|schnorr\.getPublicKey/);
  });

  it("5. structural: no reference to src/nostr/* or src/sign/* anywhere in this file", () => {
    expect(verifierSource).not.toMatch(/from ".*\/(nostr|sign)\//);
  });

  it("6. structural: zero console.* call anywhere in this file", () => {
    expect(verifierSource).not.toMatch(/console\./);
  });

  it("7. the design doc cross-references Alpha 243, Alpha 245, and Alpha 241", () => {
    for (const ref of [
      "secure_runtime_alpha_243_canonical_event_id_verification",
      "secure_runtime_alpha_245_combined_inbound_event_validator",
      "secure_runtime_alpha_241_existing_inbound_validation_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("8. behavioral: verifies a real, known-valid signature", () => {
    expect(verifyNostrEventSignature(CANONICALIZATION_EVENT)).toBe(true);
  });

  it("9. behavioral: rejects a tampered signature", () => {
    const sig = CANONICALIZATION_EVENT.sig.slice(0, -1) + (CANONICALIZATION_EVENT.sig.endsWith("9") ? "8" : "9");
    expect(verifyNostrEventSignature({ ...CANONICALIZATION_EVENT, sig })).toBe(false);
  });

  it("10. behavioral: rejects a different (but valid-shaped) pubkey", () => {
    expect(verifyNostrEventSignature({ ...CANONICALIZATION_EVENT, pubkey: "02".repeat(32) })).toBe(false);
  });

  it("11. behavioral: rejects malformed pubkey/signature/id -- wrong length, uppercase, non-hex", () => {
    expect(verifyNostrEventSignature({ ...CANONICALIZATION_EVENT, sig: "abc" })).toBe(false);
    expect(verifyNostrEventSignature({ ...CANONICALIZATION_EVENT, pubkey: "xyz" })).toBe(false);
    expect(verifyNostrEventSignature({ ...CANONICALIZATION_EVENT, id: "nope" })).toBe(false);
    expect(verifyNostrEventSignature({ ...CANONICALIZATION_EVENT, sig: "A".repeat(128) })).toBe(false);
  });

  it("12. behavioral: never throws, even on garbage hex of the right length", () => {
    const bad: FedosNostrWireEvent = {
      ...CANONICALIZATION_EVENT,
      sig: "z".repeat(128),
      pubkey: "z".repeat(64),
      id: "z".repeat(64),
    };
    expect(() => verifyNostrEventSignature(bad)).not.toThrow();
    expect(verifyNostrEventSignature(bad)).toBe(false);
  });

  it("13. behavioral: does NOT itself re-derive/verify event.id -- a malformed id fails only the hex-shape guard, not a recomputation", () => {
    // A structurally-valid-length but WRONG id still lets signature
    // verification run (and correctly fail, since the signature was
    // computed over the ORIGINAL id) -- this function trusts its own
    // caller's ordering rather than recomputing anything itself.
    expect(verifyNostrEventSignature({ ...CANONICALIZATION_EVENT, id: "1".repeat(64) })).toBe(false);
  });
});
