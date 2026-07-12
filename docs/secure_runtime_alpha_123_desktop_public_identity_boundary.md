# Secure Runtime Alpha 123 — Desktop Public Identity Boundary

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind — no `src/` file is modified. This is Stage 3 of the
Alpha 121–125 Desktop Public Identity Reader Arc, following Alpha
122's own Factory Verification.**

## 1. Why now

With `readPublicIdentity()` now wired (Alpha 121) and confirmed to
call through the real, injectable Reader (Alpha 122), this Stage
formally confirms the boundary between the two paths Desktop now
exposes, before Alpha 124/125 close the Arc.

## 2. The two paths, confirmed independent

```
currentIdentity()  ↓  FedosRuntimeIdentity   (Alpha 116, via #identity)
readPublicIdentity()  ↓  FedosPublicIdentityReader  (Alpha 121, via #reader)
```

- **`currentIdentity()`** (Alpha 116): entire body is
  `return this.#identity.currentIdentity();`. No reference to
  `#reader`.
- **`readPublicIdentity()`** (Alpha 121): entire body is
  `return this.#reader.readPublicIdentity();`. No reference to
  `#identity`.
- **`#identity`'s own construction**: `new FedosRuntimeIdentity()` —
  no argument derived from `#reader` or `#publicIdentity`.
- **`#reader`'s own construction**: injected via the constructor's
  `reader` parameter, or defaulted independently through
  `resolveNostrPublicIdentitySource()` — no reference to `#identity`.
- **`bootstrap()`/`start()`** (the only methods that WRITE Identity
  state): both delegate to `#identity.bootstrapIdentity()` alone —
  neither reads nor writes `#reader`.

No method, field initializer, or constructor statement anywhere in
`DesktopApplication` connects the two paths in either direction.

## 3. Decision

**`currentIdentity()`/`isBootstrapped()` (the `#identity` path) and
`readPublicIdentity()` (the `#reader` path) are, and remain,
COMPLETELY INDEPENDENT. Neither reads, writes, triggers, or otherwise
influences the other. A call to one produces no observable effect on
the other's own next result.** This reconfirms, rather than revises,
the independence Alpha 110 already established between the Reader
path and the Bootstrap/Authority path — Alpha 121 only added a public
ACCESSOR for a path whose independence was already fixed.

## 4. What this Stage does NOT do

- Does **not** modify `desktop_application.ts` or any other `src/`
  file.
- Does **not** connect the two paths in any way — they remain
  deliberately, permanently separate.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, `src/identity/*`,
  Storage, Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_110_integration_verification.md`
- `docs/secure_runtime_alpha_118_desktop_authority_consumption.md`
- `docs/secure_runtime_alpha_121_desktop_reader_access.md`
- `docs/secure_runtime_alpha_122_factory_verification.md`
