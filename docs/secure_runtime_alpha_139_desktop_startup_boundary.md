# Secure Runtime Alpha 139 — Desktop Startup Boundary

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind — no `src/` file is modified. This is Stage 4 of the
Alpha 136–140 Desktop Startup Identity Sequence Arc, following Alpha
138's own Startup State Verification.**

## 1. Why now

Alpha 136–138 established WHAT `start()` now does (drive Bootstrap,
then Public Identity Refresh, updating both pieces of state). Before
Alpha 140's own closing Completion Declaration, this Stage formally
confirms WHAT IT DOES NOT DO — grounded in the actual, full call graph
reachable from `start()` — matching the five concepts the user's own
Objective names as forbidden for direct access: Provider, Registry,
Storage, Worker, Observation.

## 2. The full call graph from start(), traced

```
start()
  ├── bootstrap()              → this.#identity.bootstrapIdentity()
  └── refreshPublicIdentity()  → this.readPublicIdentity()
                                    → this.#reader.readPublicIdentity()
                                    → this.#currentPublicIdentity = result
```

Every symbol `start()` reaches, directly or transitively within
`DesktopApplication` itself: `bootstrap`, `#identity`,
`refreshPublicIdentity`, `readPublicIdentity`, `#reader`,
`#currentPublicIdentity`. Nothing else.

- **Runtime Identity** (`#identity`/`FedosRuntimeIdentity`) and
  **Reader** (`#reader`/`FedosPublicIdentityReader`) are the ONLY two
  Desktop-held objects `start()` reaches — exactly the two the
  Objective names as permitted.
- **Provider** (`FedosIdentityProvider`/`NostrIdentityProvider`): NOT
  imported or referenced anywhere in `desktop_application.ts`
  (confirmed structurally) — reachable only INSIDE
  `FedosRuntimeIdentity`'s own implementation, which `start()` never
  inspects or bypasses; `start()` touches Provider only as
  indirectly, opaquely, as `bootstrap()` already did before this Arc.
- **Registry** (`FedosIdentityRegistry`): same as Provider — a
  `src/identity/*` concept `DesktopApplication` has never imported,
  reachable only inside `#identity`'s own implementation.
- **Storage**: no `src/desktop/*` file imports a Storage module
  (confirmed by every prior Arc's own Regression tests, reconfirmed
  here against the current source).
- **Worker**: no `src/desktop/*` file imports `src/worker.ts` or
  references `AppRuntime` (confirmed since Alpha 096, reconfirmed
  here).
- **Observation**: no `src/desktop/*` file references the Observation
  Framework (Alpha 076–085) in any way (confirmed since Alpha 096,
  reconfirmed here).

## 3. Decision

**`start()` uses Runtime Identity and Reader ONLY — the same two
objects it already used before this Arc (via `bootstrap()`) and this
Arc added (via `refreshPublicIdentity()`). It does NOT directly touch
Provider, Registry, Storage, Worker, or Observation — confirmed by
tracing its own full call graph within `DesktopApplication` to exactly
two fields (`#identity`, `#reader`) and their own two downstream
writes (`#started`, `#currentPublicIdentity`). This restates, for
`start()` as a whole, the SAME boundary Alpha 118 already fixed for
Runtime Identity access and Alpha 134 already fixed for
`refreshPublicIdentity()` specifically — Alpha 136's own composition
of the two introduces no new access path.**

## 4. What this Stage does NOT do

- Does **not** modify `desktop_application.ts` or any other `src/`
  file.
- Does **not** modify `start()`'s or any other method's own behavior
  in any way.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, `src/identity/*`,
  Storage, Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_118_desktop_authority_consumption.md`
- `docs/secure_runtime_alpha_134_desktop_refresh_boundary.md`
- `docs/secure_runtime_alpha_136_startup_sequence.md`
