# Secure Runtime Alpha 132 — Refresh Delegation

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind — no `src/` file is modified. This is Stage 2 of the
Alpha 131–135 Desktop Public Identity Refresh Arc, following Alpha
131's own `refreshPublicIdentity()` addition.**

## 1. Why now

Alpha 131 added `refreshPublicIdentity()` as a one-line delegation to
`readPublicIdentity()`. Before building further on it, this Stage
formally confirms — grounded in the actual, current source — that this
delegation is EXCLUSIVE: `refreshPublicIdentity()` calls
`readPublicIdentity()` and nothing else, directly or transitively,
mirroring Alpha 122's own reference-tracing discipline for the
Factory/Reader relationship.

## 2. What was reviewed

The full, current body of `refreshPublicIdentity()` was inspected:

```ts
refreshPublicIdentity(): Promise<FedosIdentityDescriptor | null> {
  return this.readPublicIdentity();
}
```

- **Exactly one statement.** A single `return`, calling exactly one
  method: `this.readPublicIdentity()`.
- **No other method call appears anywhere in the body** — not
  `this.#reader.readPublicIdentity()` directly, not
  `this.currentPublicIdentity()`, not `this.bootstrap()`/`this.start()`,
  not any `#identity` method, not any field access of any kind.
- **`readPublicIdentity()`'s own body** (Alpha 121/127, unchanged by
  Alpha 131) is itself traced: `await this.#reader.readPublicIdentity();`
  then `this.#currentPublicIdentity = result;` then `return result;` —
  three statements, touching `#reader` and `#currentPublicIdentity`
  only, never `#identity`.

Tracing the full call chain: `refreshPublicIdentity()` →
`readPublicIdentity()` → `#reader.readPublicIdentity()` (read) →
`#currentPublicIdentity` (write, on success). No branch of this chain
reaches `#identity`, `bootstrap()`, `start()`, or any Identity Runtime
concept.

## 3. Decision

**`refreshPublicIdentity()` calls `readPublicIdentity()` and NOTHING
ELSE — confirmed by reference, not merely by behavior. There is no
second, hidden path by which `refreshPublicIdentity()` could reach
`#reader`, `#identity`, or any other field directly; the ONLY route
from `refreshPublicIdentity()` to any observable effect is through
`readPublicIdentity()`'s own, already-verified (Alpha 121/127) body.**

## 4. What this Stage does NOT do

- Does **not** modify `desktop_application.ts` or any other `src/`
  file.
- Does **not** change `readPublicIdentity()`'s or
  `refreshPublicIdentity()`'s own behavior in any way.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, `src/identity/*`,
  Storage, Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_122_factory_verification.md`
- `docs/secure_runtime_alpha_131_desktop_refresh_api.md`
