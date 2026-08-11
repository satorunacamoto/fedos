import { describe, it, expect } from "vitest";
import { verifyNostrEventId } from "../src/os/messenger/desktop/nostr_event_id_verifier.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_243_canonical_event_id_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import verifierSource from "../src/os/messenger/desktop/nostr_event_id_verifier.ts?raw";

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
 * Secure Runtime Alpha 243 -- "Canonical Event ID Verification": Stage
 * 3 of the Nostr Inbound Event Validation Arc. Adds
 * src/desktop/nostr_event_id_verifier.ts, exporting
 * verifyNostrEventId -- a pure, fail-closed NIP-01 canonical Event ID
 * verifier, reconciling the Alpha 191 JSON.stringify escaping
 * divergence with a correct six-character escaper.
 */
describe("Secure Runtime Alpha 243 -- Canonical Event ID Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/nostr_event_id_verifier\.ts`\./,
    );
  });

  it("3. structural: verifyNostrEventId is the only export, and the escaper matches exactly six NIP-01 characters", () => {
    const exportNames = [...verifierSource.matchAll(/^export function (\w+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(exportNames).toEqual(["verifyNostrEventId"]);
    expect(verifierSource).toMatch(/case "\\n":/);
    expect(verifierSource).toMatch(/case '"':/);
    expect(verifierSource).toMatch(/case "\\\\":/);
    expect(verifierSource).toMatch(/case "\\r":/);
    expect(verifierSource).toMatch(/case "\\t":/);
    expect(verifierSource).toMatch(/case "\\b":/);
    expect(verifierSource).toMatch(/case "\\f":/);
  });

  it("4. structural: no reference to src/nostr/* or src/sign/* anywhere in this file", () => {
    expect(verifierSource).not.toMatch(/from ".*\/(nostr|sign)\//);
  });

  it("5. structural: fully synchronous -- zero async/Promise/await", () => {
    expect(verifierSource).not.toMatch(/\basync\b|\bawait\b|Promise</);
  });

  it("6. the design doc's own section 3 explains the Alpha 191 divergence reconciliation", () => {
    expect(designDocSource).toMatch(/## 3\. Why NOT `src\/nostr\/event\.ts`'s `verifyEventId`/);
    expect(designDocSource).toMatch(/explicitly reconcile it with the known legacy/);
  });

  it("7. the design doc cross-references Alpha 242, Alpha 244, Alpha 241, Alpha 193, and Alpha 191", () => {
    for (const ref of [
      "secure_runtime_alpha_242_validated_nostr_event_model",
      "secure_runtime_alpha_244_bip340_signature_verification",
      "secure_runtime_alpha_241_existing_inbound_validation_inventory",
      "secure_runtime_alpha_193_canonical_event_serialization",
      "secure_runtime_alpha_191_nostr_event_model_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("8. behavioral: verifies a real, known-valid event id (canonicalization vector)", () => {
    expect(verifyNostrEventId(CANONICALIZATION_EVENT)).toBe(true);
  });

  it("9. behavioral: rejects a tampered id", () => {
    expect(verifyNostrEventId({ ...CANONICALIZATION_EVENT, id: "00".repeat(32) })).toBe(false);
  });

  it("10. behavioral: rejects a tampered content (id no longer matches)", () => {
    expect(verifyNostrEventId({ ...CANONICALIZATION_EVENT, content: "tampered" })).toBe(false);
  });

  it("11. behavioral: rejects a malformed id -- wrong length, uppercase, non-hex", () => {
    expect(verifyNostrEventId({ ...CANONICALIZATION_EVENT, id: "a".repeat(63) })).toBe(false);
    expect(verifyNostrEventId({ ...CANONICALIZATION_EVENT, id: "A".repeat(64) })).toBe(false);
    expect(verifyNostrEventId({ ...CANONICALIZATION_EVENT, id: "g".repeat(64) })).toBe(false);
  });

  it("12. behavioral: never throws, even for hostile input shapes", () => {
    const hostile = { ...CANONICALIZATION_EVENT, tags: null as unknown as readonly (readonly string[])[] };
    expect(() => verifyNostrEventId(hostile)).not.toThrow();
    expect(verifyNostrEventId(hostile)).toBe(false);
  });

  it("13. behavioral: pure -- calling it twice with the same input produces identical output", () => {
    expect(verifyNostrEventId(CANONICALIZATION_EVENT)).toBe(verifyNostrEventId(CANONICALIZATION_EVENT));
  });
});
