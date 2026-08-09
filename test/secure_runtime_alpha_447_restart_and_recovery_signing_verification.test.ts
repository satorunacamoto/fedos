import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_447_restart_and_recovery_signing_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import lib from "../packages/fedos-core-rust/src/lib.rs?raw";
import { verifyNostrEventId } from "../src/os/messenger/desktop/nostr_event_id_verifier.js";
import { verifyNostrEventSignature } from "../src/os/messenger/desktop/nostr_signature_verifier.js";

describe("Secure Runtime Alpha 447 -- Restart and Recovery Signing Verification", () => {
  it("documents all eight required restart-simulation steps in order", () => {
    for (let n = 1; n <= 8; n++) {
      expect(doc).toMatch(new RegExp(`^${n}\\. `, "m"));
    }
  });

  it("restore_sealed_round_trips_to_the_identical_signing_identity uses a genuinely SEPARATE authority instance, not the same one", () => {
    const test = (lib.match(
      /fn restore_sealed_round_trips_to_the_identical_signing_identity\(\) \{[\s\S]*?\n    \}/,
    ) ?? [""])[0];
    expect(test).toContain("let original = generated_authority();");
    expect(test).toContain("let mut restored = FedosMasterSeedAuthority::new();");
    expect(test).toContain("assert_eq!(original_event, restored_event);");
  });

  it("no restore failure path ever calls generate() as a fallback", () => {
    const restoreFn = (lib.match(/pub fn restore_sealed\(&mut self,[\s\S]*?\n    \}/) ?? [""])[0];
    expect(restoreFn).not.toMatch(/self\.generate\(\)/);
  });

  it("the captured real fixture reproduced in this doc independently verifies", () => {
    const fixtureMatch = doc.match(/```json\r?\n(\{.*\})\r?\n```/);
    expect(fixtureMatch).not.toBeNull();
    const event = JSON.parse(fixtureMatch![1]);
    expect(verifyNostrEventId(event)).toBe(true);
    expect(verifyNostrEventSignature(event)).toBe(true);
  });
});
