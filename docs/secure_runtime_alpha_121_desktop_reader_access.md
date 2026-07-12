# Secure Runtime Alpha 121 — Desktop Reader Access

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/desktop_application.ts`, and nothing else. This is Stage
1 of the Alpha 121–125 Desktop Public Identity Reader Arc, following
the completed Desktop Identity Consumption Arc (Alpha 116–120), which
closed with Desktop consuming `FedosRuntimeIdentity` through exactly
four public methods.**

## 1. Why now

`DesktopApplication` has held a `FedosPublicIdentityReader` (`#reader`)
since Alpha 103, but no method on the class has ever read it — every
Stage since has deliberately left `#reader` untouched, in order to
keep the Reader path and the Bootstrap/Authority path structurally
independent (Alpha 110, Alpha 118). This Stage gives Desktop its first
read access to the Reader it already owns, mirroring exactly how Alpha
116 gave Desktop its first read access to `#identity`.

## 2. What was implemented

```ts
readPublicIdentity(): Promise<FedosIdentityDescriptor | null> {
  return this.#reader.readPublicIdentity();
}
```

- A new public method, `readPublicIdentity()`.
- Its own ENTIRE body is a single `return` statement, delegating
  directly to `this.#reader.readPublicIdentity()` — the Reader
  interface's own existing, unchanged method (Alpha 101).
- No processing, no transformation, no caching of any kind.
- **No connection to Identity Runtime of any kind**: this method never
  references `#identity`, `#publicIdentity`, or `#started`.

## 3. Purity confirmed

- **No processing:** the return value is passed through completely
  unmodified — the same `Promise` `FedosPublicIdentityReader.readPublicIdentity()`
  itself returns.
- **No caching:** no field on `DesktopApplication` stores a prior
  result; every call re-invokes `#reader` fresh.
- **No Identity Runtime access:** confirmed directly against the
  method's own one-line body — `#identity` is not referenced.
  `readPublicIdentity()` is the sole read boundary for `#reader`,
  symmetrically opposite `currentIdentity()`/`isBootstrapped()`
  (Alpha 116/117), which are the sole read boundary for `#identity`.

## 4. What this Stage does NOT do

- Does **not** modify `currentIdentity()`, `isBootstrapped()`,
  `#identity`'s own construction, `bootstrap()`, or `start()` in any
  way.
- Does **not** add any Desktop-level caching, transformation, or
  derived state.
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

- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
- `docs/secure_runtime_alpha_103_source_injection.md`
- `docs/secure_runtime_alpha_116_desktop_identity_access.md`
