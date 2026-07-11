# Secure Runtime Alpha 078 — Identity Bootstrap Observation Ordering Review

**Status: this Stage is a REVIEW / FORMAL CONFIRMATION only. It makes
NO functional code change — it adds a single header-comment paragraph
to `fedos_runtime_identity.ts` recording the Ordering guarantee, and
nothing else. Every property this Stage fixes was already true of the
actual source; nothing here alters behavior.**

## 1. Why now

Alpha 076 added `#observeBootstrap()` as a named Bootstrap observation
Boundary. Alpha 077 fixed the Contract that Hook must obey — a pure,
synchronous, never-throwing observer limited to Metrics, Tracing,
Audit, Logging, and Telemetry. Neither Stage formally fixed WHEN, in
the Bootstrap call chain, that Hook runs relative to the State Writer.
This Stage closes that gap: it reads the actual call chain directly
from the source and fixes, as a permanent guarantee, that
`#observeBootstrap()` always runs strictly BEFORE `#completeBootstrap()`
— so any future observer can rely on seeing pre-write state, never
post-write state, and no future Stage may silently reorder the chain
to change that.

## 2. What changed, recorded precisely

`src/runtime/fedos_runtime_identity.ts` is the ONLY file this Stage
touches, and the ONLY change is a new header-comment paragraph. No
method body changed, and no call site moved. The chain this Stage
reviews and fixes, read directly from `#bootstrapIdentity()`'s own
body:

```ts
async #bootstrapIdentity(): Promise<void> {
  if (this.#isBootstrapped()) {
    return;
  }
  const descriptor = await this.#performBootstrap();
  this.#observeBootstrap(descriptor);
  this.#completeBootstrap(descriptor);
}
```

## 3. The Bootstrap Flow order, confirmed from the actual source

Tracing every call site in `fedos_runtime_identity.ts`, the full chain
is:

```
#bootstrapIdentity()
  → #performBootstrap()
    → #acquireDescriptor()
      → #describeIdentity()
  → #observeBootstrap()
  → #completeBootstrap()
```

`#describeIdentity()`'s own `await` resolves (or rejects) before
control returns to `#bootstrapIdentity()`'s own body, where the two
final statements execute strictly in program order:
`this.#observeBootstrap(descriptor);` then
`this.#completeBootstrap(descriptor);` — JavaScript's own
single-threaded, run-to-completion execution model guarantees no
interleaving between them.

## 4. Confirmed properties

- **`#observeBootstrap()` is ALWAYS called strictly BEFORE
  `#completeBootstrap()`** — never after, never concurrently. This is
  a textual, line-order fact in `#bootstrapIdentity()`'s own body, not
  a race that depends on timing.
- **At the moment `#observeBootstrap()` runs, `#descriptor` has NOT
  yet been updated with the current attempt's result.** The only
  statement that ever writes `#descriptor` is inside
  `#completeBootstrap()`, which has not yet been called.
- **At the moment `#observeBootstrap()` runs, `#bootstrapped` is still
  `false`.** The guard's own check
  (`if (this.#isBootstrapped()) { return; }`) already confirmed this
  at the top of the method, and nothing between the guard and the
  `#observeBootstrap()` call can set it — `#completeBootstrap()` is
  the only place that ever does, and it has not yet been called.
- **`#completeBootstrap()` (Alpha 069) remains the ONLY place in this
  file that ever performs a state update** — confirmed unaffected by
  this Stage.
- **The Observation Hook observes ONLY pre-write state, never
  post-write state.** `#observeBootstrap()` receives the SAME
  `descriptor` local `#completeBootstrap()` is about to write, but at
  the moment it runs, that value has not yet been committed to
  `#descriptor`, and `#bootstrapped` has not yet flipped to `true`.

## 5. Future guarantee

Regardless of what a future Stage implements inside
`#observeBootstrap()` — Logging, Tracing, Audit, Metrics, or
Telemetry, per the Alpha 077 Contract — the WRITE ORDER this Stage
confirms must never change:
`#observeBootstrap()` before `#completeBootstrap()`, always. A future
implementation may read `descriptor` (its own parameter) freely, since
that value is already fully resolved by the time
`#observeBootstrap()` runs; it must never be moved to run after
`#completeBootstrap()`, and must never itself become the trigger for a
state update — state updates remain `#completeBootstrap()`'s own,
permanent, exclusive responsibility.

## 6. What this Stage does NOT do

- Does **not** change `#observeBootstrap()`'s own body — it remains
  the empty implementation Alpha 076 left it.
- Does **not** change `#bootstrapIdentity()`'s own body, its own
  statement order, or any call site.
- Does **not** implement any Metrics/Tracing/Audit/Logging/Telemetry
  behavior.
- Does **not** add any new public API.
- Does **not** add any new private field.
- Does **not** modify `src/runtime/create_runtime.ts`.
- Does **not** modify `src/runtime/types.ts` or any `AppRuntime`
  field.
- Does **not** modify any `src/identity/*` file (Provider, Registry,
  Resolver, Service, Descriptor, or Record).
- Does **not** modify `src/worker.ts`.
- Does **not** modify any Storage file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.

## 7. Summary

This Stage is a formal review, not an implementation. It fixes, as a
permanent guarantee confirmed directly against the actual source, the
full Bootstrap call chain
(`#bootstrapIdentity()` → `#performBootstrap()` →
`#acquireDescriptor()` → `#describeIdentity()` →
`#observeBootstrap()` → `#completeBootstrap()`) and the ordering
property that follows from it: `#observeBootstrap()` always runs
strictly before `#completeBootstrap()`, observing only pre-write
state, and `#completeBootstrap()` alone ever performs a state update.
No future Observation implementation — Logging, Tracing, Audit,
Metrics, or Telemetry — may ever change this write order.

## 8. See also

- `docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md`
- `docs/secure_runtime_alpha_074_identity_bootstrap_flow_consolidation.md`
- `docs/secure_runtime_alpha_075_identity_descriptor_acquisition_consolidation.md`
- `docs/secure_runtime_alpha_076_identity_bootstrap_observation_boundary.md`
- `docs/secure_runtime_alpha_077_identity_bootstrap_observation_contract.md`
