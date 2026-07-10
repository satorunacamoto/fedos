# Secure Runtime Alpha 058 — Identity Bootstrap Boundary

## 1. Why now

Alpha 057 removed `create_runtime.ts`'s own automatic, fire-and-forget
`describeIdentity()` call, implementing the Alpha 056 Decision (Option
B) exactly: `createRuntime()` is Construct Only again, and identity
retrieval was left entirely deferred to "a future, explicit,
separately-reviewed API or Bootstrap boundary"
(`docs/secure_runtime_alpha_056_identity_bootstrap_semantics_review.md`
§6/§8). This Stage builds that boundary — and ONLY that boundary. It
does not wire anything to call it, and it does not expose it to
anything outside `FedosRuntimeIdentity` itself.

## 2. The exact change

One method is added to `FedosRuntimeIdentity`
(`src/runtime/fedos_runtime_identity.ts`):

```ts
async bootstrapIdentity(): Promise<void> {
  await this.#service.describeIdentity();
}
```

`describeIdentity()`, `findIdentity()`, and `listIdentities()` are
untouched — the same three pure pass-throughs Alpha 050/053/054
shipped, byte-for-byte. `bootstrapIdentity()` is a fourth, independent
method: it calls the internally-held `FedosIdentityService`'s own
`describeIdentity()` exactly once, `await`s it, and returns nothing —
the resolved `FedosIdentityDescriptor | null` is discarded entirely,
matching this Stage's own literal specification ("実装は
`await this.#service.describeIdentity();` のみ。戻り値は返さない。").

No other file is touched. `create_runtime.ts` is not modified in any
way, and nothing calls `bootstrapIdentity()` from anywhere in this
repository — it exists, compiles, and is directly testable, but is
presently unreachable from any Public Runtime API or from
`createRuntime()`'s own construction path.

## 3. Why a Bootstrap boundary is added at all

Alpha 056's own review (§4, Option C) identified "an internal, explicit
`bootstrapIdentity()`, not auto-called" as a reasonable longer-term
shape, explicitly not foreclosed by adopting Option B — Alpha 057's own
`docs/secure_runtime_alpha_057_identity_bootstrap_removal.md` §5 named
it as one of the designs "a future, separately-reviewed Stage" remained
free to choose. This Stage makes that choice concrete: a real,
callable, focused entry point for "run the Identity Bootstrap sequence"
exists now, separate from `describeIdentity()`'s own role as a plain
read. Building the boundary now, ahead of any caller, lets its own
shape (name, return type, error behavior) be reviewed on its own terms
— exactly as this Stage does — rather than being invented ad hoc
inside whatever file eventually needs it.

## 4. Why `createRuntime()` still does not call it

Calling `bootstrapIdentity()` from `createRuntime()` would exactly
recreate the Alpha 055 shape Alpha 056 reviewed and Alpha 057 removed
— an automatic, construction-time async call with all the same
concerns already documented (non-deterministic call-order, an
unawaited `Promise` no caller can observe, `src/worker.ts`'s own
`createRuntime(env)` call on every incoming request making that call
repeat once per request). Building the boundary and wiring it are two
separate decisions; this Stage deliberately makes only the first.
`create_runtime.ts` is unmodified by this Stage — a repository-wide
`git diff` confirms it — and `bootstrapIdentity()` is called by
nothing, anywhere, as of this Stage's own commit.

## 5. Responsibility split from `describeIdentity()`

`describeIdentity()` answers "what is the current Identity Descriptor,
right now" — a plain, repeatable read a caller can invoke as often as
it likes, whose result it directly receives and can act on.
`bootstrapIdentity()` answers a narrower question: "has the Identity
Bootstrap sequence run at least once" — its own caller does not receive
the Descriptor at all, only the fact that the underlying
`describeIdentity()` call completed (or threw). This mirrors an
ordinary initialization/read split: a caller that only cares whether
startup work has happened does not need, and should not be forced to
handle, the same return value a caller that actually wants the data
would use. `bootstrapIdentity()` does not replace `describeIdentity()`
for any caller that wants the Descriptor itself — it exists
specifically for a caller that only wants the SIDE EFFECT (today: none
observable, since the Null Source always resolves `null` and no
Registry write follows; in the future: whatever real Registry
registration a real Source's Descriptor would trigger).

## 6. Why Registry registration is delegated entirely to `FedosIdentityService`

`bootstrapIdentity()` performs no Registry read or write of its own —
it does not call `this.#registry` at all, and does not inspect the
Descriptor `describeIdentity()` resolves. This is a direct continuation
of `FedosIdentityService`'s own existing design (Alpha 042): the
Service alone decides whether a resolved Descriptor is eligible for
registration, and alone owns the call into
`FedosIdentityRegistry.register()`. Duplicating any part of that
decision inside `FedosRuntimeIdentity` would create two places that
could disagree about when a Descriptor becomes a Record — exactly the
kind of split responsibility `FedosRuntimeIdentity`'s own "assembly,
not behavior" role (see `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
§4) has never taken on. `bootstrapIdentity()` stays a thin trigger; the
Service remains the single owner of registration policy, today and for
any future Source.

