import { describe, it, expect } from "vitest";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import {
  fedosExecutionBackendImplemented,
  fedosExecutionBackendKind,
  fedosExecutionBackendReachable,
  fedosExecutionBackendState,
} from "../src/runtime/fedos_execution_backend.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import phaseReviewSource from "../docs/runtime_architecture_phase_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sequenceSource from "../docs/runtime_backend_implementation_sequence.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import riskRegisterSource from "../docs/runtime_backend_risk_register.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import verificationPolicySource from "../docs/runtime_backend_verification_policy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Stage 409–416 — "Runtime architecture phase review": a design-phase-end
 * review of the Stage 1–408 Runtime -> Provider -> Execution Backend ->
 * FedOS Core chain. Adds four docs and this guard test only — no `src/`
 * code, no new Runtime/Provider/Backend link, no Rust/Cargo/package.json
 * change, no WASM generation, no Runtime/Worker activation.
 */
describe("Runtime architecture phase review, docs only, chain unchanged (Stage 409-416)", () => {
  it("1. all four Stage 409-412 docs exist and are non-empty", () => {
    for (const source of [
      phaseReviewSource,
      sequenceSource,
      riskRegisterSource,
      verificationPolicySource,
    ]) {
      expect(typeof source).toBe("string");
      expect(source.length).toBeGreaterThan(200);
    }
  });

  it("2. WASM is documented as the first candidate, not fixed as the only backend", () => {
    expect(phaseReviewSource).toMatch(/swappable/i);
    expect(phaseReviewSource).toMatch(/first\s+(implementation\s+)?candidate/i);
    expect(phaseReviewSource).not.toMatch(/WASM is the only (possible )?(backend|mechanism|way)/i);
    expect(sequenceSource).not.toMatch(/WASM is the only (possible )?(backend|mechanism|way)/i);
  });

  it("3. Execution Backend swappable/interchangeable policy is restated", () => {
    expect(phaseReviewSource).toMatch(/Execution Backend/);
    expect(phaseReviewSource).toMatch(/backend-agnostic/i);
    expect(phaseReviewSource).toMatch(/Native (Desktop|\/)/i);
    expect(phaseReviewSource).toMatch(/Mobile/i);
  });

  it("4. the next implementation sequence is explicitly named, all 8 items present", () => {
    const requiredPhrases = [
      /toolchain planning/i,
      /wasm32/i,
      /wasm-bindgen/i,
      /WASM artifact generation/i,
      /(TS|TypeScript) loader/i,
      /ping.{0,40}(real|cross-boundary)/i,
      /NIP-44.{0,40}(real|connection)/i,
      /Runtime dev-only activation/i,
      /Worker\/Nostr integration/i,
    ];
    for (const phrase of requiredPhrases) {
      expect(sequenceSource).toMatch(phrase);
    }
  });

  it("5. the risk register names all six fixed risks", () => {
    const requiredRisks = [
      /WASM memory secret handling/i,
      /OneDrive/i,
      /Smart App Control/i,
      /target.{0,5}Cargo\.lock.{0,3}guard/i,
      /public API accidental exposure/i,
      /Runtime accidental activation/i,
    ];
    for (const risk of requiredRisks) {
      expect(riskRegisterSource).toMatch(risk);
    }
  });

  it("6. the verification policy requires cargo check --tests / cargo test via WSL or ASCII path", () => {
    expect(verificationPolicySource).toMatch(/cargo check/);
    expect(verificationPolicySource).toMatch(/cargo check --tests/);
    expect(verificationPolicySource).toMatch(/cargo test/);
    expect(verificationPolicySource).toMatch(/WSL/);
    expect(verificationPolicySource).toMatch(/ASCII/i);
  });

  it("7. no Rust/Cargo/package.json change -- dependency counts and public API unchanged", () => {
    const cargoCode = cargoTomlSource
      .split("\n")
      .map((line: string) => line.replace(/#.*$/, ""))
      .join("\n")
      .toLowerCase();
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);

    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);

    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);  });

  it("8. Allowed is still unreachable from either activation policy", () => {
    const runtimeDecision = evaluateRuntimeCryptoActivation(
      { runtimeCryptoEnabled: true, runtimeCryptoProvider: "fedos" },
      { FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" },
    );
    expect(runtimeDecision.reason).toBe("ProviderUnavailable");
    expect(runtimeDecision.allowed).toBe(false);

    const workerDecision = evaluateWorkerCryptoActivation(
      { workerCryptoEnabled: true, workerCryptoProvider: "fedos" },
      { FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" },
    );
    expect(workerDecision.reason).toBe("ProviderUnavailable");
    expect(workerDecision.allowed).toBe(false);
  });

  it("9. Runtime/Worker remain unconnected -- create_runtime.ts / worker.ts import none of the chain's files", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api/,
    );
    expect(workerSource).not.toMatch(
      /fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("10. Execution Backend diagnostics are unchanged by this docs-only stage", () => {
    expect(fedosExecutionBackendKind()).toBe("Wasm");
    expect(fedosExecutionBackendState()).toBe("Planning");
    expect(fedosExecutionBackendReachable()).toBe(true);
    expect(fedosExecutionBackendImplemented()).toBe(false);
  });
});
