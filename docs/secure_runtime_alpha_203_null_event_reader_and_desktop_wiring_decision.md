# Secure Runtime Alpha 203 — Null Event Reader & Desktop Wiring Decision

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/null_event_reader.ts`, and nothing else — no existing
file is modified, and this new file is wired into nothing. This is
Stage 3 of the Alpha 201–210 Nostr Event Runtime Exposure Arc,
following Alpha 202's own Reader/Descriptor shapes.**

## 1. Why now

Alpha 202 shipped `FedosEventReader` with no implementation. This
Stage adds the first one — `NullEventReader`, a dependency-free
implementation needing no Event source of its own — and, per this
Arc's own Alpha 203 instruction ("Add Event access methods to
`DesktopApplication` only if strictly required. No `AppRuntime`
changes."), decides whether `DesktopApplication` itself needs a new
method reading through this interface.

## 2. What was implemented

```ts
export class NullEventReader implements FedosEventReader {
  async readEvents(): Promise<readonly FedosEventDescriptor[]> {
    return [];
  }
}
```

- No constructor parameter, no field, no Event-source dependency of
  any kind — mirroring `NullPublicIdentityReader`'s
  (`src/desktop/null_public_identity_reader.ts`, Alpha 104) own
  identical relationship to `FedosPublicIdentityReader`.
- `readEvents()` always resolves an empty array — no branching, no
  Event construction, no async work beyond the `Promise` wrapper
  itself.

## 3. The DesktopApplication wiring decision — NOT required this Arc

**Decision: `desktop_application.ts` and `create_desktop_application.ts`
are NOT modified by this Arc.** Reasoning, following directly from
Alpha 201 §4's own deferral:

1. **No real Event data source exists to read from.** The Rust Event
   Foundation (`FedosNostrEventHandle` and its four functions, Alpha
   192–195) remains `pub(crate)`-only, unreachable from TypeScript by
   construction (Alpha 198, reconfirmed by Alpha 201 §2 — no
   `#[wasm_bindgen]` export was added by this Arc, §5 below). The
   ONLY implementation of `FedosEventReader` that exists after this
   Stage is `NullEventReader`, which always returns an empty list.
   Adding `DesktopApplication.readEvents()` today would add PUBLIC API
   surface backed by a permanently-empty implementation — new surface
   without new capability.
2. **The cost of touching `DesktopApplication` is real and
   asymmetric.** `desktop_application.ts` has been byte-for-byte
   frozen since Alpha 136 (`d58f323`) — every Stage from Alpha 136
   through Alpha 200 (~40 Stages) independently re-asserts its exact
   method/field set as a regression check. Adding one new field and
   one new method would require updating every one of those existing,
   already-committed assertions, for a capability (§1) that resolves
   to an empty array today regardless.
3. **This is the SAME judgment Alpha 104 already made for the
   identity-layer equivalent.** `NullPublicIdentityReader` shipped
   deliberately unwired, and stayed unwired for two full Stages until
   Alpha 107/109 gave `DesktopApplication` real configuration to wire
   a REAL Reader against. This Arc's own ten Stages do not reach an
   equivalent "real Event source now exists" milestone — Alpha 200 §3
   already named "a public Runtime API for events" as a confirmed
   absence this Arc does not fill (Alpha 201 §2, Candidate A
   REJECTED).
4. **Nothing in this Arc's own instruction requires wiring
   unconditionally.** "Only if strictly required" (this Arc's own
   Alpha 203 wording) is satisfied by demonstrating the requirement
   does not hold, exactly as legitimately as satisfying it by adding
   the method would be.

`FedosEventReader`/`FedosEventDescriptor`/`NullEventReader` remain
fully real, fully tested, freestanding types — available for a FUTURE
Arc to wire in, the moment a real Event source exists (mirroring
`NullPublicIdentityReader`'s own two-Stage wait before Alpha 107/109
gave it a purpose). This Stage's own Alpha 204 (Event ownership) and
Alpha 205 (Event immutability) verify the three files as they stand,
not a hypothetical wired state.

## 4. What this Stage does NOT do

- Does **not** wire `NullEventReader` into `createDesktopApplication()`
  or `DesktopApplication`'s own constructor.
- Does **not** add any method, field, or constructor parameter to
  `src/desktop/desktop_application.ts` or
  `create_desktop_application.ts` — both remain byte-for-byte
  unmodified.
- Does **not** modify `fedos_event_reader.ts` or
  `fedos_event_descriptor.ts`.
- Does **not** modify any `src/identity/*` file.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs`,
  `Cargo.toml`, `create_runtime.ts`, `types.ts`, `src/worker.ts`,
  Storage, or `package.json`.
- Does **not** open any Relay, WebSocket, or network connection of any
  kind, and touches no secret key or signing logic.

## 5. See also

- `docs/secure_runtime_alpha_202_desktop_facing_event_reader_abstraction.md`
- `docs/secure_runtime_alpha_201_event_runtime_exposure_review.md`
- `docs/secure_runtime_alpha_104_null_reader.md`
- `docs/secure_runtime_alpha_109_desktop_wiring.md`
- `docs/secure_runtime_alpha_200_event_foundation_completion.md`
