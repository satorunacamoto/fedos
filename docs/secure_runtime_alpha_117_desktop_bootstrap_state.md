# Secure Runtime Alpha 117 — Desktop Bootstrap State

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/desktop_application.ts`, and nothing else. This is Stage
2 of the Alpha 116–120 Desktop Identity Consumption Arc, immediately
following Alpha 116's own `currentIdentity()` delegation.**

## 1. Why now

Alpha 116 gave Desktop read access to the resolved Descriptor itself,
but not to Bootstrap's own completion state. `FedosRuntimeIdentity`
has exposed `isBootstrapped(): boolean` since Alpha 072. Desktop's own
`#started` field (Alpha 098) answers a DIFFERENT question — whether
`start()` itself has been called — not whether Identity Bootstrap has
completed. This Stage gives Desktop a way to ask the Identity
Authority directly.

## 2. What was implemented

```ts
isBootstrapped(): boolean {
  return this.#identity.isBootstrapped();
}
```

- A new public method, `isBootstrapped()`.
- Its own ENTIRE body is a single `return` statement, delegating
  directly to `this.#identity.isBootstrapped()` — the Identity
  Authority's own existing, unchanged public method (Alpha 072).
- No Desktop-independent state of any kind: this class holds no
  `#bootstrapped` field, and never derives the answer from `#started`.

## 3. Purity confirmed

- **No processing:** the boolean is returned exactly as
  `FedosRuntimeIdentity.isBootstrapped()` itself computes it.
- **No caching:** no field on `DesktopApplication` stores a prior
  result; every call re-reads `#identity` fresh.
- **No derivation from `#started`:** confirmed directly against the
  method's own one-line body — `#started` is not referenced.
  `#started` (Alpha 098) and `isBootstrapped()` (this Stage) answer
  two independent questions: "has `start()` been called on THIS
  Desktop instance" versus "has Identity Bootstrap completed on the
  held `FedosRuntimeIdentity`."
- **No access to `#reader` or `#publicIdentity`:** confirmed directly
  against the method's own one-line body — neither field is
  referenced. Per Alpha 111/118, Identity Authority is reached
  EXCLUSIVELY through `#identity`.

## 4. What this Stage does NOT do

- Does **not** add a `#bootstrapped` field to `DesktopApplication` —
  the value is read fresh from `#identity` on every call.
- Does **not** modify `currentIdentity()` (Alpha 116), `#identity`'s
  own construction, `bootstrap()`, or `start()` in any way.
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

- `docs/secure_runtime_alpha_072_identity_bootstrap_state_reader_consolidation.md`
- `docs/secure_runtime_alpha_098_ready_state.md`
- `docs/secure_runtime_alpha_116_desktop_identity_access.md`
