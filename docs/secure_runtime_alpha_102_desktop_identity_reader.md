# Secure Runtime Alpha 102 — Desktop Identity Reader

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind. It adds a single header-comment paragraph to
`src/desktop/desktop_application.ts`, and nothing else — no field, no
method, no constructor change. This is Stage 2 of the Alpha 101–105
Public Identity Source Foundation Arc.**

## 1. Why now

Alpha 101 added `FedosPublicIdentityReader` as a standalone interface
— no implementation, no owner, nothing wired. Before wiring any actual
implementation or injection path (Alpha 103), this Stage fixes WHO
will own the Reader once one exists: `DesktopApplication`, not
`FedosRuntimeIdentity`. Deciding ownership before implementation
mirrors this project's own established pattern (Alpha 091 before Alpha
096–100; the entire Alpha 086–095 Desktop Design before any of it was
implemented).

## 2. What changed, recorded precisely

`src/desktop/desktop_application.ts` is the ONLY file this Stage
touches, and the ONLY change is a new header-comment paragraph. No
field, no method body, and no constructor signature is touched —
`DesktopApplication`'s own shape is byte-for-byte identical to Alpha
098's own final state.

## 3. Decision

**A future `FedosPublicIdentityReader` instance is PERMANENTLY owned
by `DesktopApplication` alone. `FedosRuntimeIdentity` must NEVER hold
one, in any future implementation, for any purpose.**

## 4. Why NOT `FedosRuntimeIdentity`

- **Alpha 093's own Ownership Decision** already fixed that
  `FedosRuntimeIdentity` is owned exclusively by Desktop, and that
  Runtime/Worker/Storage/Provider/Resolver/Registry are each confirmed
  non-owners of it. Handing `FedosRuntimeIdentity` a Reader of its own
  would create a SECOND, parallel entry point into public identity
  data sitting inside the SAME class Alpha 093 already scoped tightly
  around Bootstrap alone — diluting that class's own single
  responsibility.
- **`FedosRuntimeIdentity`'s own constructor is deliberately
  argument-free** (confirmed unchanged since Alpha 050) — accepting a
  Reader would require either a breaking constructor change or a
  second construction path, either of which reopens Decisions this
  project has already closed.
- **Desktop already owns everything a Reader would need.** Per Alpha
  096–100, Desktop already directly constructs and holds
  `FedosRuntimeIdentity`; adding a second, independently-owned
  `FedosPublicIdentityReader` alongside it keeps both concerns at the
  SAME ownership layer, rather than nesting one inside the other.

## 5. What this Stage does NOT do

- Does **not** add a `#reader` field, constructor parameter, or any
  other structural change to `DesktopApplication` — that is Alpha
  103's own deliverable.
- Does **not** implement `FedosPublicIdentityReader` in any way.
- Does **not** modify `src/desktop/fedos_public_identity_reader.ts`,
  `create_desktop_application.ts`, or any other existing file.
- Does **not** modify any `src/identity/*` file.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** implement any GUI, Nostr, Relay, or Observation
  construct of any kind.

## 6. See also

- `docs/secure_runtime_alpha_093_ownership_review.md`
- `docs/secure_runtime_alpha_096_desktop_shell_skeleton.md`
- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