## 7. Why a rejection is not swallowed

Alpha 055's removed call wrapped its `describeIdentity()` invocation in
`.catch(() => {})` specifically because NO caller held a reference to
its `Promise` — the call happened deep inside a synchronous function
with no way to surface an error to anyone, so swallowing it was the
only option that did not risk an unhandled rejection.
`bootstrapIdentity()` is different by construction: it returns its own
`Promise<void>`, so whatever calls it (a future Stage, once one exists)
holds that `Promise` and can `await`/`.catch()`/`.then()` it directly.
Swallowing the rejection here, inside `FedosRuntimeIdentity` itself,
would take that choice away from every future caller before any of
them exist — exactly the Fail-Closed/Observability confusion Alpha 056
§5 (review question 3) already identified as a defect, not a feature,
of the removed design. `bootstrapIdentity()` therefore lets any
rejection from `describeIdentity()` propagate unmodified.

## 8. Future Desktop caller

A Desktop application shell is the caller this boundary is shaped for:
Alpha 056 §5 (review question 8) already concluded that a Desktop
shell — not `createRuntime()` — is the party positioned to know WHEN
identity information is actually needed (e.g., only once a profile
view opens) and the only party able to meaningfully react to a
failure. `bootstrapIdentity()`'s own `Promise<void>` return shape is
exactly what such a caller would want: enough to `await` and react to
success/failure, without being handed a Descriptor it may not need at
that moment (it can still call `describeIdentity()` separately for
that). No Desktop-side code is added by this Stage — this is a shape
decision only, made ahead of any real caller existing.

## 9. Why Worker will not call it

`src/worker.ts`'s own `fetch()` handler calls `createRuntime(env)` once
per incoming HTTP request (confirmed by Alpha 056 §3). Any call from
inside that per-request path — whether the removed Alpha 055 call or a
future call to `bootstrapIdentity()` — would repeat the same
Bootstrap work on every request, the exact duplicate-Bootstrap risk
Alpha 056 §3/§4 identified as a concrete, not merely hypothetical,
cost once a real Source performs network or Storage I/O. A Worker
request handler has no natural place to hold a long-lived, ONE-TIME
Bootstrap outcome across requests the way a long-running Desktop
process can — so wiring `bootstrapIdentity()` into the Worker's own
per-request path would reintroduce exactly the problem Alpha 057 just
fixed. This Stage does not modify `src/worker.ts` in any way, and does
not anticipate a future Stage wiring it there.

## 10. What this Stage does NOT do

- Does **not** modify `create_runtime.ts` — `createRuntime()` remains
  Construct Only, exactly as Alpha 057 left it.
- Does **not** call `bootstrapIdentity()` from anywhere — not from
  `create_runtime.ts`, not from anywhere else in this repository.
- Does **not** modify `describeIdentity()`, `findIdentity()`, or
  `listIdentities()` — all three remain byte-for-byte unchanged.
- Does **not** modify `AppRuntime` (`types.ts`) or add any Public
  Runtime API — `bootstrapIdentity()` is reachable only by directly
  constructing a `FedosRuntimeIdentity`, which remains something only
  `create_runtime.ts` does in this repository.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any `src/storage/*` or Crypto Public Runtime API
  file.
- Does **not** modify `FedosIdentityProvider`, `FedosIdentityRegistry`,
  `FedosIdentityResolver`, `FedosIdentityDescriptor`,
  `FedosIdentityRecord`, `FedosNostrPublicIdentitySource`,
  `fedos_nostr_public_identity_source_resolver.ts`, or
  `fedos_identity_provider_resolver.ts`.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Implements **no** retry, timeout, caching, or state-tracking logic of
  any kind inside `bootstrapIdentity()`.

## 11. Summary

This Stage's own net effect on `src/` is one new method,
`bootstrapIdentity(): Promise<void>`, added to `FedosRuntimeIdentity`
— a one-line delegation to the already-existing
`FedosIdentityService.describeIdentity()`, discarding the result,
propagating any rejection unmodified, and performing no Registry
access of its own. `describeIdentity()`/`findIdentity()`/
`listIdentities()` stay exactly as Alpha 050/053/054 left them.
`create_runtime.ts` is untouched, and nothing anywhere calls
`bootstrapIdentity()` yet — the boundary exists, reviewed and tested on
its own terms, ready for a future, separately-reviewed Stage (a
Desktop-facing caller, most plausibly) to wire it in.

## 12. See also

- `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
- `docs/secure_runtime_alpha_053_055_identity_runtime_internal_operations.md`
- `docs/secure_runtime_alpha_056_identity_bootstrap_semantics_review.md`
- `docs/secure_runtime_alpha_057_identity_bootstrap_removal.md`
