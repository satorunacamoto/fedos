# Secure Runtime Alpha 124 — Desktop API Verification

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind — no `src/` file is modified. This is Stage 4 of the
Alpha 121–125 Desktop Public Identity Reader Arc, following Alpha
123's own Boundary confirmation.**

## 1. Why now

Alpha 119 fixed the Desktop public API as four methods, at the close
of the previous Arc. Alpha 121 added a fifth, `readPublicIdentity()`.
This Stage restates the Decision against the CURRENT source, before
Alpha 125's own closing Completion Declaration.

## 2. What was reviewed

The full, current body of `src/desktop/desktop_application.ts` was
inspected for every `export` and every public (non-`#`-prefixed)
method:

- **Exports**: `DesktopApplication` remains the ONLY export.
- **Public methods**: exactly five —
  `bootstrap()`, `start()`, `currentIdentity()`, `isBootstrapped()`,
  `readPublicIdentity()`.
- No method returns `#reader` (`FedosPublicIdentityReader`) itself.
- No method returns `#identity` (`FedosRuntimeIdentity`) itself, or
  any internal Registry/Provider object it may hold.
- No method returns `#publicIdentity`
  (`FedosNostrPublicIdentitySnapshot | undefined`) itself.
- No getter (`get` keyword) exists anywhere on the class.

## 3. Decision

**The Desktop public API is exactly:**

```
bootstrap(): Promise<void>
start(): Promise<void>
currentIdentity(): FedosIdentityDescriptor | null
isBootstrapped(): boolean
readPublicIdentity(): Promise<FedosIdentityDescriptor | null>
```

**Permanently EXCLUDED from this surface:** any method that exposes
`FedosPublicIdentityReader` (Reader) itself, `FedosIdentityRegistry`
(Registry), `FedosIdentityProvider` (Provider), or
`FedosNostrPublicIdentitySnapshot` (Source-level configuration)
itself, by reference or by any accessor of any kind — this restates
Alpha 119's own exclusion list unchanged; Alpha 121 added a VALUE
accessor (`readPublicIdentity()` returns a `FedosIdentityDescriptor`),
never a reference accessor for the Reader object itself.

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

- `docs/secure_runtime_alpha_119_desktop_api_verification.md`
- `docs/secure_runtime_alpha_121_desktop_reader_access.md`
- `docs/secure_runtime_alpha_122_factory_verification.md`
- `docs/secure_runtime_alpha_123_desktop_public_identity_boundary.md`
