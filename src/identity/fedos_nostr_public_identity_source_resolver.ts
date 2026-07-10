/**
 * Secure Runtime Alpha 048 — "FedOS Nostr Public Identity Source
 * Resolver".
 *
 * Alpha 039 defined `FedosNostrPublicIdentitySource` (the read-only
 * Boundary contract) and shipped its only implementation,
 * `NullNostrPublicIdentitySource`. Since then, every caller that needed
 * a Source has constructed `NullNostrPublicIdentitySource` directly —
 * `fedos_identity_provider_resolver.ts` (Alpha 039) builds one inline
 * when it constructs the shared `NostrIdentityProvider` singleton. THIS
 * Stage introduces a dedicated, single-purpose Resolver for the Source
 * itself — `resolveNostrPublicIdentitySource()` — mirroring the shape
 * `resolveFedosIdentityProvider()` (Alpha 032/034/036/039) already
 * established for Provider selection, one layer lower. See
 * `docs/secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver.md`
 * for the full design rationale: why a dedicated Resolver is introduced
 * now, why it is fixed to `NullNostrPublicIdentitySource` today, how it
 * differs from `NoopFedosIdentityProvider` (Alpha 033) and from
 * `resolveFedosIdentityProvider()` (Alpha 032) themselves, and why
 * switching to a Filesystem/SQLite/Nostr-profile-cache/Remote Source
 * implementation in the future will never require modifying
 * `NostrIdentityProvider` (Alpha 035/039/046) itself.
 *
 * This file defines a SINGLE FUNCTION and one PRIVATE module-scoped
 * singleton — no `if`, no `switch`, no environment read, no Runtime
 * Mode Authority reference, no Platform Authority reference, no Storage
 * Resolver reference, and no wiring into `NostrIdentityProvider`,
 * `fedos_identity_provider_resolver.ts`, `FedosIdentityService`,
 * `FedosIdentityRegistry`, `FedosIdentityResolver`, or any other module
 * in this repository. Nothing in this repository imports this file yet
 * — it exists, is fully tested, and is not wired into anything else,
 * exactly as `FedosIdentityRecord` (Alpha 040) and
 * `FedosIdentityRegistry` (Alpha 041) each did on their own first day.
 *
 * HARD GUARDRAILS:
 *   - `resolveNostrPublicIdentitySource()` is the ONLY export.
 *   - The returned object is ALWAYS the same shared
 *     `NullNostrPublicIdentitySource` singleton — never `null`, never a
 *     fresh instance per call.
 *   - The return type is `FedosNostrPublicIdentitySource` — a real,
 *     non-nullable interface value, matching the Source Boundary's own
 *     contract exactly, unlike `resolveFedosIdentityProvider()`'s own
 *     nullable `FedosIdentityProvider | null` return type.
 *   - NO real public-identity retrieval logic of any kind — no
 *     filesystem read, no SQLite query, no Nostr Relay call, no network
 *     request. This Stage selects between zero real alternatives; it
 *     merely names the seam a future Stage will select through.
 *   - NO reference to `src/worker.ts`, `create_runtime.ts`,
 *     `fedos_nostr_identity_provider.ts`,
 *     `fedos_identity_provider_resolver.ts`, `fedos_identity_service.ts`,
 *     `fedos_identity_registry.ts`, or `fedos_identity_resolver.ts`.
 *   - NO Relay, event, signing, secret-key, or DM reference of any
 *     kind.
 */

import type { FedosNostrPublicIdentitySource } from "./fedos_nostr_public_identity_source.js";
import { NullNostrPublicIdentitySource } from "./fedos_null_nostr_public_identity_source.js";

/**
 * PRIVATE (module-scoped) — the ONE shared `NullNostrPublicIdentitySource`
 * instance, constructed once at module load and returned for every
 * call. `NullNostrPublicIdentitySource` holds no per-instance state at
 * all (Alpha 039), so a single shared instance is indistinguishable
 * from a fresh-per-call instance to any caller — sharing one avoids
 * allocating a new, permanently-identical object on every resolution.
 */
const sharedNullSource: FedosNostrPublicIdentitySource = new NullNostrPublicIdentitySource();

export function resolveNostrPublicIdentitySource(): FedosNostrPublicIdentitySource {
  return sharedNullSource;
}
