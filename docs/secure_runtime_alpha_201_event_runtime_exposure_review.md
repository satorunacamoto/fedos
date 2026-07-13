# Secure Runtime Alpha 201 — Nostr Event Runtime Exposure Review

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 1 of the Alpha 201–210 Nostr Event Runtime Exposure
Arc, following the completed Nostr Event Foundation Arc (Alpha
191–200), which recommended this exact Arc as its own next candidate.**

## 1. Why now

Alpha 200 §3 closed the Event Foundation Arc with five confirmed
absences, one of which is "a public Runtime API for events" —
`FedosNostrEventHandle` and its four functions
(`new_nostr_event_internal`, `serialize_nostr_event_canonical_internal`,
`derive_nostr_event_id_internal`, `sign_nostr_event_internal`) remain
`pub(crate)` only, unreachable from `AppRuntime`/Desktop by
construction (Alpha 198, reconfirmed unchanged since). This Arc's own
Objective asks for the Desktop Runtime boundary to expose Events
"safely" — this Stage decides exactly what that minimal exposure looks
like, before Alpha 202/203 build it.

## 2. What "the Runtime Boundary" can mean here — two candidate shapes,
   reviewed

- **Candidate A — extend the Rust wasm surface.** Add a
  `#[wasm_bindgen]` export so `FedosNostrEventHandle` (or its
  canonical/signed output) becomes reachable from TypeScript. REJECTED
  for this Arc: it is a new public wasm export, not a reuse of the
  existing Foundation — Alpha 200 §3 specifically counted "ZERO new
  `#[wasm_bindgen]` export" and "ZERO new `pub fn`" as completion
  properties of the Foundation this Arc must not disturb, and this
  Arc's own instruction list forbids "AppRuntime redesign" and "New
  Cargo dependencies" while never asking for a new wasm export either.
  Growing the Rust public surface is a decision with its own review
  cost this Arc's own ten Stages do not budget for.
- **Candidate B — a Desktop-facing read boundary, defined in
  TypeScript only, exactly mirroring the Alpha 101 Public Identity
  Reader precedent.** `FedosPublicIdentityReader` (Alpha 101) named a
  protocol-independent read capability as an interface FIRST, with
  `NostrPublicIdentityReader` (Alpha 103, a real but wasm-independent
  implementation) and `NullPublicIdentityReader` (Alpha 104, a
  dependency-free implementation) following. Neither Alpha 103 nor 104
  ever called into `packages/fedos-core-rust` directly — the Reader
  pattern itself has never depended on a wasm export existing yet.
  ADOPTED for this Arc: `FedosEventReader`, a new interface Desktop
  owns, and `FedosEventDescriptor`, a new protocol-independent public
  shape for an already-finalized Event — built entirely in
  `src/desktop/`, with zero Rust change.

## 3. What "safely" rules out

- **No secret key, signing, or mutation capability anywhere on the new
  boundary** — a `FedosEventReader` may only ever RETURN Events that
  already exist; it constructs none, signs none, and modifies none.
- **No Relay/WebSocket/Subscription/Filter vocabulary** — this Arc's
  own instruction list excludes all four explicitly; the new interface
  itself must name no such capability, exactly as `FedosPublicIdentityReader`
  (Alpha 101 §HARD GUARDRAILS) already set the precedent for the
  identity-layer equivalent.
- **No Nostr-specific field names on the public shape** —
  `FedosEventDescriptor` (Alpha 202) uses protocol-neutral field names
  (`author`, `createdAt`, `signature`, …), mirroring
  `FedosIdentityDescriptor`'s own `publicIdentifier` (not `npub`) and
  `provider: string` (not a fixed union) discipline, so a future
  Session/ATProto Stage is not tempted to treat this shape as
  Nostr-only by name alone (previewed here, confirmed by direct
  inspection in Alpha 208).

## 4. Whether `DesktopApplication` itself needs a new method — deferred,
   not decided, here

`DesktopApplication` (`src/desktop/desktop_application.ts`) has been
byte-for-byte frozen since Alpha 136 (Stage `d58f323`) — every one of
the ~40 Stages between Alpha 136 and Alpha 200 re-confirms its exact
method/field set unchanged as part of its own regression suite. Wiring
a new Reader into it is a real, cascading cost, not a free addition.
Whether that cost is "strictly required" this Arc (per the Objective's
own Alpha 203 instruction) depends on whether a real Event data source
exists to read FROM — which, per §2 above, it does not yet (no wasm
export exists). This Stage does not decide the answer; Alpha 203 does,
after the Reader/Descriptor shapes themselves exist (Alpha 202).

## 5. Decision

This Arc adds exactly three new files, all under `src/desktop/`, all
new (no existing file is renamed or replaced):

1. `fedos_event_descriptor.ts` — `FedosEventDescriptor`, a type-only
   file (Alpha 202).
2. `fedos_event_reader.ts` — `FedosEventReader`, an interface-only file
   (Alpha 202).
3. `null_event_reader.ts` — `NullEventReader`, a dependency-free
   implementation (Alpha 203).

No `packages/fedos-core-rust/src/lib.rs` change, no `Cargo.toml`
change, no `package.json` change, no `AppRuntime`/`create_runtime.ts`/
`types.ts`/`worker.ts` change. Whether `desktop_application.ts` itself
changes is Alpha 203's own decision, made after items 1–3 above exist.

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** implement `FedosEventReader`, `FedosEventDescriptor`, or
  `NullEventReader` — Alpha 202/203's own deliverables.
- Does **not** add any `#[wasm_bindgen]` export or new `pub fn` to
  `lib.rs`.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, WebSocket, Subscription,
  Filters, or any GUI.

## 7. See also

- `docs/secure_runtime_alpha_200_event_foundation_completion.md`
- `docs/secure_runtime_alpha_198_event_runtime_boundary_review.md`
- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
- `docs/secure_runtime_alpha_104_null_reader.md`
- `docs/secure_runtime_alpha_136_startup_sequence.md`
