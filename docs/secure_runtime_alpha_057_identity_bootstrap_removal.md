# Secure Runtime Alpha 057 — Identity Bootstrap Removal

## 1. Why now

`docs/secure_runtime_alpha_056_identity_bootstrap_semantics_review.md`
(Alpha 056) formally reviewed Alpha 055's own auto-fired,
fire-and-forget `describeIdentity()` Bootstrap call and adopted
**Option B** — remove the automatic Bootstrap entirely, deferring real
identity retrieval to a future, explicit, separately-reviewed API or
Bootstrap boundary — as this arc's own Decision. This Stage implements
that Decision, and ONLY that Decision. No new Bootstrap API, no new
identity-retrieval mechanism, and no Public Runtime API change of any
kind are introduced here; those all remain explicitly deferred, exactly
as Alpha 056 §7 ("What this Stage does NOT do") already required of any
Stage that would act on its Decision.

## 2. The exact change

One statement was removed from `src/runtime/create_runtime.ts`'s own
`createRuntime()`:

```ts
// REMOVED by this Stage:
void runtimeIdentity.describeIdentity().catch(() => {});
```

`createRuntime()`'s own construction block is now:

```ts
const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity();
void runtimeIdentity;
```

`FedosRuntimeIdentity` is still constructed exactly once per
`createRuntime()` call — Alpha 050-052's own connection between the
Identity Layer and the Runtime is entirely untouched. Only the Alpha
055 auto-invocation of `describeIdentity()` is gone. The bare
`void runtimeIdentity;` statement exists purely to acknowledge the
constant is intentionally unread within this function (the same shape
Alpha 051 originally shipped, before Alpha 055 ever added the
`describeIdentity()` call) — it performs no work and has no observable
effect of its own.

No other line of `createRuntime()`, and no other function in
`create_runtime.ts`, is touched by this Stage. The header comment block
above `createRuntime()` is updated to record this history (Alpha 055's
call now described in the past tense as REMOVED, Alpha 056's Decision
summarized, and this Stage's own removal recorded) — a documentation
change only, with zero effect on emitted code.

## 3. `createRuntime()` is Construct Only again

`createRuntime()`'s own body is, once again, exactly what Alpha 051
first established: thirty-plus synchronous `select*()`/resolution
calls, one `FedosRuntimeIdentity` construction held in a local constant,
and the `AppRuntime` object literal — no async call, no `Promise`, no
fire-and-forget expression, anywhere in the function. The one
fire-and-forget expression Alpha 056 §3 found to be the sole exception
to this file's own "pure, synchronous construction" rule is gone; a
fresh grep of `create_runtime.ts` for `void `/`.catch(` inside
`createRuntime()`'s own body now returns nothing.

## 4. The Identity Runtime is constructed but unused again

`FedosRuntimeIdentity` returns to exactly the state Alpha 050-052 first
placed it in: constructed once per `createRuntime()` call, held
entirely internally, never read, never awaited, never exposed on
`AppRuntime`. Its own three methods —
`describeIdentity()`/`findIdentity()`/`listIdentities()` (Alpha
053/054) — remain fully implemented and callable by anyone who
constructs a `FedosRuntimeIdentity` directly; this Stage does not
remove or alter any of them. What Alpha 055 added and this Stage
undoes is only the automatic invocation from inside `createRuntime()`
— the capability those methods provide is unaffected, only the
uninvited call to one of them is gone.

## 5. Identity retrieval lifecycle deferred to a future explicit Boundary

Per Alpha 056 §6/§8, this Stage does not introduce any replacement
mechanism — no `bootstrapIdentity()`, no `createRuntimeAsync()`, no
Bootstrap state model. When and how identity information is actually
retrieved is left entirely to a future, separately-reviewed Stage,
which remains free to choose Option C (an explicit, non-auto-called
Bootstrap method), Option D (an async Runtime construction contract),
or any other design that future Stage's own review finds warranted.
This Stage's own scope is exactly the one line Alpha 056 §8
recommended removing — nothing more.

## 6. What this Stage does NOT do

- Does **not** modify `src/runtime/fedos_runtime_identity.ts` —
  `FedosRuntimeIdentity`'s own three private fields, constructor, and
  three methods are all byte-for-byte unchanged.
- Does **not** modify any `src/identity/*` file (Source, Provider,
  Service, Registry, or Resolver).
- Does **not** modify `AppRuntime` (`src/runtime/types.ts`) or add any
  Public Runtime API — its own field set remains exactly the same
  thirty fields.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any other `src/runtime/fedos_runtime_*.ts` file.
- Does **not** modify any other line of `create_runtime.ts` beyond the
  one construction block and its own header comment.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Introduces **no** new Bootstrap API, no new identity-retrieval
  method, and no Bootstrap state model of any kind.

## 7. Summary

This Stage's own net effect on `src/` is the removal of ONE statement
(`void runtimeIdentity.describeIdentity().catch(() => {});`) and a
documentation-only update to `create_runtime.ts`'s own header comment.
`createRuntime()` is Construct Only again — every other line of its own
body, and every other file this arc has touched, is unaffected.
`FedosRuntimeIdentity` is constructed on every `createRuntime()` call,
exactly as Alpha 050-052 left it, and remains unused by
`createRuntime()` itself, exactly as Alpha 056's own adopted Decision
required.

## 8. See also

- `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
- `docs/secure_runtime_alpha_053_055_identity_runtime_internal_operations.md`
- `docs/secure_runtime_alpha_056_identity_bootstrap_semantics_review.md`
