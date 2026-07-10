/**
 * Secure Runtime Alpha 032 — "FedOS Identity Provider Resolver". Secure
 * Runtime Alpha 034 — "No-op Resolver Wiring". Secure Runtime Alpha 036
 * — "Nostr Resolver Wiring" (this revision).
 *
 * Alpha 032 left `resolveFedosIdentityProvider()` hardcoded to `null`.
 * Alpha 034 wired it to a shared `NoopFedosIdentityProvider` (Alpha
 * 033) singleton. Alpha 035 then built `NostrIdentityProvider`
 * (`fedos_nostr_identity_provider.ts`) — a second, Nostr-labeled
 * `FedosIdentityProvider` implementation, WITHOUT wiring it in. THIS
 * Stage is that wiring, and nothing else: this function now returns a
 * shared `NostrIdentityProvider` singleton instead of the shared
 * `NoopFedosIdentityProvider` singleton. See
 * `docs/secure_runtime_alpha_036_fedos_nostr_resolver_wiring.md` for
 * the full design rationale — why this Resolver switched from Noop to
 * Nostr, why `describeIdentity()` still always resolves `null`, why
 * this stays disconnected from Runtime, the future position this
 * wiring leads toward, and why `NoopFedosIdentityProvider` is not
 * deleted.
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
 *     real, unchanged, unimported-here implementation — see the design
 *     doc's own "why Noop is not deleted" section).
 *   - NO reference to `src/worker.ts`, `create_runtime.ts`, or
 *     `fedos_identity_service.ts` — Runtime and Service remain fully
 *     unconnected to this Resolver.
 *   - NO Relay, event, signing, secret-key, or DM reference of any
 *     kind — this Stage only changes WHICH already-existing, already
 *     `null`-returning Provider this function returns.
 */

import type { FedosIdentityProvider } from "./fedos_identity_provider.js";
import { NostrIdentityProvider } from "./fedos_nostr_identity_provider.js";

/**
 * PRIVATE (module-scoped) — the ONE shared `NostrIdentityProvider`
 * instance, constructed once at module load and returned for every
 * call. `NostrIdentityProvider` holds no per-instance state (Alpha
 * 035), so a single shared instance is indistinguishable from a
 * fresh-per-call instance to any caller — sharing one avoids allocating
 * a new, permanently-identical object on every resolution.
 */
const sharedNostrProvider: FedosIdentityProvider = new NostrIdentityProvider();

export function resolveFedosIdentityProvider(): FedosIdentityProvider | null {
  return sharedNostrProvider;
}
