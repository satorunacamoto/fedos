# Secure Runtime Alpha 128 — Desktop Public Identity Reader

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/desktop_application.ts`, and nothing else. This is Stage
3 of the Alpha 126–130 Desktop Public Identity State Arc, following
Alpha 127's own persistence wiring.**

## 1. Why now

Alpha 127 made `readPublicIdentity()` persist its own resolved value
into `#currentPublicIdentity`, but nothing on the class could read
that stored value back without re-invoking the Reader. This Stage adds
the public, synchronous counterpart — mirroring exactly how
`currentIdentity()` (Alpha 116) reads `#identity`'s own stored value
without re-invoking Bootstrap.

## 2. What was implemented

```ts
currentPublicIdentity(): FedosIdentityDescriptor | null {
  return this.#currentPublicIdentity;
}
```

- A new public method, `currentPublicIdentity()`.
- Its own ENTIRE body is a single `return` statement, reading
  `#currentPublicIdentity` directly.
- **Synchronous** — no `async`, no `Promise`, unlike
  `readPublicIdentity()`.
- **Never throws** — a plain field read of a private field that always
  holds either `null` or a `FedosIdentityDescriptor` cannot raise.

## 3. Purity confirmed

- **Synchronous:** the method signature carries no `async` keyword and
  returns `FedosIdentityDescriptor | null` directly, not wrapped in a
  `Promise`.
- **Never throws:** confirmed structurally — the body contains no
  `throw`, no function call that could itself throw, only a bare field
  read.
- **No access to `#identity`, `#reader`, `#publicIdentity`, or
  `#started`:** confirmed directly against the method's own one-line
  body.

## 4. What this Stage does NOT do

- Does **not** modify `readPublicIdentity()`, `currentIdentity()`,
  `isBootstrapped()`, `bootstrap()`, or `start()` in any way.
- Does **not** add any transformation, caching, or derived value —
  `currentPublicIdentity()` reads `#currentPublicIdentity` fresh on
  every call, though the field itself only changes when
  `readPublicIdentity()` writes it (Alpha 127).
- Does **not** modify `create_desktop_application.ts`,
  `fedos_public_identity_reader.ts`, `nostr_public_identity_reader.ts`,
  or `static_nostr_public_identity_source.ts`.
- Does **not** modify any `src/identity/*` file.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage,
  Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_116_desktop_identity_access.md`
- `docs/secure_runtime_alpha_126_desktop_public_identity_state.md`
- `docs/secure_runtime_alpha_127_reader_result_persistence.md`
