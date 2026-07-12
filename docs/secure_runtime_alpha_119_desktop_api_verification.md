# Secure Runtime Alpha 119 — Desktop API Verification

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind — no `src/` file is modified. This is Stage 4 of the
Alpha 116–120 Desktop Identity Consumption Arc, following Alpha 118's
own Authority Consumption confirmation.**

## 1. Why now

With `currentIdentity()` (Alpha 116) and `isBootstrapped()` (Alpha
117) now in place, and Alpha 118 confirming both consult `#identity`
exclusively, this Stage closes the loop by verifying the FINAL shape
of `DesktopApplication`'s own public surface, before Alpha 120's own
closing Completion Declaration.

## 2. What was reviewed

The full, current body of `src/desktop/desktop_application.ts` was
inspected for every `export` and every public (non-`#`-prefixed)
method:

- **Exports**: `DesktopApplication` is the ONLY export from the file.
- **Public methods**: exactly four —
  `bootstrap()`, `start()`, `currentIdentity()`, `isBootstrapped()`.
- No method returns `#reader` (`FedosPublicIdentityReader`) itself.
- No method returns `#identity` (`FedosRuntimeIdentity`) itself, or
  any internal Registry/Provider object it may hold — only the plain
  `FedosIdentityDescriptor | null` / `boolean` VALUES that
  `currentIdentity()`/`isBootstrapped()` themselves compute.
- No method returns `#publicIdentity`
  (`FedosNostrPublicIdentitySnapshot | undefined`) itself.

## 3. Decision

**The Desktop public API is exactly:**

```
bootstrap(): Promise<void>
start(): Promise<void>
currentIdentity(): FedosIdentityDescriptor | null
isBootstrapped(): boolean
```

**Permanently EXCLUDED from this surface:** any method that exposes
`FedosPublicIdentityReader` (Reader), `FedosIdentityRegistry`
(Registry), `FedosIdentityProvider` (Provider), or
`FedosNostrPublicIdentitySnapshot` (Source-level configuration)
itself, by reference or by any accessor of any kind.

## 4. What this Stage does NOT do

- Does **not** modify `desktop_application.ts` or any other `src/`
  file.
- Does **not** add, remove, or rename any public method.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, `src/identity/*`,
  Storage, Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_116_desktop_identity_access.md`
- `docs/secure_runtime_alpha_117_desktop_bootstrap_state.md`
- `docs/secure_runtime_alpha_118_desktop_authority_consumption.md`
