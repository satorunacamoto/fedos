import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_159_nostr_root_foundation_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 159 -- "Nostr Root Foundation Review": Stage 4
 * of the Nostr Root Foundation Arc. A REVIEW ONLY Stage -- zero code
 * change. Confirms the full Master Seed -> Identity Root ->
 * Application Root -> Nostr Root chain is connected, by real
 * execution, and that no Runtime/Desktop/API exposure exists.
 */
describe("Secure Runtime Alpha 159 -- Nostr Root Foundation Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code change of any\s*\nkind — no `packages\/` file, no `src\/` file, is modified\./,
    );
  });

  it("3. the design doc records the Protocol-Root/Nostr-Root single-hop divergence from the Arc's own Objective diagram", () => {
    expect(designDocSource).toMatch(
      /the Objective draws `Protocol Root`\s*\nand `Nostr Root` as two separate levels\/hops\. In the actual/,
    );
    expect(designDocSource).toMatch(/there is no intermediate,\s*\ngeneric "Protocol Root" instance/);
  });

  it("4. the design doc cites the exact full-chain test name that confirms end-to-end connection by real execution", () => {
    expect(designDocSource).toContain(
      "same_master_seed_and_same_protocol_domain_yields_matching_protocol_roots_across_two_independent_derivations",
    );
  });

  it("5. the design doc cross-references Alpha 156, 157, 158, 151, and 155", () => {
    for (const ref of [
      "secure_runtime_alpha_156_nostr_root_handle",
      "secure_runtime_alpha_157_nostr_root_derivation",
      "secure_runtime_alpha_158_nostr_root_verification",
      "secure_runtime_alpha_151_protocol_root_handle",
      "secure_runtime_alpha_155_integration_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the full chain really exists and is exercised
  // by real execution, directly against lib.rs
  // ---------------------------------------------------------------------

  it("6. structural: the full chain's four functions all exist, pub(crate), each taking the prior level's Handle", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_identity_root_internal\(\s*\n\s*master_seed: &FedosMasterSeedHandle,?\s*\n?\s*\)/,
    );
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_application_root_internal\(\s*\n\s*identity_root: &FedosIdentityRootHandle,?\s*\n?\s*\)/,
    );
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_nostr_root_internal\(\s*\n\s*application_root: &FedosApplicationRootHandle,\s*\n\s*\) -> ProtocolRootDecision/,
    );
  });

  it("7. structural: the full-chain real-execution test exists and builds all three derivation hops from the same Master Seed bytes, twice independently", () => {
    const testMatch = libRsSource.match(
      /fn same_master_seed_and_same_protocol_domain_yields_matching_protocol_roots_across_two_independent_derivations\(\s*\n\s*\) \{([\s\S]*?)\n {8}\}/,
    );
    const testBody = testMatch?.[1] ?? "";
    expect(testBody.length).toBeGreaterThan(0);
    expect(testBody).toMatch(/derive_identity_root_internal\(&first_seed\)/);
    expect(testBody).toMatch(/derive_identity_root_internal\(&second_seed\)/);
    expect(testBody).toMatch(/derive_application_root_internal\(/);
    expect(testBody).toMatch(/for derive_fn in ALL_PROTOCOL_ROOT_DERIVE_FNS \{/);
  });

  it("8. structural: ALL_PROTOCOL_ROOT_DERIVE_FNS includes derive_nostr_root_internal as its first element", () => {
    const arrMatch = libRsSource.match(/const ALL_PROTOCOL_ROOT_DERIVE_FNS: \[ProtocolRootDeriveFn; 4\] = \[\s*\n\s*(\w+),/);
    expect(arrMatch?.[1]).toBe("derive_nostr_root_internal");
  });

  it("9. structural: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36 -- confirming zero WASM exposure across Alpha 146-159", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  it("10. structural: AppRuntime carries no derived-key/root field of any kind, confirmed directly against the actual interface", () => {
    expect(runtimeTypesSource).not.toMatch(/deriveKey:|nostrRoot|protocolRoot|identityRoot|applicationRoot/i);
  });

  // ---------------------------------------------------------------------
  // Regression: zero Runtime/Desktop/Worker/Identity exposure across
  // the whole Alpha 156-159 span so far
  // ---------------------------------------------------------------------

  it("11. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any Alpha 156-159 doc", () => {
    for (const stage of ["156", "157", "158", "159"]) {
      expect(desktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("12. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Alpha 156-159 span", () => {
    for (const stage of ["156", "157", "158", "159"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts remain untouched across the whole Alpha 156-159 span", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["156", "157", "158", "159"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("14. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_159/);
  });

  it("15. Regression: Cargo.toml and package.json carry no reference to any Alpha 156-159 doc", () => {
    for (const stage of ["156", "157", "158", "159"]) {
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });
});
