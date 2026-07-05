/**
 * Stage 265 — FedOS Runtime Crypto Provider (encrypt/decrypt always Unsupported).
 *
 * A SECOND `RuntimeCryptoProvider` (`src/runtime/crypto_provider.ts`, Stage
 * 249) implementation, named after FedOS specifically — but still calling NO
 * `packages/fedos-core-rust` function (neither the Rust crate nor its
 * TypeScript package boundary, `src/crypto/fedos_core_adapter.ts`). This
 * exists so `src/runtime/runtime_crypto_registry.ts` (Stage 257/266) has a
 * second, distinctly-named entry to register — the actual bridge to a real
 * core is a future, separate, explicitly-reviewed stage.
 *
 * HARD GUARDRAILS:
 *   - `encrypt()`/`decrypt()` ALWAYS resolve to `state: "Unsupported"` —
 *     never `"Placeholder"`/`"NotConnected"`, and never real cryptography.
 *     This is intentionally a MORE restrictive answer than
 *     `PlaceholderRuntimeCryptoProvider`'s (which reports `"NotConnected"`
 *     for a well-formed capability): `"Unsupported"` here signals "this
 *     provider exists but performs no operation of any kind yet", not "a
 *     core could theoretically be connected".
 *   - NO import of `packages/fedos-core-rust` (Rust crate or TS package
 *     boundary), NO import of `src/crypto/fedos_core_adapter.ts`.
 *   - Never throws; never mutates its request argument.
 *
 * Stage 305 adds `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` — a fixed, PRIVATE
 * (well, exported for `runtime_crypto_activation_policy.ts`/
 * `worker_crypto_activation_policy.ts`, Stage 308, to reference as their
 * single source of truth) constant, permanently `false`, with NO env
 * path and NO parameter anywhere that could flip it. It answers ONE
 * question — "does a real encrypt/decrypt implementation exist inside
 * this class" — and is surfaced, read-only, on `status()`'s return value
 * as `implemented`. `encrypt()`/`decrypt()` still ALWAYS resolve
 * `"Unsupported"`, completely unchanged.
 *
 * Stage 306 adds `internalCapabilitySurface()` — an ADDITIONAL,
 * NEW method (never replacing `capabilities()`, which is UNCHANGED and
 * still returns the same fixed `RUNTIME_CRYPTO_CAPABILITIES` labels, so
 * every existing `RuntimeCryptoProvider` caller sees no difference at
 * all) naming, for EACH capability label, whether it is
 * `"internal-only"` (the underlying `packages/fedos-core-rust` NIP-44
 * wire pipeline genuinely exists and is exercised by that crate's own
 * `cargo test` suite — see `docs/nip44_wire_crypto_completion.md` — but
 * `FedosRuntimeCryptoProvider` itself does not call it) or
 * `"not-implemented"` (nothing backs the label at all yet, internal or
 * otherwise). This is a DISPLAY-ONLY distinction: from the
 * `RuntimeCryptoProvider` interface's own point of view, EVERY capability
 * is still `"Unsupported"`/`"NotConnected"` — `internalCapabilitySurface()`
 * carries no operational meaning, changes no `encrypt`/`decrypt`
 * behavior, and exposes no secret, key, or ciphertext material (only
 * fixed string labels).
 *
 * Stage 307 adds `FedosProviderDecisionReason` and `decisionReason()` —
 * an ADDITIONAL, purely-additive vocabulary for WHY
 * `encrypt()`/`decrypt()` currently deny every request, one step more
 * specific than the `RuntimeCryptoDecision.reason` free-form string
 * already returned (which is UNCHANGED). `decisionReason()` always
 * returns `"NotImplemented"` in this stage, mirroring
 * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` being `false` — the OTHER three
 * reasons (`"DisabledByActivationPolicy"`, `"RuntimeConnectionMissing"`,
 * `"Unsupported"`) are reserved for when a real implementation exists
 * and a future stage's activation policy or Runtime/Worker connection
 * (still absent) becomes the actual blocker instead. Existing callers of
 * `encrypt()`/`decrypt()` see NO change: their return type and values
 * are identical to before this stage.
 *
 * Stage 315 adds `#planInternalExecution` — a PRIVATE method modeling
 * the internal execution chain's first three links: it calls
 * `planFedosRuntimeOperation`/`evaluateFedosRuntimeOperation`
 * (`fedos_runtime_operation.ts`, Stage 313), then
 * `buildOpaqueRequestFromOperation` (`fedos_runtime_opaque_request.ts`,
 * Stage 314) to build the (empty) opaque request shape — and then
 * TERMINATES. The built request is never passed to anything: no
 * `packages/fedos-core-rust` call, no WASM, no FFI, no Runtime/Worker
 * call. Exposed publicly (Stage 316) as `planExecution()`, returning a
 * `FedosRuntimeExecutionDecision`.
 *
 * Stage 316 adds `FedosRuntimeExecutionState`/`FedosRuntimeExecutionDecision`/
 * `planExecution()`. `"BlockedByImplementation"` is the ONLY value this
 * stage ever produces (mirroring `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`
 * being `false`) — `"BlockedByActivation"` (RESERVED — the Provider
 * itself does not read `RuntimeCryptoConfig`/`WorkerCryptoConfig`; that
 * remains the activation policy's own, separate concern) and
 * `"ReadyForOpaqueExecution"` (RESERVED) are unreachable in this stage.
 *
 * Stage 317 adds three standalone, pure "state" functions —
 * `fedosProviderImplementationState()`, `fedosProviderExecutionState()`,
 * `fedosProviderOperationState()` — usable by diagnostics WITHOUT
 * constructing a `FedosRuntimeCryptoProvider` instance, since every
 * value they return is already fully determined by
 * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` alone. `decisionReason()`/
 * `planExecution()` now call the first two of these internally, so
 * there is exactly ONE computation for each state, not two.
 *
 * Stage 322 extends `#planInternalExecution` with a FOURTH link:
 * `createFedosOpaqueApi()` (`fedos_opaque_api.ts`, Stage 321)
 * builds a `FedosOpaqueApi`, and `planFedosOpaqueApiExecution` routes
 * the built opaque request to its `planEncrypt`/`planDecrypt` (Stage
 * 323) — which ALWAYS resolves `"BlockedByImplementation"` and is
 * itself discarded here. The Opaque API never invokes
 * `packages/fedos-core-rust`/WASM/FFI; execution still terminates
 * before it.
 *
 * Stage 324 adds `FedosProviderImplementationStage`/
 * `fedosProviderImplementationStage()` — a coarser milestone label
 * tracking how far the INTERNAL ARCHITECTURE (not any single
 * operation) has progressed.
 *
 * Stage 332 EXTENDS that milestone from four steps to five:
 * `"Unavailable"` → `"ProviderReady"` → `"OpaqueApiReady"` →
 * `"RustBoundaryReady"` → `"RustReady"`. Fixed at
 * `"RustBoundaryReady"` in this stage — the Rust Boundary abstraction
 * (`fedos_rust_boundary.ts`, Stage 329) now exists and is wired into
 * the Opaque API (Stage 330), but no REAL Rust connection exists yet.
 * `"RustReady"` remains RESERVED and unreachable.
 */

