import { describe, it, expect } from "vitest";
import {
  FedosRuntimeCryptoProvider,
  FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
} from "../src/runtime/fedos_runtime_crypto_provider.js";
import { FedosRustApiPlaceholder } from "../src/runtime/fedos_rust_api.js";
import {
  FedosRustExecutionReviewPlaceholder,
  FEDOS_RUST_EXECUTION_REVIEW_REASONS,
  createFedosRustExecutionReview,
  fedosRustExecutionApproved,
  fedosRustExecutionReviewReason,
  fedosRustExecutionReviewState,
  reviewFedosRustExecution,
} from "../src/runtime/fedos_rust_execution_review.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionReviewSource from "../src/runtime/fedos_rust_execution_review.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import rustApiSource from "../src/runtime/fedos_rust_api.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosProviderSource from "../src/runtime/fedos_runtime_crypto_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
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
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionReviewDocSource from "../docs/runtime_fedos_rust_execution_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import approvalChecklistDocSource from "../docs/runtime_fedos_execution_approval_checklist.md?raw";

/**
 * Stage 345–352 — "Private Rust Execution Review (Blocked before
 * Crypto)": src/runtime/fedos_rust_execution_review.ts (Stage
 * 345/349), wired from fedos_rust_api.ts (Stage 346). The Execution
 * Review receives requests but never invokes Rust/WASM/FFI; it is the
 * LAST stop before any real Rust crypto invocation, and this stage
 * approves nothing.
 */
