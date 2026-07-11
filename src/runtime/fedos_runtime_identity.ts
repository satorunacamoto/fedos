/**
 * Secure Runtime Alpha 050–052 — "Identity Runtime Integration Arc"
 * (Alpha 050: Runtime Identity Authority). Secure Runtime Alpha
 * 053–055 — "Identity Runtime Internal Operations" (header comment
 * only; `describeIdentity()`/`findIdentity()`/`listIdentities()`
 * themselves BYTE-FOR-BYTE unchanged by that Arc).
 *
 * The FIRST connection anywhere in this repository between the
 * Identity Layer (`src/identity/*`, Alpha 027–049) and the Runtime
 * (`src/runtime/*`). `FedosRuntimeIdentity` is a thin, internal-only
 * assembly of the three Identity Layer objects a single Runtime
 * instance would need to hold together — `FedosIdentityRegistry`
 * (Alpha 041, the store), `FedosIdentityService` (Alpha 031/042/047,
 * the writer, backed by the shared `FedosIdentityProvider` singleton
 * `resolveFedosIdentityProvider()` (Alpha 032/034/036/039/049)
 * resolves), and `FedosIdentityResolver` (Alpha 043, the reader) — all
 * three wired to the SAME `FedosIdentityRegistry` instance, exactly as
 * `FedosIdentityResolver`'s own design has always required. Alpha 050
 * shipped `describeIdentity()`/`findIdentity()`/`listIdentities()`
 * alongside that construction, as pure pass-throughs, so that Alpha
 * 052's own verification tests would have something to call. Alpha
 * 053 and Alpha 054 formally re-confirm those same three methods as
 * their own, separately-reviewed deliverables — `describeIdentity()`
 * (Alpha 053) and `findIdentity()`/`listIdentities()` (Alpha 054) —
 * with ZERO functional change, since Alpha 050 already implemented
 * them to this exact same specification. See
 * `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
 * for the original Runtime/Identity Layer connection rationale, and
 * `docs/secure_runtime_alpha_053_055_identity_runtime_internal_operations.md`
 * for that Arc's own rationale: why Alpha 053/054 made no code change,
 * why the three methods stay pure pass-throughs, why `findIdentity()`/
 * `listIdentities()` stay synchronous, and Alpha 055's own (since
 * REMOVED — see below) `create_runtime.ts` startup-confirmation call.
 *
 * Secure Runtime Alpha 056 (review only, no code change) reviewed that
 * Alpha 055 call and adopted Option B — remove it — as this arc's own
 * Decision; Secure Runtime Alpha 057 implemented that Decision,
 * removing the call from `create_runtime.ts` entirely. See
 * `docs/secure_runtime_alpha_056_identity_bootstrap_semantics_review.md`
 * and `docs/secure_runtime_alpha_057_identity_bootstrap_removal.md`.
 *
 * Secure Runtime Alpha 058 ("Identity Bootstrap Boundary") adds
 * `bootstrapIdentity(): Promise<void>` — a FOURTH method, alongside
 * `describeIdentity()`/`findIdentity()`/`listIdentities()`, all three
 * of which stay BYTE-FOR-BYTE unchanged. `bootstrapIdentity()` is a
 * one-line delegation, `await this.#service.describeIdentity();`,
 * discarding the resolved Descriptor and returning nothing — Registry
 * registration on a non-`null` Descriptor remains entirely
 * `FedosIdentityService`'s own responsibility (Alpha 042), exactly as
 * `describeIdentity()` itself already relies on. Unlike Alpha 055's
 * removed call, `bootstrapIdentity()` does NOT swallow a rejection —
 * any exception `describeIdentity()` throws propagates to
 * `bootstrapIdentity()`'s own caller, letting that caller decide how
 * to react. `create_runtime.ts` does NOT call this method — Alpha 057
 * left `createRuntime()` Construct Only, and this Stage does not
 * change that; this method exists but remains, as of this Stage,
 * called by nothing anywhere in this repository. See
 * `docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md` for
 * the full design rationale.
 *
 * Secure Runtime Alpha 059 (review only, no code change) compared five
 * candidate Bootstrap Authorities and adopted Desktop Application
 * startup as the designated caller of `bootstrapIdentity()`, rejecting
 * Worker on a concrete structural flaw (per-request `createRuntime()`
 * construction). See
 * `docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md`.
 *
 * Secure Runtime Alpha 060 ("Identity Bootstrap Status") adds a
 * private `#bootstrapped: boolean` field (initial `false`) and a FIFTH
 * method, `isBootstrapped(): boolean` — a synchronous, side-effect-free
 * read of that field, never throwing. `#bootstrapped` becomes `true`
 * ONLY on `bootstrapIdentity()`'s own successful completion — the
 * assignment sits AFTER the `await`, so a rejection from
 * `describeIdentity()` propagates (unchanged from Alpha 058) and
 * `#bootstrapped` stays `false`; Bootstrap-never-attempted and
 * Bootstrap-failed are therefore indistinguishable through
 * `isBootstrapped()` alone, a deliberate Fail-Closed choice. No
 * Authority is added by this Stage — it does not call
 * `bootstrapIdentity()` from anywhere, and does not wire Desktop or
 * any other caller; it only makes an already-callable method's own
 * outcome observable to whatever caller a future Stage eventually
 * wires in. See
 * `docs/secure_runtime_alpha_060_identity_bootstrap_status.md` for the
 * full design rationale, including why a `boolean` was chosen over an
 * `enum`/`Promise`/timestamp/counter.
 *
 * Secure Runtime Alpha 061 ("Identity Bootstrap Idempotency") adds ONE
 * guard statement, `if (this.#bootstrapped) { return; }`, as
 * `bootstrapIdentity()`'s own new FIRST statement — a repeat call on an
 * instance that has already bootstrapped successfully returns
 * immediately, without a second `describeIdentity()` call, without a
 * second Registry `register()` attempt (Alpha 042's own responsibility,
 * never reached a second time), and without a second read of the
 * injected Provider. A FAILED attempt leaves `#bootstrapped` at `false`
 * (unchanged from Alpha 060), so the guard does NOT trigger next time —
 * the very next `bootstrapIdentity()` call retries `describeIdentity()`
 * for real; there is no permanent lock-out on failure. See
 * `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md` for
 * the full design rationale, including why Option B (idempotent,
 * first-success-only) was adopted over running every time, retry-only-
 * on-failure, a fresh Registry per attempt, or an explicit `reset()`.
 *
 * This file defines a SINGLE CLASS and nothing else — no function, no
 * module-scoped singleton, no environment read, no Worker reference,
 * no Storage reference, no Rust reference, and no wiring into
 * `AppRuntime`/`RuntimeEnv`/`RuntimeOverrides` (`types.js`) or the
 * Public Runtime API. `create_runtime.ts` (Alpha 051) is the ONLY file
 * in this repository that constructs a `FedosRuntimeIdentity` — held
 * as a private, function-scoped constant there, never returned from
 * `createRuntime()`, never attached to the `AppRuntime` object literal
 * that function assembles, and never read by any other file.
 *
 * HARD GUARDRAILS:
 *   - `FedosRuntimeIdentity` is the ONLY export.
 *   - The constructor takes NO arguments, reads NO `RuntimeEnv`, and
 *     performs NO environment classification of any kind — Runtime
 *     Mode (`Development`/`Production`/`Unknown`) does not change what
 *     gets constructed; the SAME three Identity Layer objects are
 *     assembled identically regardless of mode.
 *   - The injected `FedosIdentityProvider` is ALWAYS
 *     `resolveFedosIdentityProvider() ?? new NoopFedosIdentityProvider()`
 *     — the nullable Resolver return type is handled with the SAME
 *     safe, permanently-`null`-resolving fallback Alpha 033 built for
 *     exactly this purpose; `resolveFedosIdentityProvider()` itself is
 *     never modified and, as of this Arc, never actually returns
 *     `null` (Alpha 036/039/049).
 *   - `describeIdentity()`/`findIdentity()`/`listIdentities()` are PURE
 *     PASS-THROUGHS to the internally-held Service/Resolver — no new
 *     validation, caching, aggregation, or transformation of any kind.
 *     `findIdentity()`/`listIdentities()` remain SYNCHRONOUS, matching
 *     `FedosIdentityResolver`'s own synchronous API exactly (Alpha
 *     054); `describeIdentity()` remains `async`, matching
 *     `FedosIdentityService`'s own async API exactly (Alpha 053).
 *   - `bootstrapIdentity()` (Alpha 058) is ALSO a pure delegation — it
 *     calls `this.#service.describeIdentity()` exactly once, `await`s
 *     it, and returns nothing; it performs NO Registry read/write of
 *     its own, NO retry, NO caching, and NO error handling of any kind
 *     — a rejection from `describeIdentity()` propagates unmodified.
 *     It is NEVER called from anywhere in this file or from
 *     `create_runtime.ts`.
 *   - `#bootstrapped`/`isBootstrapped()` (Alpha 060) track ONLY whether
 *     `bootstrapIdentity()` has EVER completed successfully — initial
 *     `false`, flips to `true` ONLY after that method's own internal
 *     `await` resolves without throwing. `isBootstrapped()` itself is
 *     SYNCHRONOUS, reads only the private field, performs no I/O, and
 *     NEVER throws. Bootstrap-not-yet-attempted and Bootstrap-failed
 *     both report `false` — Fail Closed by construction, not by any
 *     `try`/`catch` this file adds.
 *   - `bootstrapIdentity()` (Alpha 061) is IDEMPOTENT after a successful
 *     completion: its own new FIRST statement,
 *     `if (this.#bootstrapped) { return; }`, makes every call after the
 *     first successful one a synchronous no-op — no second
 *     `describeIdentity()` call, no second Provider read, no second
 *     Registry `register()` attempt. A FAILED attempt does NOT set the
 *     guard — `#bootstrapped` stays `false`, so the very next call
 *     retries for real. NO permanent lock-out on failure exists
 *     anywhere in this file.
 *
 * Secure Runtime Alpha 062 (review only, no code change) formally
 * compared five approaches to resetting Bootstrap state and adopted
 * "treat `FedosRuntimeIdentity` as a short-lived object; Identity
 * switching means constructing a new instance" — explicitly rejecting
 * an in-place `resetIdentityBootstrap()`/`Registry.clear()`/
 * `shutdown()` of any kind. See
 * `docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md`.
 * No field or method in this file changed as a result of that Stage.
 *
 * Secure Runtime Alpha 063 ("Runtime Identity Descriptor Cache") adds a
 * private `#descriptor: FedosIdentityDescriptor | null` field (initial
 * `null`) and a SIXTH method, `currentIdentity(): FedosIdentityDescriptor | null`
 * — a synchronous, side-effect-free, never-throwing read of that field.
 * `bootstrapIdentity()`'s own pre-existing `await
 * this.#service.describeIdentity();` statement now captures its return
 * value into `this.#descriptor` instead of discarding it — the ONLY
 * change to that method's own body; the guard, the `await` itself, and
 * the trailing `this.#bootstrapped = true;` assignment are otherwise
 * byte-for-byte unchanged, in the same order. `#descriptor` therefore
 * changes ONLY on a successful `bootstrapIdentity()` completion — same
 * as `#bootstrapped` — and takes on EXACTLY what
 * `FedosIdentityService.describeIdentity()` returned: `null` when the
 * Provider has no identity to report, or a real `FedosIdentityDescriptor`
 * otherwise. A REJECTED `describeIdentity()` call leaves `#descriptor`
 * completely untouched (the assignment sits after the `await`, so it is
 * never reached), matching `#bootstrapped`'s own Alpha 060 Fail-Closed
 * behavior exactly. `currentIdentity()` returns the held reference
 * AS-IS — no clone, no defensive copy, no re-derivation — since
 * `FedosIdentityDescriptor`'s own fields (Alpha 028/045) are already
 * `readonly` and this file never mutates a Descriptor it receives. See
 * `docs/secure_runtime_alpha_063_runtime_identity_descriptor_cache.md`
 * for the full design rationale, including why caching (Option A) was
 * adopted over re-querying the Service/Registry/Resolver on every call
 * or holding the in-flight `Promise` itself.
 *
 *   - `#descriptor`/`currentIdentity()` (Alpha 063) track ONLY the
 *     Descriptor from the MOST RECENT successful `bootstrapIdentity()`
 *     completion — initial `null`, reassigned ONLY inside
 *     `bootstrapIdentity()`'s own guarded body, to EXACTLY
 *     `this.#service.describeIdentity()`'s own return value.
 *     `currentIdentity()` itself is SYNCHRONOUS, performs NO I/O, NEVER
 *     throws, and returns the held reference unchanged — no clone, no
 *     copy, no transformation.
 *
 * Secure Runtime Alpha 064 ("Identity Change Detection") added a private
 * `#identityVersion: number` field (initial `0`) and a SEVENTH method,
 * `identityVersion(): number`, plus one final statement in
 * `bootstrapIdentity()`'s own guarded body, `this.#identityVersion +=
 * 1;` — both SINCE REMOVED, see Alpha 065/066 below. See
 * `docs/secure_runtime_alpha_064_identity_change_detection.md` for that
 * Stage's own original design rationale, preserved for history.
 *
 * Secure Runtime Alpha 065 (review only, no code change) formally
 * proved, as a structural property of the actual source rather than an
 * estimate, that `identityVersion()` could only ever read `0` or `1`
 * per instance, could never observe a Descriptor change on a single
 * instance, carried no cross-instance comparison value, and was
 * informationally IDENTICAL to `isBootstrapped()` for every reachable
 * state — `identityVersion() === (isBootstrapped() ? 1 : 0)`, always,
 * because both fields were written in the same guarded branch, in
 * adjacent statements, with no code path capable of setting one
 * without the other. That Stage adopted Option D — consolidate onto
 * `isBootstrapped()` as the sole Bootstrap-state reader, delete
 * `identityVersion()`/`#identityVersion` — as its own formal Decision.
 * See
 * `docs/secure_runtime_alpha_065_identity_runtime_internal_contract_review.md`.
 *
 * Secure Runtime Alpha 066 ("Identity Version Removal") implements that
 * Decision, and ONLY that Decision: `#identityVersion` and
 * `identityVersion()` are REMOVED from this file, and
 * `bootstrapIdentity()`'s own guarded body loses its own final
 * statement, `this.#identityVersion += 1;` — the guard, the
 * descriptor-capturing `await`, and the `this.#bootstrapped = true;`
 * assignment are otherwise byte-for-byte unchanged, in the same order.
 * `describeIdentity()`/`findIdentity()`/`listIdentities()`/
 * `isBootstrapped()`/`currentIdentity()` are all byte-for-byte
 * unchanged. This file now defines SIX public methods, not seven — the
 * class had exactly this same six-method shape once before, between
 * Alpha 063 and Alpha 064; this Stage returns it there. See
 * `docs/secure_runtime_alpha_066_identity_version_removal.md` for the
 * full removal rationale.
 *
 * Secure Runtime Alpha 067 (review only, no code change) confirmed,
 * from the code, that PUBLIC `describeIdentity()` was a genuine
 * Bootstrap-lifecycle bypass — it reached the SAME
 * `FedosIdentityService.describeIdentity()` `bootstrapIdentity()`
 * reaches, including the SAME conditional `registry.register()` write,
 * but updated NEITHER `#descriptor` NOR `#bootstrapped`, and carried NO
 * idempotency guard of its own. It also confirmed `bootstrapIdentity()`
 * itself never called `this.describeIdentity()` — the two reached the
 * Service through two INDEPENDENT code paths. That Stage adopted
 * Option D: make `describeIdentity()` a true private method AND rewire
 * `bootstrapIdentity()` to call it, consolidating to ONE internal path.
 * See
 * `docs/secure_runtime_alpha_067_identity_reader_boundary_review.md`.
 *
 * Secure Runtime Alpha 068 ("Identity Reader Boundary Consolidation")
 * implements that Decision, and ONLY that Decision: PUBLIC
 * `describeIdentity(): Promise<FedosIdentityDescriptor | null>` is
 * REMOVED and replaced by a true private
 * `#describeIdentity(): Promise<FedosIdentityDescriptor | null>` with
 * the IDENTICAL one-line body, `return this.#service.describeIdentity();`
 * — and `bootstrapIdentity()`'s own second statement now reads
 * `this.#descriptor = await this.#describeIdentity();` in place of its
 * previous `this.#descriptor = await this.#service.describeIdentity();`
 * — the ONLY two changes in this file. The guard (Alpha 061), the
 * `#descriptor`/`#bootstrapped` assignments and their own order (Alpha
 * 060/063), Registry registration (still entirely
 * `FedosIdentityService`'s own responsibility, Alpha 042, reached
 * identically through `#describeIdentity()` → `this.#service.describeIdentity()`),
 * and every Fail-Closed guarantee this file has ever established are
 * completely UNCHANGED — this Stage narrows WHO can reach the Service's
 * own `describeIdentity()` through this class (only `bootstrapIdentity()`,
 * now), not WHAT happens when it is reached. `findIdentity()`/
 * `listIdentities()`/`isBootstrapped()`/`currentIdentity()` are all
 * byte-for-byte unchanged. `bootstrapIdentity()` is now the ONLY public
 * method on this class that ever reaches `this.#service` — no external
 * caller, and as of this Stage no OTHER internal caller, can trigger a
 * Provider read or Registry write through this class without also
 * going through the idempotency guard and the `#descriptor`/
 * `#bootstrapped` accounting `bootstrapIdentity()` performs. See
 * `docs/secure_runtime_alpha_068_identity_reader_boundary_consolidation.md`
 * for the full implementation record.
 *
 *   - `#describeIdentity()` (Alpha 068) is a true JavaScript private
 *     method — unreachable from outside this class by any means,
 *     including from `test/*.test.ts` files, which is the intended,
 *     enforced effect of this Stage. Its own body is BYTE-FOR-BYTE the
 *     same single statement the former public `describeIdentity()` had:
 *     `return this.#service.describeIdentity();`. It has EXACTLY ONE
 *     caller anywhere in this file: `bootstrapIdentity()`'s own second
 *     statement.
 *   - NO Relay, event, signing, secret-key, Authentication, Credential,
 *     or Session reference of any kind.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 */