import type {
  RuntimeCryptoCapability,
  RuntimeCryptoDecision,
  RuntimeCryptoProvider,
  RuntimeCryptoStatus,
  RuntimeDecryptRequest,
  RuntimeEncryptRequest,
} from "./crypto_provider.js";
import { RUNTIME_CRYPTO_CAPABILITIES } from "./crypto_provider.js";
import { createFedosOpaqueApi, planFedosOpaqueApiExecution } from "./fedos_opaque_api.js";
import type { FedosOpaqueRequest } from "./fedos_runtime_opaque_request.js";
import { buildOpaqueRequestFromOperation } from "./fedos_runtime_opaque_request.js";
import type {
  FedosRuntimeOperation,
  FedosRuntimeOperationKind,
  FedosRuntimeOperationStatus,
} from "./fedos_runtime_operation.js";
import { evaluateFedosRuntimeOperation, planFedosRuntimeOperation } from "./fedos_runtime_operation.js";

/**
 * Fixed, permanently-`false` constant: whether `FedosRuntimeCryptoProvider`
 * has a real internal `encrypt`/`decrypt` implementation. Reads NO
 * `process.env`, accepts NO parameter or override anywhere in this
 * module or any importer — flipping it is a future, separate,
 * explicitly-reviewed stage's own decision, made only by editing this
 * literal.
 */
