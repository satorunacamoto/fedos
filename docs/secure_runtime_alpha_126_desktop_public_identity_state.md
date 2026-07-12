# Secure Runtime Alpha 126 — Desktop Public Identity State

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/desktop_application.ts`, and nothing else. This is Stage
1 of the Alpha 126–130 Desktop Public Identity State Arc, following
the completed Desktop Public Identity Reader Arc (Alpha 121–125),
which closed with `readPublicIdentity()` as Desktop's own read
boundary for the Reader path.**

## 1. Why now

`readPublicIdentity()` (Alpha 121) resolves a value, but
`DesktopApplication` itself never keeps it — every call re-invokes the
Reader fresh (Alpha 121's own no-caching guarantee), and nothing on
the class remembers the last resolved value. This Stage adds the
field that will hold it; wiring the actual persistence is Alpha 127's
own, separate deliverable.

## 2. What was implemented

```ts
#currentPublicIdentity: FedosIdentityDescriptor | null = null;
```

- A new private field, `#currentPublicIdentity`, typed
  `FedosIdentityDescriptor | null` — the SAME shape
  `readPublicIdentity()` itself resolves.
- Initial value `null`.
- No method reads or writes it yet. `readPublicIdentity()` remains
  byte-for-byte unchanged by this Stage.

## 3. Purity confirmed

- **No wiring:** `#currentPublicIdentity` is inert — no constructor
  statement, no method body anywhere in the class references it.
- **No initial-value computation:** the initializer is the literal
  `null`, not derived from `#reader`, `#identity`, or any other field.
- **Not `readonly`:** unlike `#identity`/`#reader`/`#publicIdentity`
  (all `readonly`, fixed at construction), `#currentPublicIdentity` is
  mutable — a deliberate signal that it is Desktop's own STATE, not
  configuration, matching Alpha 130's own three-layer structure
  (Runtime Identity / Public Identity Reader / Public Identity State).

## 4. What this Stage does NOT do

- Does **not** wire `readPublicIdentity()` to write
  `#currentPublicIdentity` — that is Alpha 127's own deliverable.
- Does **not** add a public reader method for
  `#currentPublicIdentity` — that is Alpha 128's own deliverable
  (`currentPublicIdentity()`).
- Does **not** modify `currentIdentity()`, `isBootstrapped()`,
  `bootstrap()`, `start()`, or `readPublicIdentity()` in any way.
- Does **not** connect this new field to `#identity`/Identity Runtime
  in any way.
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
- `docs/secure_runtime_alpha_121_desktop_reader_access.md`
