/**
 * Secure Runtime Alpha 032 — "FedOS Identity Provider Resolver". Secure
 * Runtime Alpha 034 — "No-op Resolver Wiring" (this revision).
 *
 * Alpha 032 left `resolveFedosIdentityProvider()` hardcoded to `null`,
 * because ZERO `FedosIdentityProvider` implementations existed anywhere
 * in this repository. Alpha 033 (`fedos_noop_identity_provider.ts`)
 * built the first one, `NoopFedosIdentityProvider`, WITHOUT wiring it
 * in. THIS Stage is that wiring, and nothing else: this function now
 * returns a shared `NoopFedosIdentityProvider` singleton instead of
 * `null`. See
 * `docs/secure_runtime_alpha_034_fedos_noop_resolver_wiring.md` for the
 * full design rationale — why `null` became No-op now, why a No-op
 * Provider is NOT a stand-in for a real Provider, why this wiring stops
 * at the Resolver and does not reach `FedosIdentityService` (Alpha
 * 031), Runtime, or the Worker, the comparison against
 * `NostrIdentityProvider`'s future position, and the comparison against
 * `resolveRuntimeStorageBackend()` (Alpha 021/024).
 *
 * This file defines a SINGLE FUNCTION and one PRIVATE module-scoped
 * singleton — no `if`, no `switch`, no environment read, no Runtime
 * Mode Authority reference, no Platform Authority reference, no Storage
 * Resolver reference, and no wiring into `FedosIdentityService` (Alpha
 * 031) or any other module in this repository.
 *
 * HARD GUARDRAILS:
 *   - `resolveFedosIdentityProvider()` is the ONLY export.
 *   - The returned object is ALWAYS the same shared
 *     `NoopFedosIdentityProvider` singleton — never `null`, never a
 *     fresh instance per call, never any other `FedosIdentityProvider`
 *     implementation.
 *   - NO reference to `src/worker.ts`, `create_runtime.ts`, or
 *     `fedos_identity_service.ts` — Runtime and Service remain fully
 *     unconnected to this Resolver.
 *   - NO Nostr, ActivityPub, Bluesky, Session, or Authentication
 *     reference of any kind.
 */

import type { FedosIdentityProvider } from "./fedos_identity_provider.js";
import { NoopFedosIdentityProvider } from "./fedos_noop_identity_provider.js";

/**
 * PRIVATE (module-scoped) — the ONE shared `NoopFedosIdentityProvider`
 * instance, constructed once at module load and returned for every
 * call. `NoopFedosIdentityProvider` holds no per-instance state (Alpha
 * 033), so a single shared instance is indistinguishable from a
 * fresh-per-call instance to any caller — sharing one avoids allocating
 * a new, permanently-identical object on every resolution.
 */
const sharedNoopProvider: FedosIdentityProvider = new NoopFedosIdentityProvider();

export function resolveFedosIdentityProvider(): FedosIdentityProvider | null {
  return sharedNoopProvider;
}
