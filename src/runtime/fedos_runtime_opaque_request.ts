/**
 * Stage 314 — FedOS Runtime Opaque Request Model (definitions only).
 *
 * The SECOND link in `FedosRuntimeCryptoProvider`'s internal execution
 * chain (`src/runtime/fedos_runtime_operation.ts`, Stage 313 →
 * `fedos_runtime_crypto_provider.ts`, Stage 315) — the request SHAPE
 * that would eventually reach the FedOS crypto pipeline, if a future,
 * separate, explicitly-reviewed stage ever wired one up.
 *
 * HARD GUARDRAILS:
 *   - OPAQUE handles ONLY — `opaqueKeyRef`/`opaquePlaintextRef`/
 *     `opaqueCiphertextRef` are non-secret STRING labels, mirroring
 *     `src/runtime/crypto_provider.ts`'s existing `RuntimeEncryptRequest`/
 *     `RuntimeDecryptRequest` discipline — never a key/plaintext/
 *     ciphertext byte.
 *   - NO `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value (all `pub(crate)`-private inside
 *     `packages/fedos-core-rust`, never exposed to TypeScript) is
 *     imported, referenced, or constructed anywhere in this file.
 *   - NO plaintext or ciphertext byte is ever held, returned, or logged
 *     by any function here — `buildOpaqueRequestFromOperation` builds an
 *     EMPTY request (no refs attached) purely to model the SHAPE.
 *   - No `packages/fedos-core-rust` import, no WASM, no FFI, no network/
 *     storage/Relay/Nostr reference.
 *   - Pure; every function here is synchronous, never throws, never
 *     mutates its argument.
 */

import type { FedosRuntimeOperation } from "./fedos_runtime_operation.js";

/** The opaque request shape for an `"encrypt"` operation. Metadata/handles only. */
export interface OpaqueEncryptRequest {
  readonly operation: "encrypt";
  /** OPAQUE key handle — NOT key bytes. */
  readonly opaqueKeyRef?: string;
  /** OPAQUE handle to plaintext held elsewhere — NOT plaintext bytes. */
  readonly opaquePlaintextRef?: string;
}

/** The opaque request shape for a `"decrypt"` operation. Metadata/handles only. */
export interface OpaqueDecryptRequest {
  readonly operation: "decrypt";
  /** OPAQUE key handle — NOT key bytes. */
  readonly opaqueKeyRef?: string;
  /** OPAQUE handle to ciphertext held elsewhere — NOT ciphertext bytes. */
  readonly opaqueCiphertextRef?: string;
}

/** Either opaque request shape, matching `FedosRuntimeOperationKind`'s two values. */
export type FedosOpaqueRequest = OpaqueEncryptRequest | OpaqueDecryptRequest;

/**
 * Build the (empty — no refs attached) opaque request shape a
 * `FedosRuntimeOperation` would eventually carry. Pure; never throws;
 * never mutates `operation`; retains no plaintext/ciphertext (there is
 * none to retain — this stage never receives real request material).
 */
export function buildOpaqueRequestFromOperation(
  operation: FedosRuntimeOperation,
): FedosOpaqueRequest {
  if (operation.kind === "encrypt") {
    return { operation: "encrypt" };
  }
  return { operation: "decrypt" };
}
