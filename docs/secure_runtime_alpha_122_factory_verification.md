# Secure Runtime Alpha 122 — Factory Verification

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind — no `src/` file is modified. This is Stage 2 of the
Alpha 121–125 Desktop Public Identity Reader Arc, following Alpha
121's own `readPublicIdentity()` delegation.**

## 1. Why now

Alpha 121 gave `DesktopApplication` its first read access to `#reader`.
Before building further on that access, this Stage confirms — grounded
in the actual, current source — that the Reader `readPublicIdentity()`
now exposes is genuinely the SAME Reader `createDesktopApplication()`
constructs and passes in, with no substitution, wrapping, or copy
anywhere along the way, and that the ability to inject a different
Reader (the whole point of Alpha 103's own Source Injection Decision)
remains intact.

## 2. What was reviewed

The full, current bodies of `create_desktop_application.ts` and
`desktop_application.ts` were inspected together:

- **`createDesktopApplication()`** (Alpha 099/103/109): constructs a
  `NostrPublicIdentityReader` (wrapping either
  `resolveNostrPublicIdentitySource()` or a
  `StaticNostrPublicIdentitySource`, depending on whether
  `publicIdentity` was supplied), then calls
  `new DesktopApplication(reader, publicIdentity)` — passing that
  EXACT `reader` object as the constructor's first argument.
- **`DesktopApplication`'s own constructor**: assigns
  `this.#reader = reader;` verbatim — no wrapping, no cloning, no
  transformation of the argument.
- **`readPublicIdentity()`** (Alpha 121): `return this.#reader.readPublicIdentity();`
  — reads that SAME `#reader` field.

Tracing the reference: the object `createDesktopApplication()`
constructs is the exact object `new DesktopApplication(reader, ...)`
receives, is the exact object the constructor assigns to `#reader`, is
the exact object `readPublicIdentity()` calls
`.readPublicIdentity()` on. No intermediate step substitutes a
different object.

## 3. Decision

**`DesktopApplication.readPublicIdentity()` genuinely calls through to
the SAME Reader instance `createDesktopApplication()` constructed —
confirmed by reference, not merely by behavior. The constructor
parameter remains a real injection point: any object satisfying
`FedosPublicIdentityReader` may be passed to `new DesktopApplication(reader)`
directly, bypassing `createDesktopApplication()` entirely, and
`readPublicIdentity()` will call through to THAT object instead —
Reader substitutability (Alpha 103's own Decision) is unaffected by
Alpha 121.**

## 4. What this Stage does NOT do

- Does **not** modify `desktop_application.ts`,
  `create_desktop_application.ts`, or any other `src/` file.
- Does **not** change how `createDesktopApplication()` constructs its
  Reader or Source.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, `src/identity/*`,
  Storage, Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_099_desktop_factory.md`
- `docs/secure_runtime_alpha_103_source_injection.md`
- `docs/secure_runtime_alpha_109_desktop_wiring.md`
- `docs/secure_runtime_alpha_121_desktop_reader_access.md`
