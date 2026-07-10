/**
 * Secure Runtime Alpha 032 — "FedOS Identity Provider Resolver".
 *
 * The ONE seam a future Stage would change to select WHICH
 * `FedosIdentityProvider` (Alpha 029) a caller receives — currently,
 * and for this Stage only, hardcoded to always return `null`. See
 * `docs/secure_runtime_alpha_032_fedos_identity_provider_resolver.md`
 * for the full design rationale, the comparison against
 * `resolveRuntimeStorageBackend()` (Alpha 021/024), and why `null` —
 * not a placeholder object — is the only honest answer today.
 *
 * This file defines a SINGLE FUNCTION and nothing else — no `if`, no
 * `switch`, no environment read, no Runtime Mode Authority reference,
 * no Platform Authority reference, no Storage Resolver reference, and
 * no wiring into `FedosIdentityService` (Alpha 031) or any other
 * module in this repository. Unlike `resolveRuntimeStorageBackend()`,
 * which has always had a real `MemoryStorageBackend` to hand back,
 * ZERO `FedosIdentityProvider` implementations exist anywhere in this
 * repository as of this Stage — so `null` is not a placeholder
 * fallback, it is the only truthful value this function could ever
 * return today.
 */

import type { FedosIdentityProvider } from "./fedos_identity_provider.js";

export function resolveFedosIdentityProvider(): FedosIdentityProvider | null {
  return null;
}