export const FEDOS_RUNTIME_PROVIDER_IMPLEMENTED = false;

/**
 * `FedosRuntimeCryptoProvider.status()`'s own return shape — a strict
 * superset of `RuntimeCryptoStatus` (assignable to it, so the class still
 * satisfies `RuntimeCryptoProvider.status(): RuntimeCryptoStatus`
 * exactly) that additionally surfaces `implemented`, mirroring
 * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` exactly. No secret, key, or
 * ciphertext material — a single boolean.
 */
export interface FedosRuntimeCryptoProviderStatus extends RuntimeCryptoStatus {
  readonly implemented: boolean;
}

/**
 * Whether a `RuntimeCryptoCapability` label is backed by ANYTHING at
 * all, internally. `"internal-only"` means the underlying
 * `packages/fedos-core-rust` pipeline exists and is verified by that
 * crate's own tests, but `FedosRuntimeCryptoProvider` does not call it —
 * `"not-implemented"` means nothing backs the label yet, anywhere.
 * Neither value implies `RuntimeCryptoProvider.encrypt()`/`decrypt()`
 * behaves any differently — both remain `"Unsupported"` regardless.
 */
export type FedosInternalCapabilityAvailability = "internal-only" | "not-implemented";

/** A single capability's internal-availability label — see `FedosInternalCapabilityAvailability`'s own doc comment. */
export interface FedosInternalCapabilityDescriptor {
  readonly capability: RuntimeCryptoCapability;
  readonly availability: FedosInternalCapabilityAvailability;
}

/**
 * The fixed, hand-maintained internal-capability surface —
 * `runtime_nip44_wire_placeholder` is `"internal-only"` (the NIP-44 wire
 * crypto pipeline in `packages/fedos-core-rust` is real and tested), the
 * other three labels remain `"not-implemented"`. Never computed from a
 * live probe; never implies `RuntimeCryptoProvider`-facing behavior
 * changes.
 */
export const FEDOS_INTERNAL_CAPABILITY_SURFACE: readonly FedosInternalCapabilityDescriptor[] = [
  { capability: "runtime_encrypt_placeholder", availability: "not-implemented" },
  { capability: "runtime_decrypt_placeholder", availability: "not-implemented" },
  { capability: "runtime_nip44_wire_placeholder", availability: "internal-only" },
  { capability: "runtime_rust_core_placeholder", availability: "not-implemented" },
];

/**
 * WHY `FedosRuntimeCryptoProvider.encrypt()`/`decrypt()` currently deny
 * every request — one step more specific than the `RuntimeCryptoDecision.reason`
 * free-form string already returned. `"NotImplemented"` is the ONLY
 * value `decisionReason()` produces in this stage (mirroring
 * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` being `false`); the other three
 * are reserved for future stages.
 */
export type FedosProviderDecisionReason =
  | "NotImplemented" // no real encrypt/decrypt implementation exists internally yet (this stage's actual reason)
  | "DisabledByActivationPolicy" // RESERVED — the activation policy's gate is closed
  | "RuntimeConnectionMissing" // RESERVED — Runtime/Worker does not call this provider automatically
  | "Unsupported"; // RESERVED — mirrors the RuntimeCryptoProvider-facing state

/** Every `FedosProviderDecisionReason`, for validation/documentation helpers. */
export const FEDOS_PROVIDER_DECISION_REASONS: readonly FedosProviderDecisionReason[] = [
  "NotImplemented",
  "DisabledByActivationPolicy",
  "RuntimeConnectionMissing",
  "Unsupported",
];

/**
 * The outcome of `FedosRuntimeCryptoProvider.planExecution()`.
 * `"BlockedByImplementation"` is the ONLY value this stage's
 * implementation ever produces (mirroring `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`
 * being `false`). `"BlockedByActivation"` and `"ReadyForOpaqueExecution"`
 * are RESERVED — the Provider itself never reads
 * `RuntimeCryptoConfig`/`WorkerCryptoConfig` (that stays the activation
 * policy's own, separate concern), and no real implementation exists to
 * ever reach `"ReadyForOpaqueExecution"`.
 */
