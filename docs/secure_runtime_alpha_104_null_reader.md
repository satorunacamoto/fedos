# Secure Runtime Alpha 104 — Null Reader

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/null_public_identity_reader.ts`, and nothing else — no
existing file is modified, and this new file is wired into nothing.
This is Stage 4 of the Alpha 101–105 Public Identity Source Foundation
Arc.**

## 1. Why now

Alpha 103 shipped the first `FedosPublicIdentityReader` implementation
— `NostrPublicIdentityReader`, which wraps a Source. This Stage adds a
second, dependency-free implementation, mirroring the exact
relationship `NoopFedosIdentityProvider` (Alpha 033) already has to
`NostrIdentityProvider`: a simpler alternative that needs no Source of
its own, available for any future caller (or test) that wants a
trivially predictable Reader without constructing a Source first.

## 2. What was implemented

```ts
export class NullPublicIdentityReader implements FedosPublicIdentityReader {
  async readPublicIdentity(): Promise<FedosIdentityDescriptor | null> {
    return null;
  }
}
```

- No constructor parameter, no field, no Source dependency of any
  kind.
- `readPublicIdentity()` always resolves `null` — no branching, no
  async work beyond the `Promise` wrapper itself.

## 3. Existing behavior maintained 100%

This Stage adds ONE new, standalone file and wires it into NOTHING —
`createDesktopApplication()` continues constructing
`NostrPublicIdentityReader` exactly as Alpha 103 left it, and
`DesktopApplication`'s own constructor default is unchanged. Since
neither existing call site is touched, EVERY observable behavior of
this whole Arc, up through Alpha 103, remains byte-for-byte identical
after this Stage. `NostrPublicIdentityReader` itself, wrapping the
shared `NullNostrPublicIdentitySource` singleton (Alpha 048), already
resolves `null` today — `NullPublicIdentityReader` reaches the SAME
observable outcome through a structurally simpler, dependency-free
path, without replacing anything that currently runs.

## 4. What this Stage does NOT do

- Does **not** wire `NullPublicIdentityReader` into
  `createDesktopApplication()`.
- Does **not** change `DesktopApplication`'s own constructor default
  parameter.
- Does **not** modify `src/desktop/desktop_application.ts`,
  `create_desktop_application.ts`, `nostr_public_identity_reader.ts`,
  or `fedos_public_identity_reader.ts`.
- Does **not** modify any `src/identity/*` file — only imports the
  existing, unchanged `FedosIdentityDescriptor` type.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** open any Relay, WebSocket, or network connection of any
  kind, and touches no secret key or signing logic.
- Does **not** implement any GUI or Observation construct of any kind.

## 5. See also

- `docs/secure_runtime_alpha_033_fedos_noop_identity_provider.md`
- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
- `docs/secure_runtime_alpha_103_source_injection.md`
