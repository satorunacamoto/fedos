# Secure Runtime Alpha 098 — Ready State

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/desktop_application.ts`, and nothing else. This is Stage
3 of the Desktop Shell Foundation Arc (Alpha 096–100).**

## 1. Why now

Alpha 097 wired `start()` to `return this.bootstrap();` — a pure
delegation with no guard of its own. Calling `start()` twice was a
safe no-op, but ONLY because `bootstrapIdentity()`'s own Alpha 061
idempotency guarantee happened to absorb it — `DesktopApplication`
itself had no opinion on whether its OWN `start()` should ever be
called more than once. This Stage gives it one: a dedicated,
Desktop-level guard, independent of Identity's own idempotency.

## 2. What changed, recorded precisely

A new private field, `#started: boolean` (initial `false`), and a
rewritten `start()` body:

```ts
#started: boolean = false;

async start(): Promise<void> {
  if (this.#started) {
    throw new Error("DesktopApplication.start() was already called.");
  }
  await this.bootstrap();
  this.#started = true;
}
```

This is the ONLY change this Stage makes. The constructor and
`bootstrap()` remain byte-for-byte unchanged from Alpha 096/097.

## 3. Why THROW, not silently no-op

`FedosRuntimeIdentity`'s own `bootstrapIdentity()` (Alpha 061) is
DELIBERATELY idempotent — a repeat call is a safe, silent no-op,
because Identity Bootstrap genuinely has nothing more to do the second
time. `DesktopApplication.start()` is a DIFFERENT kind of operation: it
represents Desktop's own startup SEQUENCE, not merely a single
idempotent read. A second `start()` call signals a caller-side bug —
Desktop's own startup logic being invoked twice — which, in a future
Stage, might also need to re-run window creation, process setup, or
other NOT-YET-idempotent Desktop-level work this class does not
currently perform. Throwing surfaces that bug immediately and loudly,
rather than silently tolerating it the way `bootstrapIdentity()`
itself correctly tolerates its OWN, narrower repeat-call case.
`bootstrap()` itself remains completely ungated by `#started` and may
still be called directly, any number of times, relying entirely on
`FedosRuntimeIdentity`'s own idempotency — this Stage adds a guard to
`start()` specifically, not to `bootstrap()`.

## 4. Consistency with the Desktop Design (Alpha 086–095)

- **Alpha 092 (Bootstrap Sequence) Invariant 1** ("Bootstrap is never
  called more than once per instance"): reinforced, not merely
  preserved — `#started` now actively PREVENTS a second `start()`
  call's own attempt to re-run the sequence, on top of
  `bootstrapIdentity()`'s own pre-existing idempotency.
- **Alpha 094 (Lifetime):** `#started` is NOT a destruction or reset
  mechanism — it never returns to `false` once set, and no method on
  this class ever clears it. It records ONLY whether the startup
  sequence has run, consistent with the permanently-forbidden
  `dispose()`/`destroy()`/`close()`/`shutdown()` list Alpha 094 already
  fixed — `#started` adds no such method.

## 5. What this Stage does NOT do

- Does **not** add a public reader for `#started` (no
  `isStarted()`/`started` getter) — nothing in this Arc's own scope
  requires one yet.
- Does **not** add `createDesktopApplication()` or any other factory —
  that remains Alpha 099's own deliverable.
- Does **not** implement any GUI, Nostr, Relay, or Observation
  construct of any kind.
- Does **not** modify `src/runtime/create_runtime.ts`, `types.ts`,
  `src/worker.ts`, any `src/identity/*` file, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts` in any
  way, and does NOT change `bootstrapIdentity()`'s own idempotency
  behavior — `bootstrap()` remains ungated, relying entirely on it.

## 6. See also

- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_092_bootstrap_sequence_review.md`
- `docs/secure_runtime_alpha_094_lifetime_review.md`
- `docs/secure_runtime_alpha_096_desktop_shell_skeleton.md`
- `docs/secure_runtime_alpha_097_bootstrap_wiring.md`
