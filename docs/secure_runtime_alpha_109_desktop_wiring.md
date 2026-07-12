# Secure Runtime Alpha 109 — Desktop Wiring

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/create_desktop_application.ts`, and nothing else. This is
Stage 4 of the Alpha 106–110 Nostr Public Identity Implementation
Arc.**

## 1. Why now

Alpha 107 gave `DesktopApplication` a place to hold a public identity
configuration, unread by anything. Alpha 108 shipped
`StaticNostrPublicIdentitySource`, unwired into anything. This Stage
connects them: `createDesktopApplication()` gains an optional
`publicIdentity` parameter and, when supplied, actually constructs a
`StaticNostrPublicIdentitySource` from it — completing the chain this
whole Arc exists to build.

## 2. What changed, recorded precisely

```ts
export function createDesktopApplication(
  publicIdentity?: FedosNostrPublicIdentitySnapshot,
): DesktopApplication {
  const source = publicIdentity
    ? new StaticNostrPublicIdentitySource(publicIdentity)
    : resolveNostrPublicIdentitySource();
  const reader = new NostrPublicIdentityReader(source);
  return new DesktopApplication(reader, publicIdentity);
}
```

- `publicIdentity` is a new, OPTIONAL parameter.
- When supplied: `source` is a `StaticNostrPublicIdentitySource`
  wrapping it (Alpha 108).
- When omitted (the default, no-argument call): `source` resolves
  through `resolveNostrPublicIdentitySource()` exactly as Alpha 103
  left it — completely unchanged behavior for every existing call
  site.
- Either way, `source` is wrapped in a `NostrPublicIdentityReader`
  (Alpha 103) exactly as before, and BOTH the resulting `reader` and
  the original `publicIdentity` value are passed into
  `new DesktopApplication(reader, publicIdentity)` — `DesktopApplication`'s
  own `#publicIdentity` field (Alpha 107) now actually receives the
  SAME configuration value the Reader was built from, rather than
  always defaulting to `undefined`.

## 3. Default configuration behavior confirmed unchanged

`createDesktopApplication()` called with NO argument — every existing
call site across Alpha 096–108's own test suites — continues to
resolve through `resolveNostrPublicIdentitySource()`, which is STILL
fixed to `NullNostrPublicIdentitySource` (Alpha 048, unchanged by this
Arc). The default configuration's own observable behavior — the
Reader resolves `null` — is completely unaffected by this Stage.

## 4. What this Stage does NOT do

- Does **not** modify `src/desktop/desktop_application.ts`,
  `fedos_public_identity_reader.ts`, `nostr_public_identity_reader.ts`,
  or `static_nostr_public_identity_source.ts`.
- Does **not** validate, normalize, or transform `publicIdentity` in
  any way — passed to `StaticNostrPublicIdentitySource`'s own
  constructor verbatim.
- Does **not** call `bootstrap()`, `start()`, or `readPublicIdentity()`
  on anything it constructs.
- Does **not** modify any `src/identity/*` file.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, WebSocket connections,
  NIP logic, event retrieval, signing, or DM handling of any kind.

## 5. See also

- `docs/secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver.md`
- `docs/secure_runtime_alpha_103_source_injection.md`
- `docs/secure_runtime_alpha_107_desktop_public_identity_configuration.md`
- `docs/secure_runtime_alpha_108_static_public_identity_source.md`
