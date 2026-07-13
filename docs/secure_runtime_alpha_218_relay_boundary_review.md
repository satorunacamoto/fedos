# Secure Runtime Alpha 218 — Relay Boundary Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 8 of the Alpha 211–220 Nostr Relay Foundation Arc, following
Alpha 217's own Relay Foundation Verification.**

## 1. Why now

This Arc's own Alpha 218 instruction states plainly: "Boundary review.
Desktop owns Relay. Runtime remains Relay-independent." Alpha 211 §4
already decided the three new files would live under `src/desktop/`;
this Stage confirms that decision was honored throughout Alpha
212–217, by direct inspection of every file this Arc could have
touched but did not — the SAME discipline Alpha 198/206 already
applied to the Event Foundation and Event Runtime Exposure Arcs.

## 2. Desktop owns Relay — confirmed by direct inspection

- `FedosRelay`, `NullRelay`, and `WebSocketRelay` all live under
  `src/desktop/` — `fedos_relay.ts`, `null_relay.ts`,
  `websocket_relay.ts` — no Relay-shaped type exists anywhere outside
  that directory that this Arc added.
- None of the three imports `desktop_application.ts` or
  `create_desktop_application.ts` — the Relay boundary exists
  ALONGSIDE Desktop's existing surface, not woven into it, the SAME
  "additive-only" finding Alpha 206 §3 already made for the Event
  Reader boundary one Arc ago.
- `desktop_application.ts` and `create_desktop_application.ts` are
  BOTH byte-for-byte unchanged by this Arc — confirmed by direct
  inspection, zero reference to `FedosRelay`, `NullRelay`, or
  `WebSocketRelay` in either file.

## 3. `AppRuntime`/`create_runtime.ts`/`types.ts`/`worker.ts` — zero
   reference, confirmed by direct inspection

- `src/runtime/create_runtime.ts`: zero reference to `FedosRelay`,
  `NullRelay`, `WebSocketRelay`, `FedosRelaySocket`,
  `FedosRelaySocketFactory`, or `connect`/`disconnect`/`isConnected`/
  `publish` in a Relay-specific sense.
- `src/runtime/types.ts`: same — zero reference.
- `src/worker.ts`: same — zero reference.
- `AppRuntime`'s own public method set (wherever declared/implemented
  across `src/runtime/*`): unchanged — no new method of any kind was
  added by this Arc.

## 4. Why "Runtime remains Relay-independent" holds structurally, not
   merely by convention

`FedosRelay` (Alpha 212–216) and `FedosEventReader`/`FedosEventDescriptor`
(Alpha 202) are the ONLY two Desktop-owned boundaries this repository's
own Alpha-numbered history has built so far, and BOTH follow the exact
SAME shape: a plain TypeScript interface, defined in `src/desktop/`,
imported by NOTHING under `src/runtime/`. Since `AppRuntime` is
constructed entirely via `src/runtime/create_runtime.ts` (Alpha
089/091's own original Worker/Desktop separation decision, reconfirmed
unchanged by Alpha 206 §4 one Arc ago), and that file has zero
reference to any Relay symbol, there is no CODE PATH by which
constructing or operating `AppRuntime` could ever touch a `FedosRelay`
value — the independence is a structural consequence of an import
graph with no edge between the two, not an unenforced convention that
could silently erode.

## 5. Structural confirmation (real inspection, this Stage)

- `grep`, case-sensitive, for `FedosRelay`, `NullRelay`,
  `WebSocketRelay`, `FedosRelaySocket`, and `FedosRelaySocketFactory`
  across `src/runtime/create_runtime.ts`, `src/runtime/types.ts`,
  `src/worker.ts`, `src/desktop/desktop_application.ts`, and
  `src/desktop/create_desktop_application.ts`: zero matches, all five
  symbols, all five files.
- `package.json`'s own `dependencies` count: still 2, unchanged across
  this whole Arc (Alpha 211 §5, reconfirmed here).

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** wire the Relay boundary into `AppRuntime`,
  `DesktopApplication`, `worker.ts`, or any Runtime/Worker construct.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_217_relay_foundation_verification.md`
- `docs/secure_runtime_alpha_206_runtime_boundary_review.md`
- `docs/secure_runtime_alpha_198_event_runtime_boundary_review.md`
- `docs/secure_runtime_alpha_089_desktop_runtime_separation_review.md`
- `docs/secure_runtime_alpha_211_relay_code_review.md`
