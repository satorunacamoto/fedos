/**
 * Secure Runtime Alpha 032 — "FedOS Identity Provider Resolver". Secure
 * Runtime Alpha 034 — "No-op Resolver Wiring". Secure Runtime Alpha 036
 * — "Nostr Resolver Wiring". Secure Runtime Alpha 039 — "Nostr Public
 * Identity Source Boundary" (this revision — construction only).
 *
 * Alpha 032 left `resolveFedosIdentityProvider()` hardcoded to `null`.
 * Alpha 034 wired it to a shared `NoopFedosIdentityProvider` (Alpha
 * 033) singleton. Alpha 036 re-wired it to a shared
 * `NostrIdentityProvider` (Alpha 035) singleton instead. Alpha 039 then
 * gave `NostrIdentityProvider` a required constructor parameter — an
 * injected `FedosNostrPublicIdentitySource` — which this Resolver must
 * now supply to keep constructing the shared singleton at all. THIS
 * Stage's own change is exactly that: the shared singleton is now
 * constructed with `new NullNostrPublicIdentitySource()` injected. See
 * `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
 * for the full design rationale — why the default Source is a Null
 * Source, why this remains a pure construction-argument change and not
 * a new selection condition, and why `describeIdentity()`'s own
 * observable behavior (always `null`, by delegating to a Source that
 * always resolves `null`) is unchanged from Alpha 036 despite this
 * internal wiring change.
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
 *     `NostrIdentityProvider` singleton — never `null`, never a fresh
 *     instance per call, never `NoopFedosIdentityProvider` (still a
 *     real, unchanged, unimported-here implementation).
 *   - The shared singleton is ALWAYS constructed with a
 *     `NullNostrPublicIdentitySource` — no other Source implementation
 *     exists in this repository, and none is selected between (still a
 *     single, unconditional construction, not a selection).
 *   - NO reference to `src/worker.ts`, `create_runtime.ts`, or
 *     `fedos_identity_service.ts` — Runtime and Service remain fully
 *     unconnected to this Resolver.
 *   - NO Relay, event, signing, secret-key, or DM reference of any
 *     kind.
 */

import type { FedosIdentityProvider } from "./fedos_identity_provider.js";
import { NostrIdentityProvider } from "./fedos_nostr_identity_provider.js";
import { NullNostrPublicIdentitySource } from "./fedos_null_nostr_public_identity_source.js";

/**
 * PRIVATE (module-scoped) — the ONE shared `NostrIdentityProvider`
 * instance, constructed once at module load with a
 * `NullNostrPublicIdentitySource` injected, and returned for every
 * call. `NostrIdentityProvider` holds no OTHER per-instance state
 * beyond the Source it was given (Alpha 039), so a single shared
 * instance is indistinguishable from a fresh-per-call instance
 * constructed the same way to any caller — sharing one avoids
 * allocating a new, permanently-identical object on every resolution.
 */
const sharedNostrProvider: FedosIdentityProvider = new NostrIdentityProvider(new NullNostrPublicIdentitySource());

export function resolveFedosIdentityProvider(): FedosIdentityProvider | null {
  return sharedNostrProvider;
}
