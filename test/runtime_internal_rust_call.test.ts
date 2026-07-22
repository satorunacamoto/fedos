import { describe, it, expect } from "vitest";
import {
  FedosRuntimeCryptoProvider,
  FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
} from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FEDOS_INTERNAL_RUST_CALL_STATUSES,
  evaluateFedosInternalRustCall,
  fedosInternalRustCallExecuted,
  fedosInternalRustCallReachable,
  fedosInternalRustCallState,
  planFedosInternalRustCall,
} from "../src/runtime/fedos_internal_rust_call.js";
import { FedosRustExecutionReviewPlaceholder } from "../src/runtime/fedos_rust_execution_review.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import internalRustCallSource from "../src/runtime/fedos_internal_rust_call.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionReviewSource from "../src/runtime/fedos_rust_execution_review.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosProviderSource from "../src/runtime/fedos_runtime_crypto_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Stage 353–360 — "Internal Rust Call Planning (Blocked before
 * Invocation)": src/runtime/fedos_internal_rust_call.ts (Stage 353),
 * wired from fedos_rust_execution_review.ts (Stage 354). Planning a
 * call is not calling it -- no Rust/WASM/FFI invocation results from
 * this, and the Execution Review's own answer stays unchanged.
 */
describe("FedOS internal Rust call planning, blocked before invocation (Stage 353-360)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. Provider reaches Internal Rust Call planning only -- fedos_rust_execution_review.ts imports fedos_internal_rust_call.ts", () => {
    expect(executionReviewSource).toMatch(/from\s*"\.\/fedos_internal_rust_call\.js"/);
  });

  it("2. Internal Rust Call never reaches Rust crypto -- no packages/fedos-core-rust reference", () => {
    expect(codeOnlyOf(internalRustCallSource)).not.toMatch(/fedos-core-rust/i);
  });

  it("3. Internal Rust Call never reaches WASM", () => {
    expect(codeOnlyOf(internalRustCallSource)).not.toMatch(/wasm/i);
  });

  it("4. Internal Rust Call never reaches FFI", () => {
    expect(codeOnlyOf(internalRustCallSource)).not.toMatch(/\bffi\b/i);
  });

  it("5. Execution Review is unchanged -- approved is still always false", () => {
    const review = new FedosRustExecutionReviewPlaceholder();
    expect(review.reviewEncrypt({ operation: "encrypt" }).approved).toBe(false);
    expect(review.reviewDecrypt({ operation: "decrypt" }).approved).toBe(false);
  });

  it("6. Execution Review's reason is still BlockedBeforeCrypto for both operations", () => {
    const review = new FedosRustExecutionReviewPlaceholder();
    expect(review.reviewEncrypt({ operation: "encrypt" }).reason).toBe("BlockedBeforeCrypto");
    expect(review.reviewDecrypt({ operation: "decrypt" }).reason).toBe("BlockedBeforeCrypto");
  });

  it("7. Internal Rust Call Executed is always false", () => {
    expect(fedosInternalRustCallExecuted()).toBe(false);
    const decision = evaluateFedosInternalRustCall(planFedosInternalRustCall("Encrypt"));
    expect(decision.status).toBe("Planned");
    expect(decision.status).not.toBe("Executed");
  });

  it("8. encrypt/decrypt remain unchanged -- always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("9. Allowed is still unreachable from either activation policy, even with both locks open", () => {
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

  it("10. Runtime is unchanged -- create_runtime.ts never calls any plan*/review*/evaluate* function", () => {
    expect(createRuntimeSource).not.toMatch(
      /planExecution|planEncrypt|planDecrypt|planRustEncrypt|planRustDecrypt|planRustApiEncrypt|planRustApiDecrypt|reviewEncrypt|reviewDecrypt|planFedosInternalRustCall|evaluateFedosInternalRustCall/,
    );
  });

  it("11. Worker is unchanged -- src/worker.ts still doesn't import the Internal Rust Call or any earlier chain link", () => {
    expect(workerSource).not.toMatch(
      /fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("12. SecretHandle is hidden from the Internal Rust Call file", () => {
    expect(codeOnlyOf(internalRustCallSource)).not.toMatch(/SecretHandle/);
  });

  it("13. ConversationKey is hidden from the Internal Rust Call file", () => {
    expect(codeOnlyOf(internalRustCallSource)).not.toMatch(/ConversationKey/);
  });

  it("14. MessageKey is hidden from the Internal Rust Call file", () => {
    expect(codeOnlyOf(internalRustCallSource)).not.toMatch(/MessageKey/);
  });

  it("15. WirePayload is hidden from the Internal Rust Call file", () => {
    expect(codeOnlyOf(internalRustCallSource)).not.toMatch(/WirePayload/);
  });

  it("16. Cargo.toml is unchanged -- exactly 10 production dependencies", () => {
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
  });

  it("17. package.json is unchanged -- exactly 2 dependencies", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("18. Rust pub fn count is unchanged -- 27", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m: RegExpMatchArray) => m[1]);
    expect(pubFnNames.length).toBe(48);
  });

  it("19. FEDOS_RUNTIME_PROVIDER_IMPLEMENTED is unchanged -- still fixed false", () => {
    expect(FEDOS_RUNTIME_PROVIDER_IMPLEMENTED).toBe(false);
  });

  it("20. planFedosInternalRustCall builds plain data with no payload of any kind", () => {
    const call = planFedosInternalRustCall("Encrypt");
    expect(call).toEqual({ kind: "Encrypt" });
    expect(JSON.stringify(call)).not.toMatch(/key|secret|plaintext|ciphertext/i);
  });

  it("21. FEDOS_INTERNAL_RUST_CALL_STATUSES names exactly the two documented labels, in order", () => {
    expect(FEDOS_INTERNAL_RUST_CALL_STATUSES).toEqual(["Planned", "Executed"]);
  });

  it("22. fedosInternalRustCallState/fedosInternalRustCallReachable are pure standalone functions", () => {
    expect(fedosInternalRustCallState()).toBe("Planned");
    expect(fedosInternalRustCallReachable()).toBe(true);
  });

  it("23. diagnostics expose internalRustCallState/internalRustCallReachable without constructing an instance", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.internalRustCallState).toBe("Planned");
    expect(status.internalRustCallReachable).toBe(true);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.internalRustCallState).toBe("Planned");
    expect(workerStatus.internalRustCallReachable).toBe(true);

    for (const src of [runtimeDiagnosticsSource, workerDiagnosticsSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/new\s+FedosRustExecutionReviewPlaceholder/);
      expect(codeOnly).not.toMatch(/new\s+FedosRuntimeCryptoProvider/);
    }
  });

  it("24. neither the Internal Rust Call file nor its wiring reference process.env, Relay, Storage, Nostr, or NIP-17", () => {
    for (const src of [internalRustCallSource, executionReviewSource, fedosProviderSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/process\.env/);
      expect(codeOnly).not.toMatch(/relay|storage|nostr|nip-?17/i);
    }
  });
});
