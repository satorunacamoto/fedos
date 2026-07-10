# Secure Runtime Alpha 053–055 — Identity Runtime Internal Operations

## 1. Why now

Alpha 050–052 connected the Identity Layer to the Runtime: `FedosRuntimeIdentity`
is constructed once per `createRuntime()` call, held entirely internally,
never exposed on `AppRuntime`. That connection was, deliberately,
inert — the constructed object was never called. This Arc's own
mandate is to make `FedosRuntimeIdentity` usable, but ONLY from inside
the Runtime itself: no Public Runtime API addition, no `AppRuntime`
exposure, no Worker, Storage, Crypto, or Nostr change of any kind.

## 2. Alpha 053 — `describeIdentity()`

The requested deliverable is `FedosRuntimeIdentity.describeIdentity()`
with the exact implementation `return this.#service.describeIdentity();`.
That method already exists, verbatim, in `fedos_runtime_identity.ts` —
Alpha 050 shipped it alongside the class's own construction, precisely
so that Alpha 052's own verification tests would have something to
call. **Alpha 053 makes ZERO functional code change.** It formally
re-confirms, as its own separately-reviewed deliverable, that this
method exists, is implemented to this exact specification, and behaves
correctly — the same method, the same body, the same behavior Alpha
050 already shipped.

## 3. Alpha 054 — `findIdentity()`/`listIdentities()`

The requested deliverable is `FedosRuntimeIdentity.findIdentity(id)`
and `FedosRuntimeIdentity.listIdentities()`, both routed through the
Registry (via the internally-held `FedosIdentityResolver`), both
synchronous. Both methods already exist, verbatim, in
`fedos_runtime_identity.ts` — also shipped by Alpha 050, for the same
reason `describeIdentity()` was. **Alpha 054 also makes ZERO
functional code change.** It formally re-confirms these two methods
exist, are implemented to this exact specification, and remain
synchronous — matching `FedosIdentityResolver`'s own synchronous API
exactly, with no `Promise` wrapper Alpha 054 would otherwise have had
to add.

## 4. Why Alpha 053/054 made no code change, rather than being skipped

Every prior Stage in this arc has been documented, tested, and
committed individually, regardless of how small its own delta from the
immediately-preceding state was — Alpha 040 shipped a three-field type
with zero producers; Alpha 041 shipped a Registry with zero callers.
Alpha 053 and Alpha 054 continue that same discipline: even though
Alpha 050 happened to already satisfy their own specifications, each
still gets its own design-doc section, its own dedicated regression
tests confirming the method's exact shape and behavior, and its own
named place in this arc's own history — rather than being silently
skipped, which would leave no record of the specification having been
checked and confirmed at all.

## 5. Why the three methods stay pure pass-throughs

`describeIdentity()`/`findIdentity()`/`listIdentities()` each do
exactly one thing: forward the call to the internally-held
Service/Resolver and return its result, unmodified. No validation, no
caching, no aggregation across multiple Providers, no transformation
of any kind is added by this Arc. `FedosRuntimeIdentity`'s own job
remains ASSEMBLY — holding the three Identity Layer objects together
correctly — not behavior. Any future Stage that wants
Runtime-level caching, batching, or aggregation on top of these calls
would add that logic in a NEW layer, not by complicating these three
methods.

## 6. Alpha 055 — Identity Runtime First Use

`create_runtime.ts`'s own `createRuntime()` now calls
`runtimeIdentity.describeIdentity()` exactly once, immediately after
constructing `runtimeIdentity`, discarding the returned `Promise`:

```ts
const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity();
void runtimeIdentity.describeIdentity().catch(() => {});
```

This is a pure startup-confirmation smoke test — it exists to prove
that a freshly-constructed `FedosRuntimeIdentity`'s own
`describeIdentity()` method can actually be invoked during Runtime
construction without throwing, not to accomplish anything with the
result. The `Promise` is never `await`ed — `createRuntime()` remains
fully synchronous, returning its `AppRuntime` object literal
immediately, exactly as before this Arc. The `.catch(() => {})` exists
purely as defense-in-depth: given the current
`NostrIdentityProvider`/`NullNostrPublicIdentitySource` wiring (Alpha
049), this call can never actually reject, but swallowing a
hypothetical future rejection here means `createRuntime()` itself can
never produce an unhandled promise rejection because of this call, now
or after any future Source implementation change.

## 7. Why the return value is discarded rather than logged or inspected

This Arc's own mandate is explicit: "Runtime起動確認だけ行う" — confirm
only that the Runtime can start up with this call present, nothing
more. Logging, branching on, or otherwise inspecting the resolved
value would be the first piece of REAL Identity-driven Runtime
behavior — exactly what this Arc's own mandate defers to a future,
separately-reviewed Stage. Discarding the value keeps this Stage
honest about its own scope: it proves the wiring is CALLABLE, not that
anything USES what it returns.

## 8. Why `createRuntime()` is not made `async`

