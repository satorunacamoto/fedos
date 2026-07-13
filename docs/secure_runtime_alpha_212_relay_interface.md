# Secure Runtime Alpha 212 — Relay Interface

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/fedos_relay.ts`, and nothing else. This is Stage 2 of
the Alpha 211–220 Nostr Relay Foundation Arc, following Alpha 211's
own Decision.**

## 1. Why now

Alpha 211 §4 decided this Arc's own boundary is a new, minimal,
Desktop-owned interface, mirroring the Alpha 101 Public Identity
Reader precedent. This Stage builds the first piece: the interface
itself, holding exactly the "one connection target" shape this Arc's
own Alpha 212 instruction names — no method yet, matching Alpha 101's
own precedent of shipping a bare interface FIRST, with implementations
and methods following over subsequent Stages.

## 2. What was implemented

```ts
export interface FedosRelay {
  readonly url: string;
}
```

- Exactly one member, `readonly url: string` — a single connection
  target. No array, no `urls`, no pool of any kind — this Arc's own
  instruction list excludes Relay Pool explicitly, and this Stage's
  own interface shape makes a pool structurally impossible to express
  without a LATER, separately-reviewed change.
- No method of any kind — `connect()`/`disconnect()`/`isConnected()`/
  `publish()` do not exist on this interface yet. A conforming value
  today is nothing more than a named target; Alpha 214/215/216 each
  add exactly one capability, in that order.
- No implementation of `FedosRelay` exists yet anywhere in this
  repository — that is Alpha 213's (a dependency-free Null
  implementation) own deliverable.

## 3. Responsibility boundary

- **One connection target only:** the interface names exactly one
  capability today — identifying WHICH relay a conforming value
  targets — nothing else.
- **No REQ/CLOSE/Subscription/Filter vocabulary:** no method or field
  names any such capability, matching this Arc's own exclusion list.
- **No ACK/OK vocabulary:** no field or method suggests a publish
  acknowledgement of any kind — Alpha 216's own "No ACK handling"
  instruction is honored from this Stage's own first line.
- **No dependency on `src/nostr/*`/`src/sign/*`:** this file imports
  nothing — Alpha 211 §3's own finding (none of the four pre-existing
  Relay files is reusable) is honored by writing a completely
  independent type.

## 4. What this Stage does NOT do

- Does **not** implement `FedosRelay` — no class conforming to it
  exists anywhere in this repository yet.
- Does **not** add `connect()`, `disconnect()`, `isConnected()`, or
  `publish()` to the interface — each is a separate, later Stage's own
  deliverable.
- Does **not** modify `src/desktop/desktop_application.ts`,
  `create_desktop_application.ts`, or any other existing `src/desktop/*`
  file.
- Does **not** modify `src/nostr/*`, `src/sign/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage,
  `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.
- Does **not** open any network connection of any kind — no
  `WebSocket`, no `fetch`.

## 5. See also

- `docs/secure_runtime_alpha_211_relay_code_review.md`
- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
- `docs/secure_runtime_alpha_202_desktop_facing_event_reader_abstraction.md`
