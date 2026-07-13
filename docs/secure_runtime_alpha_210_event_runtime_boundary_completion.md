# Secure Runtime Alpha 210 — Event Runtime Boundary Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
201–210 Nostr Event Runtime Exposure Arc.**

## 1. Why now

Alpha 201 decided the boundary's own shape; Alpha 202/203 built it
(`FedosEventDescriptor`, `FedosEventReader`, `NullEventReader`) and
decided `DesktopApplication` itself would not be wired this Arc; Alpha
204–208 reviewed ownership, immutability, the Runtime boundary, Relay
compatibility, and Session/ATProto compatibility, in that order; Alpha
209 verified the whole chain by real execution. This Stage issues the
Arc's own closing Completion Declaration and freezes the Runtime Event
Boundary at its current, deliberately minimal shape.

## 2. The Boundary, confirmed complete

```
FedosNostrEventHandle (Alpha 192, pub(crate), UNCHANGED this Arc)
        — unreachable from TypeScript, by construction (Alpha 198/206)
        ┊  (no wasm export exists to cross this line — Alpha 201 §2, Candidate A REJECTED)
        ┊
FedosEventDescriptor (Alpha 202) — protocol-independent public shape
        ↑
FedosEventReader (Alpha 202) — readEvents(): Promise<readonly FedosEventDescriptor[]>
        ↑
NullEventReader (Alpha 203) — the only implementation; always []
        — NOT wired into DesktopApplication (Alpha 203 §3, reconfirmed
          unchanged by Alpha 206/209)
```

Zero new Rust code: `packages/fedos-core-rust/src/lib.rs`'s own
`#[wasm_bindgen]` count and `pub fn` count remain fixed at 13/36,
unchanged since Alpha 191 (Alpha 200 §3, Alpha 201/206/208, all
reconfirmed throughout this Arc). Zero new Cargo dependency, zero new
npm dependency. Three new TypeScript files, all under `src/desktop/`,
all freestanding, none imported by any pre-existing file, none
importing `desktop_application.ts`/`create_desktop_application.ts` in
return.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE, at the deliberately
minimal scope Alpha 201 decided. Desktop now has a real,
protocol-independent, immutable, ownership-clean read boundary for
Events (`FedosEventReader`/`FedosEventDescriptor`), backed today by a
dependency-free Null implementation, entirely independent of the
`pub(crate)`-only Rust Event Foundation — exposed "safely," per this
Arc's own Objective, precisely BECAUSE no new capability was granted:
no secret key, no signing, no Relay, no Subscription, no Filter, no
mutation, and no new Rust wasm surface exist anywhere in this Arc's
own three new files, verified by real execution (Alpha 209) rather
than assumed from reading source alone.**

**The following do NOT exist yet, exactly as this Arc's own Objective
requires:**

- **Relay networking, WebSocket, Subscription, Filters** — no
  connection, no wire protocol, no query mechanism of any kind exists
  anywhere in `fedos_event_descriptor.ts`, `fedos_event_reader.ts`, or
  `null_event_reader.ts` (Alpha 207).
- **A real, non-empty Event data source** — `NullEventReader` is the
  ONLY `FedosEventReader` implementation in this repository;
  `readEvents()` always resolves `[]` (Alpha 203/209).
- **A `DesktopApplication` method reading through the new boundary** —
  `desktop_application.ts` and `create_desktop_application.ts` remain
  byte-for-byte unmodified since Alpha 136 (Alpha 203 §3, reconfirmed
  by Alpha 206/209).
- **Any new `#[wasm_bindgen]` export or `pub fn`** — `lib.rs`'s own
  counts stay fixed at 13/36 (Alpha 201/206/208).
- **Any GUI, Worker integration, Storage, or Observation construct of
  any kind** — none of this Arc's own three new files references any
  of the four.
- **Session/ATProto/Wallet event or record support of any kind** —
  `HkdfDomain`/`SecretHandleKind` gained zero new variant across this
  whole Arc (Alpha 208).

**Next Arc recommendation — ONE candidate, chosen from this Arc's own
scope boundary:** **Nostr Event Wasm Export & Real Reader
Implementation.** This Arc's own Alpha 203 §3 already named the exact
condition under which wiring `DesktopApplication` becomes worthwhile —
"the moment a real Event source exists." That requires, first, a
reviewed decision about WHICH Rust Event Foundation output (the
canonical text? the Event ID? a fully assembled, signed event
including `id`/`sig`?) should cross the wasm boundary, and how — the
SAME kind of Encoder-Boundary-first discipline
`nostr_identifier_encoding` (Alpha 173) and `nostr_event_encoding`
(Alpha 193) already established before either was ever wired to a
caller. Relay networking, WebSocket, Subscription, and Filters remain
explicitly OUT of scope for that next Arc too, exactly as they were
out of scope here.

## 4. What this Stage does NOT do

- Does **not** modify `src/desktop/fedos_event_descriptor.ts`,
  `fedos_event_reader.ts`, or `null_event_reader.ts` beyond what Alpha
  202/203 already landed — no further production code change.
- Does **not** wire the new boundary into `DesktopApplication`, a real
  Event source, or `packages/fedos-core-rust` — §3's own "does NOT
  exist yet" list is a finding, not an implementation.
- Does **not** implement Relay communication, WebSocket, Subscription,
  Filters, or any GUI.
- Does **not** modify `src/desktop/desktop_application.ts`,
  `create_desktop_application.ts`, `src/identity/*`, `src/nostr/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_209_end_to_end_verification.md`
- `docs/secure_runtime_alpha_208_session_atproto_compatibility_review.md`
- `docs/secure_runtime_alpha_207_relay_compatibility_review.md`
- `docs/secure_runtime_alpha_206_runtime_boundary_review.md`
- `docs/secure_runtime_alpha_205_event_immutability_review.md`
- `docs/secure_runtime_alpha_204_event_ownership_review.md`
- `docs/secure_runtime_alpha_203_null_event_reader_and_desktop_wiring_decision.md`
- `docs/secure_runtime_alpha_202_desktop_facing_event_reader_abstraction.md`
- `docs/secure_runtime_alpha_201_event_runtime_exposure_review.md`
- `docs/secure_runtime_alpha_200_event_foundation_completion.md`
