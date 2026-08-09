/**
 * Architecture Dependency Closure arc — `PlaceholderFedosCoreCrypto` and its
 * factory, extracted verbatim out of `./index.ts` into their own leaf file.
 *
 * Before this extraction, `index.ts` (the package's public entry point)
 * defined this class directly and separately re-exported everything from
 * `./wasm_loader.ts`; `wasm_loader.ts` in turn imported this class BACK from
 * `./index.ts` (to hand it back as the inert "loaded" core) — a genuine,
 * if harmless, two-file runtime import cycle (confirmed via
 * `scripts/architecture_cycle_detector.mjs`: the only real RUNTIME-graph SCC
 * found anywhere under `src/` + `packages/<name>/src/` at the time of that
 * measurement). Moving the class to this dependency-free leaf file breaks
 * the cycle with zero behavior change: `index.ts` now re-exports it from
 * here (its own public import surface, `@nostr-window/fedos-core-rust`, is
 * unchanged — both names are still exported from `index.ts`), and
 * `wasm_loader.ts` now imports it from here instead of from `index.ts`.
 *
 * No logic changed. See `docs/architecture/CIRCULAR-DEPENDENCY-BREAK-PLAN.md`
 * and this arc's own fresh cycle re-measurement for the full analysis.
 */

import type {
  FedosCoreCapability,
  FedosCoreCrypto,
  FedosCoreDecision,
  FedosCoreDecryptRequest,
  FedosCoreDeriveKeyRequest,
  FedosCoreEncryptRequest,
  FedosCoreRandomBytesRequest,
  FedosCoreStatus,
} from "./types.js";

/**
 * The placeholder FedOS core: permanently `unavailable`. It advertises the
 * placeholder capabilities as labels of FUTURE intent, but every operation is
 * denied — nothing runs, nothing is generated, nothing is stored. This is the
 * drop-in stand-in until a real Rust/WASM core implements `FedosCoreCrypto`.
 */
export class PlaceholderFedosCoreCrypto implements FedosCoreCrypto {
  constructor() {
    // Does nothing: no Rust/WASM loaded, no key/seed created, no RNG seeded.
  }

  getStatus(): FedosCoreStatus {
    return {
      state: "unavailable",
      reason: "no FedOS Rust/WASM crypto core is present (placeholder only)",
    };
  }

  getCapabilities(): readonly FedosCoreCapability[] {
    // Labels of future intent only — none is implemented or safe in this stage.
    return [
      "rust_core_placeholder",
      "aead_placeholder",
      "kdf_placeholder",
      "random_placeholder",
      "nip44_placeholder",
    ];
  }

  async randomBytes(
    _request: FedosCoreRandomBytesRequest,
  ): Promise<FedosCoreDecision> {
    return this.#deny("random-bytes generation");
  }

  async deriveKey(
    _request: FedosCoreDeriveKeyRequest,
  ): Promise<FedosCoreDecision> {
    return this.#deny("key derivation");
  }

  async encrypt(_request: FedosCoreEncryptRequest): Promise<FedosCoreDecision> {
    return this.#deny("encryption");
  }

  async decrypt(_request: FedosCoreDecryptRequest): Promise<FedosCoreDecision> {
    return this.#deny("decryption");
  }

  /**
   * Build a denied/unavailable decision. Reads nothing from the request,
   * derives nothing, and stores nothing. The `operation` label is a fixed,
   * non-sensitive string — never request handles or secret material.
   */
  #deny(operation: string): FedosCoreDecision {
    return {
      allowed: false,
      state: "unavailable",
      reason: `no FedOS crypto core is present (${operation} not performed)`,
    };
  }
}

/** Creates a fresh placeholder core. Constructing it does nothing. */
export function createFedosCoreCrypto(): PlaceholderFedosCoreCrypto {
  return new PlaceholderFedosCoreCrypto();
}
