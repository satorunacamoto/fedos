/**
 * Stage 251 — Runtime Crypto Diagnostics (display only).
 *
 * A READ-ONLY inspection of a `RuntimeCryptoProvider`'s
 * (`src/runtime/crypto_provider.ts`, Stage 249) current status and advertised
 * capabilities — mirroring `docs/runtime_diagnostics.md`'s existing "read-only
 * inspection of already-constructed objects" discipline (§1). This file calls
 * ONLY `provider.status()`/`provider.capabilities()` (both pure reads per
 * `RuntimeCryptoProvider`'s own contract) — never `encrypt()`/`decrypt()`.
 *
 * HARD GUARDRAILS:
 *   - NO secret, key, plaintext, or ciphertext byte is ever read or displayed.
 *   - NO `encrypt()`/`decrypt()` call — this file never asks a provider to
 *     perform an operation, only to report its own state.
 *   - NO `packages/fedos-core-rust` reference (Rust crate or TS package
 *     boundary).
 */

import type {
  RuntimeCryptoCapability,
  RuntimeCryptoProvider,
  RuntimeCryptoState,
} from "./crypto_provider.js";

/**
 * A non-sensitive, display-only readiness label for a `RuntimeCryptoProvider`
 * — DELIBERATELY SEPARATE from `RuntimeCryptoState` (see
 * `crypto_provider.ts`'s own doc comment for why). `"Enabled"` names a future
 * state where a real FedOS core is actually connected — NOTHING in this file,
 * or anywhere in this stage's code, ever produces it; it exists purely so a
 * later, separate, explicitly-reviewed stage can report it without a new enum
 * variant needing review at that point.
 */
export type RuntimeCryptoDiagnosticsState =
  | "Enabled" // a real, connected FedOS core — NEVER produced in this stage
  | "Disabled" // the boundary explicitly denies the requested capability
  | "Placeholder" // a placeholder implementation is present
  | "NotConnected"; // no FedOS core is connected

/**
 * A non-sensitive snapshot of a `RuntimeCryptoProvider`, for display purposes
 * only. `capabilities` echoes the provider's own fixed label list; `reason` is
 * the provider's own non-sensitive explanation, unmodified.
 */
export interface RuntimeCryptoDiagnosticsReport {
  readonly state: RuntimeCryptoDiagnosticsState;
  readonly capabilities: readonly RuntimeCryptoCapability[];
  readonly reason: string;
}

/**
 * Map a `RuntimeCryptoProvider`'s own `RuntimeCryptoState` to this module's
 * display-only `RuntimeCryptoDiagnosticsState`. Fixed, hand-maintained —
 * `"Unsupported"` (the provider-facing label) displays as `"Disabled"` (the
 * diagnostics-facing label); `"Placeholder"`/`"NotConnected"` pass through
 * unchanged. `"Enabled"` is never reachable from this function.
 */
function mapProviderStateToDiagnosticsState(
  state: RuntimeCryptoState,
): RuntimeCryptoDiagnosticsState {
  switch (state) {
    case "Placeholder":
      return "Placeholder";
    case "NotConnected":
      return "NotConnected";
    case "Unsupported":
      return "Disabled";
  }
}

/**
 * Read-only snapshot of `provider`'s current status and capabilities. Calls
 * ONLY `provider.status()`/`provider.capabilities()` — never `encrypt()`/
 * `decrypt()`, and never mutates `provider` or any argument.
 */
export function runtimeCryptoDiagnosticsPreview(
  provider: RuntimeCryptoProvider,
): RuntimeCryptoDiagnosticsReport {
  const status = provider.status();
  return {
    state: mapProviderStateToDiagnosticsState(status.state),
    capabilities: provider.capabilities(),
    reason: status.reason,
  };
}
