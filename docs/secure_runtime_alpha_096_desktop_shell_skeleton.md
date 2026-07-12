# Secure Runtime Alpha 096 — Desktop Shell Skeleton

**Status: this Stage IMPLEMENTS. It is the first real code Stage of
the Desktop Shell Foundation Arc (Alpha 096–100), following the
fully-completed, implementation-free Desktop Design (Alpha 086–095).
It adds exactly one new file, `src/desktop/desktop_application.ts`,
and nothing else — no other `src/` file is touched.**

## 1. Why now

Alpha 086 through Alpha 095 fixed, in exhaustive detail, every design
question a Desktop Shell's own Identity integration would ever raise —
Boundary, Ownership, Lifetime, Entry Point, Bootstrap Sequence — all
without writing a single line of Desktop code. This Stage begins
actually building the minimal shell those ten Decisions describe,
starting with the SKELETON only: a single class, holding a single
`FedosRuntimeIdentity` instance, exposing exactly the two public
methods (`bootstrap()`, `start()`) Alpha 096's own scope calls for —
nothing wired between them yet, no GUI, no Nostr, no Observation.

## 2. What was implemented

A new directory, `src/desktop/`, containing one new file,
`desktop_application.ts`, exporting one new class,
`DesktopApplication`:

```ts
export class DesktopApplication {
  readonly #identity: FedosRuntimeIdentity;

  constructor() {
    this.#identity = new FedosRuntimeIdentity();
  }

  async bootstrap(): Promise<void> {
    return this.#identity.bootstrapIdentity();
  }

  async start(): Promise<void> {
    // Intentionally empty -- Bootstrap Wiring (Alpha 097) not yet connected.
  }
}
```

- The constructor performs ONLY the synchronous construction Alpha
  091 designated as the correct entry point pattern — it does NOT call
  `bootstrapIdentity()` itself, consistent with Alpha 091's own
  rejection of an `async`-performing constructor.
- `bootstrap()` is a pure, one-line delegation to
  `this.#identity.bootstrapIdentity()` — no branching, no error
  handling, no state of its own.
- `start()` exists, as of this Stage, as an INTENTIONALLY EMPTY
  method — mirroring the SAME "add the method shape now, wire its own
  behavior in a later Stage" pattern `#observeBootstrap()` itself
  established at Alpha 076. Its own wiring to `bootstrap()` is Alpha
  097's own deliverable.

## 3. Consistency with the completed Desktop Design (Alpha 086–095)

- **Alpha 086 (Boundary):** `DesktopApplication`'s own constructor
  calls `new FedosRuntimeIdentity()` directly — no `createRuntime()`
  reference anywhere in this file.
- **Alpha 087 (Bootstrap Ownership):** exactly ONE `FedosRuntimeIdentity`
  instance is constructed, held as a `readonly` field — no second
  construction path exists anywhere in this file.
- **Alpha 091 (Entry Point):** the constructor performs no Bootstrap
  of its own; `bootstrap()` is a separate, explicitly-callable method,
  exactly as Alpha 091 required.
- **Alpha 093 (Ownership):** `#identity` is `readonly` and private —
  no other object anywhere in this file, or reachable from it, holds a
  second reference to the same instance.

## 4. What this Stage does NOT do

- Does **not** wire `start()` to call `bootstrap()` — `start()`'s own
  body remains empty, exactly as shown in §2, until Alpha 097.
- Does **not** add a `#started` field or any double-start guard — that
  is Alpha 098's own deliverable.
- Does **not** add `createDesktopApplication()` or any other factory
  — that is Alpha 099's own deliverable.
- Does **not** implement any GUI, window, or process-level construct
  of any kind.
- Does **not** implement any Nostr, Relay, or network connection of
  any kind.
- Does **not** implement, wire, or reference Observation
  (`#observeBootstrap()`) in any way.
- Does **not** modify `src/runtime/create_runtime.ts`, `types.ts`,
  `src/worker.ts`, any `src/identity/*` file, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts` in any
  way — `DesktopApplication` only calls its existing, unchanged public
  API.

## 5. See also

- `docs/secure_runtime_alpha_086_desktop_integration_boundary_review.md`
- `docs/secure_runtime_alpha_087_desktop_bootstrap_ownership_review.md`
- `docs/secure_runtime_alpha_091_desktop_entry_point_review.md`
- `docs/secure_runtime_alpha_092_bootstrap_sequence_review.md`
- `docs/secure_runtime_alpha_093_ownership_review.md`
- `docs/secure_runtime_alpha_095_integration_completion_review.md`
