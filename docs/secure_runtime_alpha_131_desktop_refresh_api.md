# Secure Runtime Alpha 131 — Desktop Refresh API

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/desktop_application.ts`, and nothing else. This is Stage
1 of the Alpha 131–135 Desktop Public Identity Refresh Arc, following
the completed Desktop Public Identity State Arc (Alpha 126–130), which
closed with the three-layer structure (Runtime Identity / Public
Identity Reader / Public Identity State) complete.**

## 1. Why now

`readPublicIdentity()` (Alpha 121/127) already re-fetches and persists
on every call — there was never a caching problem to solve. What was
missing was a NAME: callers wanting to explicitly express "go fetch
the latest Public Identity now" had no dedicated entry point, only the
more general-sounding `readPublicIdentity()`. This Stage adds that
name, as a pure alias.

## 2. What was implemented

```ts
refreshPublicIdentity(): Promise<FedosIdentityDescriptor | null> {
  return this.readPublicIdentity();
}
```

- A new public method, `refreshPublicIdentity()`.
- Its own ENTIRE body is a single `return` statement, delegating
  directly to `this.readPublicIdentity()` — THIS class's own existing
  method (Alpha 121/127), not `this.#reader.readPublicIdentity()`
  directly.
- No processing of its own. No new behavior: everything
  `refreshPublicIdentity()` does, it does purely by virtue of what
  `readPublicIdentity()` itself already does.

## 3. Purity confirmed

- **No processing:** the return value is passed through completely
  unmodified — the same `Promise` `readPublicIdentity()` itself
  returns.
- **Calls `readPublicIdentity()` and nothing else:** confirmed
  directly against the method's own one-line body — no other method,
  field, or Reader/Provider access appears anywhere in it.
- **No Identity Runtime access:** `#identity` is not referenced
  anywhere in the new body, directly or transitively — the call chain
  is `refreshPublicIdentity()` → `readPublicIdentity()` → `#reader`,
  the SAME chain Alpha 121/127 already established.

## 4. What this Stage does NOT do

- Does **not** modify `readPublicIdentity()`, `currentPublicIdentity()`,
  `currentIdentity()`, `isBootstrapped()`, `bootstrap()`, or `start()`
  in any way.
- Does **not** add any new field, any new caching, or any new
  transformation.
- Does **not** call `this.#reader.readPublicIdentity()` directly —
  ALL Reader access continues to happen exclusively inside
  `readPublicIdentity()`'s own body.
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

- `docs/secure_runtime_alpha_121_desktop_reader_access.md`
- `docs/secure_runtime_alpha_127_reader_result_persistence.md`
