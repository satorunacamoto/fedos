# Secure Runtime Alpha 108 — Static Public Identity Source

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/static_nostr_public_identity_source.ts`, and nothing
else — no existing file is modified, and this new file is wired into
nothing. This is Stage 3 of the Alpha 106–110 Nostr Public Identity
Implementation Arc.**

## 1. Why now

Alpha 106 confirmed the existing `FedosNostrPublicIdentitySource`
interface needs no addition. Alpha 107 gave `DesktopApplication` a
place to hold a public identity configuration. This Stage adds the
FIRST real (non-Null) implementation of the Source interface: one that
returns a fixed, pre-configured identity — the identity this whole Arc
exists to make reachable, without any Relay communication of any kind.

## 2. What was implemented

```ts
export class StaticNostrPublicIdentitySource implements FedosNostrPublicIdentitySource {
  readonly #snapshot: FedosNostrPublicIdentitySnapshot;

  constructor(snapshot: FedosNostrPublicIdentitySnapshot) {
    this.#snapshot = snapshot;
  }

  async readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null> {
    return this.#snapshot;
  }
}
```

- The constructor takes exactly ONE argument — a
  `FedosNostrPublicIdentitySnapshot` (the SAME type Alpha 106 already
  confirmed sufficient) — and performs no validation, normalization,
  or transformation of it.
- `readPublicIdentity()` always resolves the SAME held snapshot,
  unchanged, on every call.
- No Relay, WebSocket, NIP logic, event retrieval, signing, or
  secret-key reference of any kind exists anywhere in this file — this
  class performs NO I/O of any kind; it is a pure, in-memory,
  constructor-injected return value.

## 3. Relationship to `NullNostrPublicIdentitySource`

This class is the "one fixed identity" counterpart to
`NullNostrPublicIdentitySource`'s own "zero identity" case (Alpha
039) — both are static, in-memory, side-effect-free implementations
of the SAME interface, differing only in what `readPublicIdentity()`
resolves. Neither performs any I/O; the only difference is a
constructor-supplied value versus a fixed `null`.

## 4. What this Stage does NOT do

- Does **not** wire `StaticNostrPublicIdentitySource` into
  `createDesktopApplication()`, `DesktopApplication`, or any other
  file — that remains Alpha 109's own deliverable.
- Does **not** modify `src/desktop/desktop_application.ts`,
  `create_desktop_application.ts`, `fedos_public_identity_reader.ts`,
  or `nostr_public_identity_reader.ts`.
- Does **not** modify any `src/identity/*` file — only imports the
  existing, unchanged `FedosNostrPublicIdentitySource`/`Snapshot`
  types.
- Does **not** open any Relay, WebSocket, or network connection of any
  kind, implement any NIP, retrieve any event, sign anything, or
  handle any DM.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage, Rust,
  `Cargo.toml`, or `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
- `docs/secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion.md`
- `docs/secure_runtime_alpha_106_public_identity_source_interface_review.md`
- `docs/secure_runtime_alpha_107_desktop_public_identity_configuration.md`