Making `createRuntime()` `async` (or otherwise `await`ing this call)
would be an actual behavioral and Public API change — every existing
caller of `createRuntime()`, throughout this entire repository, calls
it synchronously and expects a plain `AppRuntime` object back, not a
`Promise<AppRuntime>`. This Arc's own mandate forbids any Public
Runtime API change; changing `createRuntime()`'s own return type would
be exactly that, regardless of `AppRuntime`'s own field set staying
unchanged. Firing the call without awaiting it is the only shape that
satisfies both "the method is actually invoked during Runtime startup"
and "Runtime startup itself is completely unaffected."

## 9. What this Arc does NOT do

- Does **not** add any field to `AppRuntime` (`types.ts`) — its own
  field set remains exactly the same thirty fields.
- Does **not** modify `fedos_identity_service.ts`,
  `fedos_identity_registry.ts`, `fedos_identity_resolver.ts`,
  `fedos_identity_provider_resolver.ts`, `fedos_nostr_identity_provider.ts`,
  `fedos_null_nostr_public_identity_source.ts`, or
  `fedos_nostr_public_identity_source_resolver.ts`.
- Does **not** change `FedosRuntimeIdentity`'s own constructor or
  private field set — still exactly three private fields, still a
  zero-argument constructor.
- Does **not** modify `src/worker.ts`, or reference it from either
  changed file.
- Does **not** modify any `src/storage/*` or
  `src/runtime/fedos_runtime_storage_*` file.
- Does **not** modify any Crypto Public Runtime API
  (`initializeCrypto`/`runtimeCapabilities`/`randomBytes`/
  `generateAeadKey`/`encrypt`/`decrypt`/`exportCiphertext`/
  `importCiphertext`).
- Does **not** perform any real Nostr Relay connection, event
  construction, signing, or DM feature.
- Does **not** make `createRuntime()` asynchronous, and does not
  change its own synchronous return contract in any way.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.

## 10. Verification matrix (this Arc's own scope)

This Arc's own test suite confirms, across every `RuntimeMode`
(`test`/`local`/`cloudflare`) and every `FedosRuntimeMode`
(`Development`/`Production`/`Unknown`, NODE_ENV-driven): a
directly-constructed `FedosRuntimeIdentity`'s own `describeIdentity()`
always resolves `null`, `findIdentity()` on any id always resolves
`null`, and `listIdentities()` always resolves an empty array;
`createRuntime()` itself still constructs without throwing and returns
a structurally-correct `AppRuntime` with every pre-existing field
present and functioning; and the new startup call inside
`createRuntime()` never causes an unhandled rejection, confirmed by
repeated construction under every mode combination.

## 11. Structural comparison with `reachCryptoLoaderFacade()`

This is not the first time `createRuntime()`'s own supporting code has
called into a deeper layer purely to confirm reachability, discarding
the result. `createRuntimeInitializeCryptoResult()` (Stage 697,
Prototype Phase 002) calls `reachCryptoLoaderFacade()`, which itself
calls `createCryptoLoaderFacade()` and discards its return value — the
Facade's own result is never inspected, and the function's own fixed
`{ allowed: false, initialized: false, reason: "PrototypeDisabled" }`
return value is completely unaffected by what the Facade actually
returns. Alpha 055's own `void runtimeIdentity.describeIdentity().catch(() => {})`
follows the identical shape one layer over: reach a real, already-built
subsystem, confirm the call itself does not throw, and let the result
evaporate. Both patterns exist to prove a connection is CALLABLE
without yet building anything that DEPENDS on what it returns — the
same "reach one link deeper, keep your own answer" discipline this
repository has used throughout its own `fedos_*.ts` `PlanningOnly`
chain.

## 12. Why this Stage does not add a Runtime-level log or diagnostic for the call's own outcome

A tempting middle ground between "call and discard" and "build a real
feature" would be recording whether the call succeeded or what it
returned, for diagnostic purposes. This Arc deliberately does not do
that either — a diagnostic surface is still a NEW piece of Runtime
behavior with its own design questions (where does it live, who reads
it, does it leak identity presence/absence information anywhere
sensitive) that this Arc's own narrow mandate does not authorize
answering. `runtimeCapabilities()` (Alpha 003) already exists as this
repository's own reviewed home for Runtime diagnostic surfaces, should
a future Stage want to add an Identity Runtime diagnostic there — this
Arc does not touch that file and does not anticipate what such a
diagnostic would look like.

## 13. Summary

This Arc's own net effect on `src/`: one header-comment update in
`fedos_runtime_identity.ts` (zero functional lines changed), and one
two-line construction block in `create_runtime.ts` changed from a bare
`void` statement into an actual, discarded, rejection-swallowed method
call. `describeIdentity()`, `findIdentity()`, and `listIdentities()`
were already correct, per Alpha 053/054's own specification, before
this Arc began — this Arc's own value is confirming that fact formally,
with its own dedicated tests, and adding the ONE genuinely new piece of
behavior this Arc's own mandate authorized: the Runtime now actually
calls into the Identity Layer it has held internally since Alpha 051,
for the first time, entirely within its own synchronous startup path,
with the result going nowhere.

## 14. See also

- `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
- `docs/secure_runtime_alpha_041_fedos_identity_registry.md`
- `docs/secure_runtime_alpha_042_fedos_identity_service_registry_integration.md`
- `docs/secure_runtime_alpha_043_fedos_identity_resolver.md`