import { FedosIdentityService } from "../identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../identity/fedos_identity_registry.js";
import { FedosIdentityResolver } from "../identity/fedos_identity_resolver.js";
import { resolveFedosIdentityProvider } from "../identity/fedos_identity_provider_resolver.js";
import { NoopFedosIdentityProvider } from "../identity/fedos_noop_identity_provider.js";
import type { FedosIdentityDescriptor } from "../identity/fedos_identity_descriptor.js";
import type { FedosIdentityRecord } from "../identity/fedos_identity_record.js";

export class FedosRuntimeIdentity {
  readonly #registry: FedosIdentityRegistry;
  readonly #service: FedosIdentityService;
  readonly #resolver: FedosIdentityResolver;
  #bootstrapped: boolean = false;
  #descriptor: FedosIdentityDescriptor | null = null;

  constructor() {
    this.#registry = new FedosIdentityRegistry();
    const provider = resolveFedosIdentityProvider() ?? new NoopFedosIdentityProvider();
    this.#service = new FedosIdentityService(provider, this.#registry);
    this.#resolver = new FedosIdentityResolver(this.#registry);
  }

  async #describeIdentity(): Promise<FedosIdentityDescriptor | null> {
    return this.#service.describeIdentity();
  }

  findIdentity(id: string): FedosIdentityRecord | null {
    return this.#resolver.findIdentity(id);
  }

  listIdentities(): readonly FedosIdentityRecord[] {
    return this.#resolver.listIdentities();
  }

  async bootstrapIdentity(): Promise<void> {
    if (this.#bootstrapped) {
      return;
    }
    this.#descriptor = await this.#describeIdentity();
    this.#bootstrapped = true;
  }

  isBootstrapped(): boolean {
    return this.#bootstrapped;
  }

  currentIdentity(): FedosIdentityDescriptor | null {
    return this.#descriptor;
  }
}