export type FedosRuntimeExecutionState =
  | "BlockedByActivation" // RESERVED — never produced in this stage
  | "BlockedByImplementation" // the only state this stage's implementation ever produces
  | "ReadyForOpaqueExecution"; // RESERVED — never produced in this stage

/** Every `FedosRuntimeExecutionState`, for validation/documentation helpers. */
export const FEDOS_RUNTIME_EXECUTION_STATES: readonly FedosRuntimeExecutionState[] = [
  "BlockedByActivation",
  "BlockedByImplementation",
  "ReadyForOpaqueExecution",
];

/** The result of `FedosRuntimeCryptoProvider.planExecution()`. `reason` is non-sensitive and human-readable. */
export interface FedosRuntimeExecutionDecision {
  readonly operation: FedosRuntimeOperationKind;
  readonly state: FedosRuntimeExecutionState;
  readonly reason: string;
}

/**
 * Pure, standalone: WHY `encrypt()`/`decrypt()` currently deny every
 * request — usable WITHOUT constructing a `FedosRuntimeCryptoProvider`
 * instance, since the answer depends only on
 * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`. `decisionReason()` calls this
 * directly.
 */
export function fedosProviderImplementationState(): FedosProviderDecisionReason {
  return FEDOS_RUNTIME_PROVIDER_IMPLEMENTED ? "Unsupported" : "NotImplemented";
}

/**
 * Pure, standalone: what `planExecution()` would resolve to, for any
 * operation kind — usable WITHOUT constructing an instance. Always
 * `"BlockedByImplementation"` in this stage.
 */
export function fedosProviderExecutionState(): FedosRuntimeExecutionState {
  return FEDOS_RUNTIME_PROVIDER_IMPLEMENTED ? "ReadyForOpaqueExecution" : "BlockedByImplementation";
}

/**
 * Pure, standalone: the `FedosRuntimeOperationStatus`
 * (`fedos_runtime_operation.ts`, Stage 313) a planned operation would
 * resolve to — usable WITHOUT constructing an instance or a real
 * `FedosRuntimeOperation`. Always `"Blocked"` in this stage.
 */
export function fedosProviderOperationState(): FedosRuntimeOperationStatus {
  return FEDOS_RUNTIME_PROVIDER_IMPLEMENTED ? "Completed" : "Blocked";
}

/**
 * A coarse, five-step milestone tracking how far the INTERNAL
 * ARCHITECTURE around `FedosRuntimeCryptoProvider` has progressed —
 * distinct from `FedosRuntimeExecutionState`/`FedosRuntimeOperationStatus`
 * (which describe a single PLANNED operation's fate, not the
 * architecture's own build-out):
 *   - `"Unavailable"` — no operation/opaque-request model exists.
 *   - `"ProviderReady"` — the Provider/Operation/Opaque-Request models
 *     exist (Stage 313–320).
 *   - `"OpaqueApiReady"` — the Opaque API abstraction exists and is
 *     wired (Stage 321–328).
 *   - `"RustBoundaryReady"` — the Rust Boundary abstraction exists and
 *     is wired into the Opaque API (Stage 329–336) — THIS STAGE'S
 *     ACTUAL VALUE.
 *   - `"RustReady"` — RESERVED for a future, separate,
 *     explicitly-reviewed stage that connects the Rust Boundary to
 *     REAL `packages/fedos-core-rust` execution. Unreachable in this
 *     stage.
 */
export type FedosProviderImplementationStage =
  | "Unavailable"
  | "ProviderReady"
  | "OpaqueApiReady"
  | "RustBoundaryReady"
  | "RustReady"; // RESERVED — never produced in this stage

/** Every `FedosProviderImplementationStage`, in order, for validation/documentation helpers. */
export const FEDOS_PROVIDER_IMPLEMENTATION_STAGES: readonly FedosProviderImplementationStage[] = [
  "Unavailable",
  "ProviderReady",
  "OpaqueApiReady",
  "RustBoundaryReady",
  "RustReady",
];

/**
 * Pure, standalone: the current `FedosProviderImplementationStage`.
 * Fixed, hand-maintained — never computed from a live probe. Currently
 * `"RustBoundaryReady"`.
 */
export function fedosProviderImplementationStage(): FedosProviderImplementationStage {
  return "RustBoundaryReady";
}

