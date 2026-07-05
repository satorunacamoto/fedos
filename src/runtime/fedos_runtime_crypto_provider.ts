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
    return FEDOS_RUNTIME_PROVIDER_IMPLEMENTED ? "Unsupported" : "NotImplemented";
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