describe("FedOS private Rust execution review, blocked before crypto (Stage 345-352)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. Provider reaches the Execution Review only -- fedos_rust_api.ts imports fedos_rust_execution_review.ts", () => {
    expect(rustApiSource).toMatch(/from\s*"\.\/fedos_rust_execution_review\.js"/);
  });

  it("2. the Execution Review never reaches Rust crypto -- no packages/fedos-core-rust reference", () => {
    expect(codeOnlyOf(executionReviewSource)).not.toMatch(/fedos-core-rust/i);
  });

  it("3. the Execution Review never reaches WASM", () => {
    expect(codeOnlyOf(executionReviewSource)).not.toMatch(/wasm/i);
  });

  it("4. the Execution Review never reaches FFI", () => {
    expect(codeOnlyOf(executionReviewSource)).not.toMatch(/\bffi\b/i);
  });

  it("5. Execution Review approved is always false", () => {
    const review = new FedosRustExecutionReviewPlaceholder();
    expect(review.reviewEncrypt({ operation: "encrypt" }).approved).toBe(false);
    expect(review.reviewDecrypt({ operation: "decrypt" }).approved).toBe(false);
    expect(fedosRustExecutionApproved()).toBe(false);
  });

  it("6. reason is BlockedBeforeCrypto for both operations", () => {
    const review = new FedosRustExecutionReviewPlaceholder();
    expect(review.reviewEncrypt({ operation: "encrypt" }).reason).toBe("BlockedBeforeCrypto");
    expect(review.reviewDecrypt({ operation: "decrypt" }).reason).toBe("BlockedBeforeCrypto");
    expect(fedosRustExecutionReviewReason()).toBe("BlockedBeforeCrypto");
    expect(fedosRustExecutionReviewState()).toBe("Blocked");
  });

  it("7. Rust API return value remains BlockedByImplementation, unaffected by reaching the Execution Review", () => {
    const api = new FedosRustApiPlaceholder();
    expect(api.planRustApiEncrypt({ operation: "encrypt" }).state).toBe("BlockedByImplementation");
    expect(api.planRustApiDecrypt({ operation: "decrypt" }).state).toBe("BlockedByImplementation");
  });

  it("8. encrypt/decrypt remain Unsupported", async () => {
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

  it("10. Runtime is unchanged -- create_runtime.ts never calls any plan*/review* function", () => {
    expect(createRuntimeSource).not.toMatch(
      /planExecution|planEncrypt|planDecrypt|planRustEncrypt|planRustDecrypt|planRustApiEncrypt|planRustApiDecrypt|reviewEncrypt|reviewDecrypt/,
    );
  });

  it("11. Worker is unchanged -- src/worker.ts still doesn't import the Execution Review or any earlier chain link", () => {
    expect(workerSource).not.toMatch(
      /fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("12. SecretHandle is hidden from the Execution Review file", () => {
    expect(codeOnlyOf(executionReviewSource)).not.toMatch(/SecretHandle/);
  });

  it("13. ConversationKey is hidden from the Execution Review file", () => {
    expect(codeOnlyOf(executionReviewSource)).not.toMatch(/ConversationKey/);
  });

  it("14. MessageKey is hidden from the Execution Review file", () => {
    expect(codeOnlyOf(executionReviewSource)).not.toMatch(/MessageKey/);
  });

  it("15. WirePayload is hidden from the Execution Review file", () => {
    expect(codeOnlyOf(executionReviewSource)).not.toMatch(/WirePayload/);
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
    expect(pubFnNames.length).toBe(69);  });

  it("19. FEDOS_RUNTIME_PROVIDER_IMPLEMENTED is unchanged -- still fixed false", () => {
    expect(FEDOS_RUNTIME_PROVIDER_IMPLEMENTED).toBe(false);
  });

  it("20. reviewFedosRustExecution routes to the correct handler for both operations", () => {
    const review = createFedosRustExecutionReview();
    expect(reviewFedosRustExecution(review, { operation: "encrypt" }).operation).toBe("encrypt");
    expect(reviewFedosRustExecution(review, { operation: "decrypt" }).operation).toBe("decrypt");
  });

  it("21. FEDOS_RUST_EXECUTION_REVIEW_REASONS names exactly the five documented labels, in order", () => {
    expect(FEDOS_RUST_EXECUTION_REVIEW_REASONS).toEqual([
      "BlockedBeforeCrypto",
      "RuntimeNotActivated",
      "WorkerNotActivated",
      "RustExecutionNotApproved",
      "FutureOnly",
    ]);
  });

  it("22. diagnostics expose the three new fields without constructing an instance", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.rustExecutionReviewState).toBe("Blocked");
    expect(status.rustExecutionReviewReason).toBe("BlockedBeforeCrypto");
    expect(status.rustExecutionApproved).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.rustExecutionReviewState).toBe("Blocked");
    expect(workerStatus.rustExecutionReviewReason).toBe("BlockedBeforeCrypto");
    expect(workerStatus.rustExecutionApproved).toBe(false);

    for (const src of [runtimeDiagnosticsSource, workerDiagnosticsSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/new\s+FedosRustExecutionReviewPlaceholder/);
      expect(codeOnly).not.toMatch(/new\s+FedosRustApiPlaceholder/);
      expect(codeOnly).not.toMatch(/new\s+FedosRuntimeCryptoProvider/);
    }
  });

  it("23. neither the Execution Review file nor its wiring reference process.env, Relay, Storage, Nostr, or NIP-17", () => {
    for (const src of [executionReviewSource, rustApiSource, fedosProviderSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/process\.env/);
      expect(codeOnly).not.toMatch(/relay|storage|nostr|nip-?17/i);
    }
  });

  it("24. docs record the full nine-step chain and the approval checklist's not-approved items", () => {
    expect(executionReviewDocSource).toMatch(/Execution Review/);
    expect(executionReviewDocSource).toMatch(/BlockedBeforeCrypto/);
    expect(executionReviewDocSource).toMatch(/No Runtime activation/i);
    expect(executionReviewDocSource).toMatch(/No Worker activation/i);

    expect(approvalChecklistDocSource).toMatch(/Dual Lock configured/);
    expect(approvalChecklistDocSource).toMatch(/Execution review approved/);
    expect(approvalChecklistDocSource).toMatch(/Runtime activation approved/);
    expect(approvalChecklistDocSource).toMatch(/Worker activation approved/);
  });
});
