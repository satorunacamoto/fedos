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
 *
 * Secure Runtime Alpha 069 ("Identity Bootstrap State Consolidation")
 * adds a private, SYNCHRONOUS method,
 * `#completeBootstrap(descriptor: FedosIdentityDescriptor | null): void`,
 * whose own body is EXACTLY two statements —
 * `this.#descriptor = descriptor; this.#bootstrapped = true;` — and
 * NOTHING else: no branching, no Provider/Registry/Resolver/Storage
 * access, no `try`/`catch`, no `await`. `bootstrapIdentity()`'s own
 * guarded body is rewritten to
 * `const descriptor = await this.#describeIdentity(); this.#completeBootstrap(descriptor);`
 * — the SAME two effects (`#descriptor` assignment, then
 * `#bootstrapped` assignment), in the SAME order, now performed by ONE
 * dedicated method instead of two separate statements inline.
 * `#descriptor` and `#bootstrapped` are now EACH assigned in exactly
 * ONE place in the entire file: inside `#completeBootstrap()`, and
 * nowhere else. This Stage adds NO new field, NO new public API, and
 * changes NO observable behavior — idempotency, Fail Closed, Registry
 * registration (still entirely `FedosIdentityService`'s own
 * responsibility, reached identically through `#describeIdentity()`),
 * Provider call count, and Bootstrap semantics are all completely
 * UNCHANGED. See
 * `docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md`
 * for the full implementation record.
 *
 *   - `#completeBootstrap()` (Alpha 069) is the ONLY place in this
 *     file that ever assigns to `#descriptor` or `#bootstrapped`. It
 *     is SYNCHRONOUS (no `async`, no `await`), takes exactly one
 *     parameter (`descriptor: FedosIdentityDescriptor | null`),
 *     returns `void`, and performs no I/O, no branching, and no error
 *     handling of any kind. It has EXACTLY ONE caller anywhere in this
 *     file: `#bootstrapIdentity()`'s own second statement.
 *
 * Secure Runtime Alpha 070 ("Identity Bootstrap Entry Consolidation")
 * moves `bootstrapIdentity()`'s own entire guarded body — the guard,
 * the `#describeIdentity()` call, and the `#completeBootstrap()` call,
 * in that EXACT order, byte-for-byte unchanged — into a new private
 * method, `#bootstrapIdentity(): Promise<void>`. The PUBLIC
 * `bootstrapIdentity()` becomes a pure one-line wrapper,
 * `return this.#bootstrapIdentity();`, and performs NOTHING else — no
 * guard of its own, no state read or write, no error handling. This
 * Stage adds NO new field, NO new public API, and changes NO
 * observable behavior of any kind — the guard/`#describeIdentity()`/
 * `#completeBootstrap()` sequence Alpha 061/068/069 each built is
 * relocated, not altered. `bootstrapIdentity()`'s own Bootstrap BODY
 * now exists in exactly ONE place — `#bootstrapIdentity()` — matching
 * the single-write-site/single-reader-site discipline Alpha 069/068
 * already established for Bootstrap STATE and the Identity Service
 * READ path, respectively. See
 * `docs/secure_runtime_alpha_070_identity_bootstrap_entry_consolidation.md`
 * for the full implementation record.
 *
 *   - `#bootstrapIdentity()` (Alpha 070) holds the ENTIRE Bootstrap
 *     body — the guard (Alpha 061), the `#describeIdentity()` call
 *     (Alpha 068), and the `#completeBootstrap()` call (Alpha 069), in
 *     that exact order, byte-for-byte identical to what
 *     `bootstrapIdentity()`'s own body was immediately before this
 *     Stage. It has EXACTLY ONE caller anywhere in this file: the
 *     PUBLIC `bootstrapIdentity()`'s own single statement.
 *   - PUBLIC `bootstrapIdentity(): Promise<void>` (Alpha 070) is a
 *     PURE WRAPPER — its own entire body is
 *     `return this.#bootstrapIdentity();`, nothing more.
 *   - NO Relay, event, signing, secret-key, Authentication, Credential,
 *     or Session reference of any kind.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 *
 * Secure Runtime Alpha 071 (review only, no functional code change)
 * formally confirms that the Public Bootstrap API is now consolidated
 * to exactly ONE place: PUBLIC `bootstrapIdentity(): Promise<void>`
 * remains a PURE WRAPPER — its own entire body is
 * `return this.#bootstrapIdentity();`, with no `if`, no `await`, no
 * `try`/`catch`, and no reference to `#service`/`#registry`/`#resolver`
 * of its own — and that the guard (Alpha 061), the `#describeIdentity()`
 * call (Alpha 068), the `#completeBootstrap()` call (Alpha 069), the
 * `await`, and the Descriptor capture all exist in EXACTLY ONE place:
 * private `#bootstrapIdentity()` (Alpha 070). This Stage changes no
 * field, no method body, and no observable behavior of any kind — it
 * is a formal confirmation of a property Alpha 070 already established.
 * See
 * `docs/secure_runtime_alpha_071_identity_bootstrap_public_api_consolidation.md`
 * for the full review record.
 *
 * Secure Runtime Alpha 072 ("Identity Bootstrap State Reader
 * Consolidation") adds a private, SYNCHRONOUS method,
 * `#isBootstrapped(): boolean`, whose own entire body is
 * `return this.#bootstrapped;` — and NOTHING else: no `if`, no
 * `try`/`catch`, no `await`, no Provider/Registry/Storage/Resolver
 * reference. The PUBLIC `isBootstrapped(): boolean` becomes a pure
 * one-line wrapper, `return this.#isBootstrapped();`, and performs
 * NOTHING else. `#bootstrapIdentity()`'s own guard is rewritten from
 * `if (this.#bootstrapped) {` to `if (this.#isBootstrapped()) {` —
 * the ONLY other change this Stage makes; the guard's own position
 * (first statement), its own body (`return;`), and the rest of
 * `#bootstrapIdentity()` are otherwise byte-for-byte unchanged. `#bootstrapped`
 * is now READ in exactly ONE place in this file — inside
 * `#isBootstrapped()` — matching the single-reader-site/
 * single-writer-site/single-entry-site discipline Alpha 068/069/070
 * already established for the Identity Service READ path, Bootstrap
 * STATE writes, and the Bootstrap ENTRY point, respectively. This
 * Stage adds NO new field, NO new public API, and changes NO
 * observable behavior of any kind. See
 * `docs/secure_runtime_alpha_072_identity_bootstrap_state_reader_consolidation.md`
 * for the full implementation record.
 *
 *   - `#isBootstrapped()` (Alpha 072) is the ONLY place in this file
 *     that ever READS `#bootstrapped`. It is SYNCHRONOUS (no `async`,
 *     no `await`), takes no parameters, returns `boolean`, and
 *     performs no I/O, no branching, and no error handling of any
 *     kind. It has exactly TWO callers anywhere in this file: the
 *     PUBLIC `isBootstrapped()`'s own single statement, and
 *     `#bootstrapIdentity()`'s own guard condition.
 *   - PUBLIC `isBootstrapped(): boolean` (Alpha 072) is a PURE
 *     WRAPPER — its own entire body is
 *     `return this.#isBootstrapped();`, nothing more.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 *
 * Secure Runtime Alpha 073 ("Identity Descriptor Reader Consolidation")
 * adds a private, SYNCHRONOUS method,
 * `#currentIdentity(): FedosIdentityDescriptor | null`, whose own
 * entire body is `return this.#descriptor;` — and NOTHING else: no
 * `if`, no `try`/`catch`, no `await`, no Provider/Registry/Resolver/
 * Storage reference. The PUBLIC
 * `currentIdentity(): FedosIdentityDescriptor | null` becomes a pure
 * one-line wrapper, `return this.#currentIdentity();`, and performs
 * NOTHING else. `#descriptor` is now READ in exactly ONE place in
 * this file — inside `#currentIdentity()` — matching the
 * single-reader-site/single-writer-site/single-entry-site discipline
 * Alpha 068/069/070/072 already established for the Identity Service
 * READ path, Bootstrap STATE writes, the Bootstrap ENTRY point, and
 * the Bootstrap STATE read, respectively. `#completeBootstrap()`
 * (Alpha 069) remains the ONLY place in this file that ever WRITES
 * `#descriptor`, completely unaffected by this Stage. This Stage adds
 * NO new field, NO new public API, and changes NO observable behavior
 * of any kind. See
 * `docs/secure_runtime_alpha_073_identity_descriptor_reader_consolidation.md`
 * for the full implementation record.
 *
 *   - `#currentIdentity()` (Alpha 073) is the ONLY place in this file
 *     that ever READS `#descriptor`. It is SYNCHRONOUS (no `async`,
 *     no `await`), takes no parameters, returns
 *     `FedosIdentityDescriptor | null`, and performs no I/O, no
 *     branching, and no error handling of any kind. It has EXACTLY
 *     ONE caller anywhere in this file: the PUBLIC
 *     `currentIdentity()`'s own single statement.
 *   - PUBLIC `currentIdentity(): FedosIdentityDescriptor | null`
 *     (Alpha 073) is a PURE WRAPPER — its own entire body is
 *     `return this.#currentIdentity();`, nothing more.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 *
 * Secure Runtime Alpha 074 ("Identity Bootstrap Flow Consolidation")
 * adds a private, ASYNC method,
 * `#performBootstrap(): Promise<FedosIdentityDescriptor | null>`,
 * whose own entire body is `return this.#describeIdentity();` — and
 * NOTHING else: no `if`, no `try`/`catch`, no synchronous processing,
 * no State update, no `#completeBootstrap()` call, no direct
 * Provider/Registry/Resolver/Storage reference. `#bootstrapIdentity()`'s
 * own descriptor-capturing statement is rewritten from
 * `const descriptor = await this.#describeIdentity();` to
 * `const descriptor = await this.#performBootstrap();` — the ONLY
 * other change this Stage makes; the guard, the guard's own position,
 * and the trailing `this.#completeBootstrap(descriptor);` call are
 * otherwise byte-for-byte unchanged. `#describeIdentity()` now has
 * EXACTLY ONE caller in this file — `#performBootstrap()`'s own single
 * statement — in place of `#bootstrapIdentity()`; `#completeBootstrap()`
 * remains the ONLY place in this file that ever writes
 * `#descriptor`/`#bootstrapped`, completely unaffected by this Stage.
 * `#bootstrapIdentity()` itself is now a pure orchestrator: guard, then
 * delegate the Bootstrap Flow to `#performBootstrap()`, then hand the
 * result to `#completeBootstrap()` — it no longer reaches
 * `#describeIdentity()` directly. This Stage adds NO new field, NO new
 * public API, and changes NO observable behavior of any kind. See
 * `docs/secure_runtime_alpha_074_identity_bootstrap_flow_consolidation.md`
 * for the full implementation record.
 *
 *   - `#performBootstrap()` (Alpha 074) is the Bootstrap FLOW itself,
 *     as its own named, isolated unit — its own entire body is
 *     `return this.#describeIdentity();`, nothing more. It is ASYNC,
 *     performs no synchronous processing, no State update, no
 *     `#completeBootstrap()` call, and no direct Provider/Registry/
 *     Resolver/Storage reference of its own — it delegates entirely to
 *     `#describeIdentity()`. It has EXACTLY ONE caller anywhere in
 *     this file: `#bootstrapIdentity()`'s own descriptor-capturing
 *     statement.
 *   - `#describeIdentity()` (Alpha 074) has EXACTLY ONE caller
 *     anywhere in this file: `#performBootstrap()`'s own single
 *     statement.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 *
 * Secure Runtime Alpha 075 ("Identity Descriptor Acquisition
 * Consolidation") adds a private, ASYNC method,
 * `#acquireDescriptor(): Promise<FedosIdentityDescriptor | null>`,
 * whose own entire body is `return this.#describeIdentity();` — a bare
 * Promise pass-through with NO `await` keyword, no `if`, no
 * `try`/`catch`, no direct Provider/Registry/Resolver/Storage
 * reference, and no State update of any kind. `#performBootstrap()`'s
 * own single statement is rewritten from
 * `return this.#describeIdentity();` to
 * `return this.#acquireDescriptor();` — the ONLY other change this
 * Stage makes. `#describeIdentity()` now has EXACTLY ONE caller in
 * this file — `#acquireDescriptor()`'s own single statement — in place
 * of `#performBootstrap()`. `#performBootstrap()` itself now holds NO
 * Descriptor-acquisition logic of its own; it delegates entirely to
 * `#acquireDescriptor()`. The full chain is now
 * `#bootstrapIdentity()` → `#performBootstrap()` →
 * `#acquireDescriptor()` → `#describeIdentity()` →
 * `FedosIdentityService`, with each link reached by exactly one
 * caller. This Stage adds NO new field, NO new public API, and changes
 * NO observable behavior of any kind. See
 * `docs/secure_runtime_alpha_075_identity_descriptor_acquisition_consolidation.md`
 * for the full implementation record.
 *
 *   - `#acquireDescriptor()` (Alpha 075) is a pure Promise pass-through
 *     to `#describeIdentity()` — its own entire body is
 *     `return this.#describeIdentity();`, nothing more. It has NO
 *     `await`, NO `if`, NO `try`/`catch`, and performs no direct
 *     Provider/Registry/Resolver/Storage reference and no State update
 *     of any kind. It has EXACTLY ONE caller anywhere in this file:
 *     `#performBootstrap()`'s own single statement.
 *   - `#describeIdentity()` (Alpha 075) has EXACTLY ONE caller
 *     anywhere in this file: `#acquireDescriptor()`'s own single
 *     statement.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 *
 * Secure Runtime Alpha 076 ("Identity Bootstrap Observation Boundary")
 * adds a private method,
 * `#observeBootstrap(descriptor: FedosIdentityDescriptor | null): void`,
 * called exactly once, immediately before `#completeBootstrap()`, from
 * `#bootstrapIdentity()`'s own body — the ONLY other change this Stage
 * makes. `#observeBootstrap()` is, as of this Stage, an EMPTY
 * implementation — no statement of any kind in its own body beyond a
 * comment. It performs NO Provider/Registry/Resolver/Storage
 * reference and mutates NO Runtime state; it exists purely as a named
 * observation BOUNDARY, not yet an observer. Bootstrap semantics,
 * Registry registration, the Descriptor Cache, and the `#bootstrapped`
 * flag are all completely UNCHANGED by this Stage — calling a no-op
 * immediately before the existing State Writer alters nothing
 * observable. This Stage adds NO new field, NO new public API, and
 * changes NO observable behavior of any kind. See
 * `docs/secure_runtime_alpha_076_identity_bootstrap_observation_boundary.md`
 * for the full implementation record.
 *
 *   - `#observeBootstrap()` (Alpha 076) is an EMPTY implementation —
 *     its own body contains no statement, only a comment. It has
 *     EXACTLY ONE caller anywhere in this file:
 *     `#bootstrapIdentity()`'s own statement immediately before the
 *     `#completeBootstrap()` call.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 *
 * Secure Runtime Alpha 077 ("Identity Bootstrap Observation Contract",
 * review only, NO code change) formally fixes what `#observeBootstrap()`
 * IS and is not, as a contract binding every future implementation of
 * it: it is a Bootstrap-observation-ONLY Hook — synchronous, void
 * return, never throwing, never reading or writing `#descriptor`/
 * `#bootstrapped`, never touching the Registry, and never altering
 * Bootstrap semantics in any way. Its future permitted uses are
 * limited to Metrics, Tracing, Audit, Logging, and Telemetry — nothing
 * else. This Stage changes no field, no method body, and no
 * observable behavior of any kind; it is a formal confirmation of a
 * contract Alpha 076's own empty implementation already satisfies. See
 * `docs/secure_runtime_alpha_077_identity_bootstrap_observation_contract.md`
 * for the full review record.
 *
 *   - `#observeBootstrap()` (Alpha 077 Contract) MUST remain: a pure
 *     observation Hook (Metrics/Tracing/Audit/Logging/Telemetry ONLY);
 *     synchronous (no `async`, no `await`); `void`-returning; never
 *     throwing; never reading OR writing `#descriptor`/`#bootstrapped`;
 *     never referencing `#registry`/`#service`/`#resolver`; and never
 *     altering Bootstrap semantics (Registry registration, the
 *     Descriptor Cache, or the `#bootstrapped` flag) in any way.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 *
 * Secure Runtime Alpha 078 ("Identity Bootstrap Observation Ordering
 * Review", review only, NO code change) formally fixes the ORDER
 * guarantee `#observeBootstrap()` operates under, confirmed directly
 * against the actual source: `#bootstrapIdentity()` →
 * `#performBootstrap()` → `#acquireDescriptor()` →
 * `#describeIdentity()` → `#observeBootstrap()` →
 * `#completeBootstrap()`. `#observeBootstrap()` is ALWAYS called
 * strictly BEFORE `#completeBootstrap()` — never after, never
 * concurrently — so at the moment `#observeBootstrap()` runs,
 * `#descriptor` has NOT yet been updated with the current attempt's
 * result and `#bootstrapped` is still `false` (the guard's own
 * unmodified pre-attempt value): `#observeBootstrap()` observes ONLY
 * the state BEFORE the write, never the state AFTER it.
 * `#completeBootstrap()` (Alpha 069) remains the ONLY place in this
 * file that ever performs a state update — this Stage's own review
 * guarantees that no future Observation implementation (Logging,
 * Tracing, Audit, Metrics, or Telemetry, per the Alpha 077 Contract)
 * may ever change this write ORDER. This Stage changes no field, no
 * method body, and no observable behavior of any kind; it is a formal
 * confirmation of an ordering property the actual source already
 * guarantees. See
 * `docs/secure_runtime_alpha_078_identity_bootstrap_observation_ordering_review.md`
 * for the full review record.
 *
 *   - The Bootstrap Flow's own call chain (Alpha 078) is FIXED, in
 *     this EXACT order, permanently: `#bootstrapIdentity()` →
 *     `#performBootstrap()` → `#acquireDescriptor()` →
 *     `#describeIdentity()` → `#observeBootstrap()` →
 *     `#completeBootstrap()`. No future Stage may reorder this chain,
 *     move `#observeBootstrap()` to run after `#completeBootstrap()`,
 *     or run the two concurrently.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 *
 * Secure Runtime Alpha 079 ("Identity Bootstrap Observation Scope
 * Review", review only, NO code change) formally fixes the SCOPE of
 * information any future `#observeBootstrap()` implementation may
 * ever observe. ALLOWED: that a Bootstrap started, that it ended, the
 * bare fact of whether the resolved Descriptor was `null` or
 * non-`null`, elapsed processing time, invocation count, and
 * success/failure outcome. FORBIDDEN, permanently: the Descriptor's
 * own contents (`publicIdentifier`, `displayName`, `avatar`, or any
 * other field), Provider internal state, Registry internal state,
 * Storage, Runtime Mode, Runtime Platform, or any secret material.
 * `#observeBootstrap()`'s own current EMPTY body trivially satisfies
 * this Scope — it reads nothing, so it cannot exceed it — and its own
 * `descriptor: FedosIdentityDescriptor | null` parameter, while
 * technically reachable, must never have its own fields read by any
 * future implementation. This Stage changes no field, no method body,
 * and no observable behavior of any kind; it is a formal boundary a
 * future Metrics/Tracing/Audit/Logging/Telemetry implementation (per
 * the Alpha 077 Contract) must never cross. See
 * `docs/secure_runtime_alpha_079_identity_bootstrap_observation_scope_review.md`
 * for the full review record.
 *
 *   - `#observeBootstrap()`'s own Observation SCOPE (Alpha 079) is
 *     PERMANENTLY fixed: ALLOWED to observe Bootstrap start/end, the
 *     null-vs-non-null fact about the resolved Descriptor, elapsed
 *     time, invocation count, and success/failure; FORBIDDEN from
 *     ever reading the Descriptor's own field contents, Provider/
 *     Registry/Storage internal state, Runtime Mode/Platform, or any
 *     secret material — regardless of what future Stage implements
 *     inside it.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 *
 * Secure Runtime Alpha 080 ("Identity Bootstrap Observation
 * Vocabulary Review", review only, NO code change) formally fixes the
 * VOCABULARY — a closed set of five named tokens, not values or free
 * text — any future `#observeBootstrap()` implementation may ever
 * emit: `BOOTSTRAP_STARTED`, `BOOTSTRAP_COMPLETED`, `BOOTSTRAP_FAILED`,
 * `DESCRIPTOR_PRESENT`, `DESCRIPTOR_ABSENT`. These are FACTS ONLY —
 * no inference, no evaluation, no ranking, no severity assignment.
 * `BOOTSTRAP_COMPLETED`/`BOOTSTRAP_FAILED` describe ONLY whether the
 * Bootstrap Promise itself settled successfully or rejected — entirely
 * independent of whether the resolved Descriptor was `null`; a `null`
 * Descriptor from a successfully resolved Promise is still
 * `BOOTSTRAP_COMPLETED`. The Descriptor itself never becomes
 * Vocabulary — only the bare fact of its presence or absence
 * (`DESCRIPTOR_PRESENT`/`DESCRIPTOR_ABSENT`) may ever be expressed,
 * consistent with the Alpha 079 Scope. Free-form strings, exception
 * message bodies, and stack traces are explicitly OUT of this
 * Vocabulary, permanently — every future Metrics/Tracing/Audit/
 * Logging/Telemetry implementation (per the Alpha 077 Contract) must
 * draw exclusively from this closed five-token set. This Stage
 * changes no field, no method body, and no observable behavior of any
 * kind. See
 * `docs/secure_runtime_alpha_080_identity_bootstrap_observation_vocabulary_review.md`
 * for the full review record.
 *
 *   - `#observeBootstrap()`'s own Observation VOCABULARY (Alpha 080)
 *     is PERMANENTLY fixed to exactly five tokens:
 *     `BOOTSTRAP_STARTED`, `BOOTSTRAP_COMPLETED`, `BOOTSTRAP_FAILED`,
 *     `DESCRIPTOR_PRESENT`, `DESCRIPTOR_ABSENT` — facts only, no
 *     inference/evaluation/ranking/severity, no free-form strings, no
 *     exception message bodies, no stack traces, and no Descriptor
 *     content of any kind, regardless of what future Stage implements
 *     inside it.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 *
 * Secure Runtime Alpha 081 ("Identity Bootstrap Observation Event
 * Review", review only, NO code change, NO implementation) formally
 * fixes the SHAPE any future Observation Event — should
 * `#observeBootstrap()` ever notify an external sink — is permitted to
 * have: EXACTLY three fields, `event` (a fixed name), `timestamp` (the
 * observation instant), and the Alpha 080 Vocabulary token itself —
 * and NOTHING else. REJECTED, permanently, as Event fields: Descriptor,
 * Provider, Registry, Storage, Runtime, Platform, `displayName`,
 * `avatar`, `publicIdentifier`, Error Message, Stack Trace, Severity,
 * Category, Metadata, Attributes, Payload, or any free-form string.
 * The Event's own entire purpose is to CARRY the Vocabulary token
 * (Alpha 080) — it adds NO meaning of its own beyond the token, the
 * fixed event name, and the timestamp. Every future
 * Logging/Tracing/Audit/Telemetry/Metrics implementation (per the
 * Alpha 077 Contract) MUST use this SAME three-field Event shape — no
 * purpose-specific Payload of any kind is permitted. This Stage
 * implements nothing — `#observeBootstrap()`'s own body remains
 * exactly the empty implementation Alpha 076 left it — and changes no
 * field, no method body, and no observable behavior of any kind. See
 * `docs/secure_runtime_alpha_081_identity_bootstrap_observation_event_review.md`
 * for the full review record.
 *
 *   - Any future Observation Event (Alpha 081 Decision) emitted from
 *     `#observeBootstrap()` is PERMANENTLY fixed to EXACTLY three
 *     fields — `event`, `timestamp`, and the Alpha 080 Vocabulary
 *     token — and NOTHING else: no Descriptor, Provider, Registry,
 *     Storage, Runtime, Platform, `displayName`, `avatar`,
 *     `publicIdentifier`, Error Message, Stack Trace, Severity,
 *     Category, Metadata, Attributes, Payload, or free-form string, in
 *     any future implementation, for any purpose.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 *
 * Secure Runtime Alpha 082 ("Identity Bootstrap Observation Event
 * Lifecycle Review", review only, NO code change, NO implementation)
 * formally adopts a ONE-WAY Event lifecycle for any hypothetical
 * future Observation Event: generated → optionally consumed →
 * NEVER retained → NEVER resent → end. PERMANENTLY FORBIDDEN, as a
 * consequence: an Observation Queue, an Observation History, an
 * Observation Cache, an Observation Registry, Observation Replay, a
 * Retry Queue, or a Dead Letter Queue of any kind. Observation is NOT
 * State — it carries no history-retention responsibility of its own,
 * and this class must never be turned into a state-management system
 * by a future Observation implementation. A future Event MAY be
 * discarded immediately after generation, and Bootstrap's own
 * semantics — idempotency, Fail Closed, the Descriptor Cache, the
 * `#bootstrapped` flag — must NEVER change based on whether an Event
 * was ever generated, consumed, retained, or discarded. Every future
 * Logging/Metrics/Tracing/Audit/Telemetry implementation (per the
 * Alpha 077 Contract) merely CONSUMES the Event this class emits; this
 * Runtime itself must never carry a persistence responsibility for
 * it. This Stage changes no field, no method body, and no observable
 * behavior of any kind. See
 * `docs/secure_runtime_alpha_082_identity_bootstrap_observation_event_lifecycle_review.md`
 * for the full review record.
 *
 *   - Any future Observation Event's own LIFECYCLE (Alpha 082
 *     Decision) is PERMANENTLY fixed to exactly one direction:
 *     generated → optionally consumed → discarded, end — NEVER
 *     retained (no Queue/History/Cache/Registry of Observation Events)
 *     and NEVER resent (no Replay/Retry Queue/Dead Letter Queue), in
 *     any future implementation, for any purpose. Bootstrap's own
 *     semantics must never depend on an Event's own existence.
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

  #completeBootstrap(descriptor: FedosIdentityDescriptor | null): void {
    this.#descriptor = descriptor;
    this.#bootstrapped = true;
  }

  #observeBootstrap(descriptor: FedosIdentityDescriptor | null): void {
    // Intentionally empty — Bootstrap Observation Boundary (Alpha 076); no observer implementation yet.
  }

  #isBootstrapped(): boolean {
    return this.#bootstrapped;
  }

  #currentIdentity(): FedosIdentityDescriptor | null {
    return this.#descriptor;
  }

  async #acquireDescriptor(): Promise<FedosIdentityDescriptor | null> {
    return this.#describeIdentity();
  }

  async #performBootstrap(): Promise<FedosIdentityDescriptor | null> {
    return this.#acquireDescriptor();
  }

  async #bootstrapIdentity(): Promise<void> {
    if (this.#isBootstrapped()) {
      return;
    }
    const descriptor = await this.#performBootstrap();
    this.#observeBootstrap(descriptor);
    this.#completeBootstrap(descriptor);
  }

  findIdentity(id: string): FedosIdentityRecord | null {
    return this.#resolver.findIdentity(id);
  }

  listIdentities(): readonly FedosIdentityRecord[] {
    return this.#resolver.listIdentities();
  }

  async bootstrapIdentity(): Promise<void> {
    return this.#bootstrapIdentity();
  }

  isBootstrapped(): boolean {
    return this.#isBootstrapped();
  }

  currentIdentity(): FedosIdentityDescriptor | null {
    return this.#currentIdentity();
  }
}