/**
 * The FedOS-named `RuntimeCryptoProvider`. Advertises the same fixed
 * placeholder capability labels as `PlaceholderRuntimeCryptoProvider`
 * (labels of intent only), but `encrypt()`/`decrypt()` ALWAYS deny with
 * `"Unsupported"` — no real core is connected, and this stage never
 * connects one.
 */
export class FedosRuntimeCryptoProvider implements RuntimeCryptoProvider {
  constructor() {
    // Does nothing: no core loaded, no handle resolved, no byte touched.
  }

  status(): FedosRuntimeCryptoProviderStatus {
    return {
      state: "NotConnected",
      reason: "FedOS runtime crypto provider is not connected to any real core",
      implemented: FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
    };
  }

  capabilities(): readonly RuntimeCryptoCapability[] {
    return RUNTIME_CRYPTO_CAPABILITIES;
  }

  /**
   * The internal-availability label for each capability — see
   * `FEDOS_INTERNAL_CAPABILITY_SURFACE`'s own doc comment. Purely
   * additional to `capabilities()`, which is unaffected.
   */
  internalCapabilitySurface(): readonly FedosInternalCapabilityDescriptor[] {
    return FEDOS_INTERNAL_CAPABILITY_SURFACE;
  }

  /**
   * WHY `encrypt()`/`decrypt()` currently deny every request. Always
   * `"NotImplemented"` in this stage, mirroring
   * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`. Purely additional to
   * `encrypt()`/`decrypt()`'s own `RuntimeCryptoDecision.reason` string,
   * which is unaffected.
   */
  decisionReason(): FedosProviderDecisionReason {
    return fedosProviderImplementationState();
  }

  /**
   * Plan (but never execute) the internal chain for `kind`: Operation
   * (Stage 313) → Opaque Request (Stage 314) → terminate (Stage 315).
   * ALWAYS resolves `"BlockedByImplementation"` in this stage — see this
   * module's own Stage 316 doc comment above. Never calls
   * `encrypt()`/`decrypt()`, never calls any
   * `packages/fedos-core-rust`/WASM/FFI/Runtime/Worker function.
   */
  planExecution(kind: FedosRuntimeOperationKind): FedosRuntimeExecutionDecision {
    const { state } = this.#planInternalExecution(kind);
    return {
      operation: kind,
      state,
      reason: `FedOS runtime ${kind} execution is blocked before reaching FedOS: no internal implementation exists yet`,
    };
  }

  /**
   * PRIVATE — the actual internal chain. Builds a `FedosRuntimeOperation`
   * (Stage 313), evaluates it (always `"Blocked"`), builds the
   * corresponding opaque request shape (Stage 314), routes it to a
   * `FedosOpaqueApi`'s `planEncrypt`/`planDecrypt` (Stage 321–323) — and
   * then TERMINATES. The Opaque API's own decision is discarded; it is
   * never passed to `encrypt()`/`decrypt()`, never passed to any
   * `packages/fedos-core-rust`/WASM/FFI call, never passed to Runtime or
   * Worker. The Opaque API itself never invokes Rust either — it simply
   * receives the request.
   */
  #planInternalExecution(kind: FedosRuntimeOperationKind): { state: FedosRuntimeExecutionState } {
    const operation: FedosRuntimeOperation = planFedosRuntimeOperation(kind);
    evaluateFedosRuntimeOperation(operation); // always "Blocked"; result not otherwise used
    const opaqueRequest: FedosOpaqueRequest = buildOpaqueRequestFromOperation(operation);
    const opaqueApi = createFedosOpaqueApi();
    planFedosOpaqueApiExecution(opaqueApi, opaqueRequest); // always "BlockedByImplementation"; result not otherwise used — execution terminates HERE
    return { state: fedosProviderExecutionState() };
  }

  async encrypt(_request: RuntimeEncryptRequest): Promise<RuntimeCryptoDecision> {
    return this.#unsupported("encryption");
  }

  async decrypt(_request: RuntimeDecryptRequest): Promise<RuntimeCryptoDecision> {
    return this.#unsupported("decryption");
  }

  #unsupported(operation: string): RuntimeCryptoDecision {
    return {
      allowed: false,
      state: "Unsupported",
      reason: `FedOS runtime crypto provider does not perform ${operation} in this stage`,
    };
  }
}
