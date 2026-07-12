# Secure Runtime Alpha 097 — Bootstrap Wiring

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/desktop_application.ts`, and nothing else. This is Stage
2 of the Desktop Shell Foundation Arc (Alpha 096–100).**

## 1. Why now

Alpha 096 shipped `DesktopApplication` with `start()` intentionally
empty. This Stage wires it: `start()`'s own entire body becomes a pure
delegation to `bootstrap()`, matching the exact `construct →
bootstrapIdentity() → ready` sequence Alpha 092 already fixed.

## 2. What changed, recorded precisely

`start()`'s own body changes from empty to:

```ts
async start(): Promise<void> {
  return this.bootstrap();
}
```

This is the ONLY change this Stage makes. The constructor and
`bootstrap()` are byte-for-byte unchanged from Alpha 096.

## 3. Consistency with Alpha 092's own Bootstrap Sequence Decision

- **construct:** already performed by the constructor (Alpha 096,
  unchanged).
- **`bootstrapIdentity()`:** reached via `start()` → `bootstrap()` →
  `this.#identity.bootstrapIdentity()` — three delegating layers, each
  a pure one-line pass-through, matching the SAME single-caller
  discipline `FedosRuntimeIdentity`'s own internal chain
  (`#bootstrapIdentity()` → `#performBootstrap()` →
  `#acquireDescriptor()` → `#describeIdentity()`) already established.
- **ready:** as of this Stage, "ready" is simply the moment `start()`'s
  own `Promise` resolves — no separate state flag exists yet; Alpha
  098 adds that.
- **Invariant 1 (never called more than once):** unaffected —
  `bootstrapIdentity()`'s own Alpha 061 idempotency guarantee, inherited
  unchanged through every delegating layer, still makes a second call
  a safe no-op.
- **Invariant 2 (never swapped mid-sequence):** unaffected — `#identity`
  remains `readonly`, assigned exactly once, in the constructor.
- **Invariant 3 (never called later than Runtime generation):** this
  Stage does not call, reference, or otherwise interact with
  `createRuntime()` in any way — the ordering invariant remains a
  caller-side discipline, unenforced (and, per Alpha 089, permanently
  unenforceable from inside this class) by `DesktopApplication` itself.

## 4. What this Stage does NOT do

- Does **not** add a `#started` field or any double-start guard — that
  remains Alpha 098's own deliverable; calling `start()` twice today
  is a safe no-op purely because `bootstrapIdentity()` itself is
  idempotent, not because `DesktopApplication` guards against it.
- Does **not** add `createDesktopApplication()` or any other factory.
- Does **not** implement any GUI, Nostr, Relay, or Observation
  construct of any kind.
- Does **not** modify `src/runtime/create_runtime.ts`, `types.ts`,
  `src/worker.ts`, any `src/identity/*` file, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts` in any
  way.

## 5. See also

- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_092_bootstrap_sequence_review.md`
- `docs/secure_runtime_alpha_096_desktop_shell_skeleton.md`
