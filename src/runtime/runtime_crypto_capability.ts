/**
 * Stage 250 — Runtime Capability Mapping (a table only, no connection).
 *
 * A PURE, static lookup from `RuntimeCryptoCapability`
 * (`src/runtime/crypto_provider.ts`, Stage 249) to the existing
 * `CryptoCapability` label (`src/crypto/types.ts`, Stage 34) it corresponds to.
 * This file calls nothing, constructs nothing, and connects nothing — it is a
 * `Record` literal and two pure functions over it.
 *
 * HARD GUARDRAILS:
 *   - NO `RuntimeCryptoProvider`/`CryptoProvider` method is called here.
 *   - NO `packages/fedos-core-rust` reference (Rust crate or TS package
 *     boundary) — only a type-only import of `CryptoCapability`'s label type.
 *   - This table does not imply either capability is actually available —
 *     both sides remain placeholder-only labels of intent.
 */

import type { RuntimeCryptoCapability } from "./crypto_provider.js";
import type { CryptoCapability } from "../os/core/crypto/types.js";
import { RUNTIME_CRYPTO_CAPABILITIES } from "./crypto_provider.js";

/**
 * Runtime Capability → FedOS Capability. Fixed, hand-maintained — never
 * computed from a live probe. Every `RuntimeCryptoCapability` maps to exactly
 * one `CryptoCapability`; the reverse is not necessarily true (a `CryptoCapability`
 * may have zero or more corresponding `RuntimeCryptoCapability` entries).
 */
export const RUNTIME_TO_FEDOS_CRYPTO_CAPABILITY: Readonly<
  Record<RuntimeCryptoCapability, CryptoCapability>
> = {
  runtime_encrypt_placeholder: "aead_placeholder",
  runtime_decrypt_placeholder: "aead_placeholder",
  runtime_nip44_wire_placeholder: "nip44_placeholder",
  runtime_rust_core_placeholder: "rust_core_placeholder",
};

/**
 * Look up the `CryptoCapability` a given `RuntimeCryptoCapability` maps to.
 * Pure — reads only the fixed table above.
 */
export function mapRuntimeCryptoCapabilityToFedosCapability(
  capability: RuntimeCryptoCapability,
): CryptoCapability {
  return RUNTIME_TO_FEDOS_CRYPTO_CAPABILITY[capability];
}

/**
 * The full mapped table, as `[runtime, fedos]` pairs, in
 * `RUNTIME_CRYPTO_CAPABILITIES`'s own fixed order — for
 * diagnostics/documentation display only.
 */
export function runtimeCryptoCapabilityMappingPreview(): ReadonlyArray<{
  readonly runtime: RuntimeCryptoCapability;
  readonly fedos: CryptoCapability;
}> {
  return RUNTIME_CRYPTO_CAPABILITIES.map((runtime) => ({
    runtime,
    fedos: RUNTIME_TO_FEDOS_CRYPTO_CAPABILITY[runtime],
  }));
}
