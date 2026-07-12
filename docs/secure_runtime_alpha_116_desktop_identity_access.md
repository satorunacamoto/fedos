# Secure Runtime Alpha 116 — Desktop Identity Access

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/desktop_application.ts`, and nothing else. This is Stage
1 of the Alpha 116–120 Desktop Identity Consumption Arc, following the
completed Identity Authority Design (Alpha 111–115), which fixed
`FedosRuntimeIdentity` as the sole Identity Authority.**

## 1. Why now

Alpha 111 named `FedosRuntimeIdentity` the sole Identity Authority.
Desktop has held one (`#identity`) since Alpha 096, but has never had
any way to READ its own current value — `bootstrap()`/`start()` only
ever WRITE to it. This Stage gives Desktop its first read access to
the Authority it already owns.

## 2. What was implemented

```ts
currentIdentity(): FedosIdentityDescriptor | null {
  return this.#identity.currentIdentity();
}
```

- A new public method, `currentIdentity()`.
- Its own ENTIRE body is a single `return` statement, delegating
  directly to `this.#identity.currentIdentity()` — the Identity
  Authority's own existing, unchanged public method (Alpha 073).
- No processing, no transformation, no caching of any kind. Each call
  reads `#identity`'s own current value fresh.

## 3. Purity confirmed

- **No processing:** the return value is passed through completely
  unmodified — the same object reference `FedosRuntimeIdentity.currentIdentity()`
  itself returns.
- **No caching:** no field on `DesktopApplication` stores a prior
  result; every call re-reads `#identity` fresh.
- **No access to `#reader` or `#publicIdentity`:** confirmed directly
  against the method's own one-line body — neither field is
  referenced. Per Alpha 111/118, Identity Authority is reached
  EXCLUSIVELY through `#identity`.

## 4. What this Stage does NOT do

- Does **not** add `isBootstrapped()` — that remains Alpha 117's own
  deliverable.
- Does **not** modify `#identity`'s own construction, `bootstrap()`,
  or `start()` in any way.
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

- `docs/secure_runtime_alpha_073_identity_descriptor_reader_consolidation.md`
- `docs/secure_runtime_alpha_111_identity_authority_review.md`
- `docs/secure_runtime_alpha_115_identity_authority_completion.md`
