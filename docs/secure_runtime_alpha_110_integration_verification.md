# Secure Runtime Alpha 110 — Integration Verification

**Status: this Stage is VERIFICATION ONLY. It adds NO code — no
change to any `src/desktop/*` or `src/identity/*` file. This document
and its own guard test are the entire deliverable. This is Stage 5,
the closing Stage, of the Alpha 106–110 Nostr Public Identity
Implementation Arc.**

## 1. Why now

Alpha 106 confirmed the Source interface needed no addition. Alpha
107 gave `DesktopApplication` a public identity configuration slot.
Alpha 108 shipped `StaticNostrPublicIdentitySource`. Alpha 109 wired a
configured `publicIdentity` all the way through to a
`NostrPublicIdentityReader`. This Stage verifies, against the actual
resulting source rather than assumption, exactly how far a Static
configuration actually reaches — and precisely corrects one assumption
this Arc's own original objective implicitly made.

## 2. The connection, confirmed end to end — and one important correction

The Reader path, confirmed real and working:

```
createDesktopApplication(publicIdentity)
  ↓
new StaticNostrPublicIdentitySource(publicIdentity)
  ↓
new NostrPublicIdentityReader(source)
  ↓
new DesktopApplication(reader, publicIdentity)
```

`reader.readPublicIdentity()`, called directly against the exact
Reader `createDesktopApplication()` constructs internally, resolves
the configured Descriptor — confirmed by this Stage's own guard test,
with no mock standing in for any link.

**This Stage's own guard test also confirms, precisely, a claim this
Arc's own original objective assumed but which does NOT hold in the
actual architecture**: the Bootstrap path —
`DesktopApplication.#identity` (`FedosRuntimeIdentity`) →
`FedosIdentityService` → `FedosIdentityProvider`
(`NostrIdentityProvider`, via `resolveFedosIdentityProvider()`) →
`currentIdentity()` — is a SEPARATE, INDEPENDENT path that NEVER reads
`publicIdentity` or the Reader's own configured Source. Confirmed
directly: `app.currentIdentity` does not exist as a method on
`DesktopApplication` at all (it exists on `FedosRuntimeIdentity`,
which `DesktopApplication` does not expose); and even constructing
`FedosRuntimeIdentity` directly and calling `bootstrapIdentity()`
still always resolves `currentIdentity()` to `null`, REGARDLESS of
whatever `publicIdentity` was passed to `createDesktopApplication()`,
because `resolveFedosIdentityProvider()` (Alpha 032/034/036/039) is
fixed, unconditionally, to a `NostrIdentityProvider` backed by its OWN,
separately-constructed `NullNostrPublicIdentitySource` instance
(Alpha 039) — confirmed by Alpha 105's own precise finding, unaffected
by this Arc. Extending Static configuration into the Bootstrap path
would require modifying `src/identity/fedos_identity_provider_resolver.ts`
or `FedosRuntimeIdentity`'s own argument-free constructor — both
explicitly out of scope for every Stage in this Arc, and neither is
touched.

## 3. What DOES work, verified precisely

- **Static configuration reaches the Reader.** `createDesktopApplication(publicIdentity)`'s
  own internally-constructed Reader resolves the EXACT configured
  Descriptor via `readPublicIdentity()` — confirmed directly, with no
  mock.
- **Null configuration (the default) reaches the Reader as `null`.**
  `createDesktopApplication()`, called with no argument, still
  resolves `null` through the Reader — confirmed unchanged.
- **`DesktopApplication`'s own `#publicIdentity` field holds the exact
  configuration value** passed to `createDesktopApplication()` — Alpha
  107's own field now genuinely reflects the configuration, no longer
  always `undefined`.

## 4. What does NOT work, precisely documented rather than assumed

- **`currentIdentity()` never reflects the Static configuration**, in
  ANY configuration, Static or Null — confirmed by direct
  construction and Bootstrap. This is a structural consequence of
  Alpha 089 (Runtime Separation) and Alpha 093 (Ownership), both of
  which permanently keep `FedosRuntimeIdentity`'s own Bootstrap
  pipeline and Desktop's own Reader as two independent objects with
  independent Source instances.
- **No public method on `DesktopApplication` exposes `#reader`'s own
  result** — `readPublicIdentity()` is reachable only by constructing
  a `NostrPublicIdentityReader` directly with the same Source, not
  through `DesktopApplication` itself. Exposing it remains explicitly
  out of scope, undecided, and deferred to a future, separately-scoped
  Stage.

## 5. Completion Declaration

- **The Nostr Public Identity Implementation is hereby declared
  functionally COMPLETE for its own stated scope: Desktop → Reader →
  Static Source is a real, working, verified connection that delivers
  a configured Descriptor with zero Relay communication, zero event
  retrieval, and zero secret-key handling.**
- **The Bootstrap → Provider → `currentIdentity()` path is confirmed,
  precisely, to remain entirely unaffected by this Arc** — this
  correction is recorded here rather than silently assumed, consistent
  with this whole project's own established discipline of verifying
  claims against actual behavior (Alpha 105's own precedent).
- Real Relay communication, real event retrieval, and connecting the
  Bootstrap/Provider path to a configurable Source all remain
  explicitly OUT OF SCOPE, deferred to future, separately-scoped
  Stages.

## 6. What this Stage does NOT do

- Does **not** modify any file under `src/desktop/*` or
  `src/identity/*`.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, WebSocket connections,
  NIP logic, event retrieval, signing, DM handling, or Observation of
  any kind.
- Does **not** add a sixth Nostr Public Identity Implementation Stage,
  and forbids any future Stage from adding one under this Arc's own
  name.

## 7. See also

- `docs/secure_runtime_alpha_089_desktop_runtime_separation_review.md`
- `docs/secure_runtime_alpha_093_ownership_review.md`
- `docs/secure_runtime_alpha_105_integration_verification.md`
- `docs/secure_runtime_alpha_107_desktop_public_identity_configuration.md`
- `docs/secure_runtime_alpha_108_static_public_identity_source.md`
- `docs/secure_runtime_alpha_109_desktop_wiring.md`
