# Secure Runtime Alpha 118 — Desktop Authority Consumption

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind — no `src/` file is modified. This is Stage 3 of the
Alpha 116–120 Desktop Identity Consumption Arc, following Alpha
116/117's own `currentIdentity()`/`isBootstrapped()` delegations.**

## 1. Why now

Alpha 111 fixed `FedosRuntimeIdentity` as the sole Identity Authority.
Alpha 116/117 gave `DesktopApplication` its first two read methods.
Before closing the Arc, this Stage formally confirms — grounded in the
actual, current source, not assumption — that those two methods, and
`DesktopApplication` as a whole, never read Identity state from any
path OTHER than `#identity`.

## 2. What was reviewed

The full, current body of `src/desktop/desktop_application.ts` (184
lines as of Alpha 117) was inspected method by method:

- **`currentIdentity()`** (Alpha 116): entire body is
  `return this.#identity.currentIdentity();`. No reference to
  `#reader` or `#publicIdentity`.
- **`isBootstrapped()`** (Alpha 117): entire body is
  `return this.#identity.isBootstrapped();`. No reference to
  `#reader`, `#publicIdentity`, or `#started`.
- **`bootstrap()`**: entire body is
  `return this.#identity.bootstrapIdentity();`. No reference to
  `#reader` or `#publicIdentity`.
- **`start()`**: reads only `#started` (a Desktop-local guard flag,
  never an Identity value) and calls `this.bootstrap()`.
- **The constructor**: assigns `#reader` and `#publicIdentity` from
  its own parameters, but never reads either back to compute an
  Identity value — `#identity` is constructed independently, via
  `new FedosRuntimeIdentity()`, with no argument derived from `reader`
  or `publicIdentity`.

## 3. Decision

**`DesktopApplication` never reads Identity state from `#reader`,
`#publicIdentity`, or any Provider/Source of any kind. Every read of
Identity state — `currentIdentity()`, `isBootstrapped()` — passes
through `#identity` (`FedosRuntimeIdentity`) exclusively.**

`#reader`/`#publicIdentity` remain wired to a SEPARATE, INDEPENDENT
path (the Reader path, Alpha 103/107/109/110) that never converges
with the Bootstrap/Authority path — a structural finding already
established by Alpha 110's own Integration Verification, and
reconfirmed unchanged by Alpha 116/117's own additions, since neither
new method references `#reader` or `#publicIdentity`.

## 4. What this Stage does NOT do

- Does **not** modify `desktop_application.ts` or any other `src/`
  file.
- Does **not** modify `#reader`'s or `#publicIdentity`'s own meaning —
  the Reader path (Alpha 103–110) remains exactly as designed,
  independent of the Bootstrap/Authority path.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, `src/identity/*`,
  Storage, Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_110_integration_verification.md`
- `docs/secure_runtime_alpha_111_identity_authority_review.md`
- `docs/secure_runtime_alpha_116_desktop_identity_access.md`
- `docs/secure_runtime_alpha_117_desktop_bootstrap_state.md`
