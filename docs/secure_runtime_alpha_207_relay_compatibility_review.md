# Secure Runtime Alpha 207 — Future Relay Compatibility Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 7 of the Alpha 201–210 Nostr Event Runtime Exposure Arc,
following Alpha 206's own Runtime Boundary Review.**

## 1. Why now

This Arc's own Alpha 207 instruction states plainly: "Review future
Relay compatibility. Ensure the Event API is Relay-independent." Relay
networking is explicitly out of THIS Arc's own scope (per this Arc's
own instruction list, and per Alpha 200 §3's own "does NOT exist yet"
finding, still true — §4 below); a FUTURE Arc will eventually build
Relay integration on top of whatever Event boundary exists today. This
Stage confirms that future Arc will be ADDING a Relay-backed
`FedosEventReader`, not RESHAPING the interface itself to accommodate
Relay concerns retroactively.

## 2. What "Relay-independent" means for `FedosEventReader`

`FedosEventReader`'s own single method, `readEvents(): Promise<readonly FedosEventDescriptor[]>`
(Alpha 202), names no Relay concept anywhere in its signature:

- No relay URL, connection, or endpoint parameter.
- No subscription id, filter object, or query parameter of any kind —
  this Arc's own instruction list excludes Subscription and Filters
  explicitly, and the interface itself names neither.
- No `close()`/`connect()`/`disconnect()` lifecycle method — a
  conforming implementation that DOES read from a Relay would own its
  own connection lifecycle privately, never exposing it through this
  interface, exactly as `FedosPublicIdentityReader` (Alpha 101 §HARD
  GUARDRAILS) already established for the identity-layer equivalent:
  "a conforming implementation MAY read from a network source
  internally, but this interface itself names no such capability."
- No streaming/callback/event-emitter shape — `readEvents()` returns a
  single `Promise` of a finite array, not an open-ended subscription
  feed. A future Relay-backed implementation would resolve that
  `Promise` once, from whatever Events it had accumulated by then, the
  SAME "one Promise, resolved once" shape `NostrPublicIdentityReader`
  (Alpha 103) already uses for a conceptually similar case.

## 3. What a future Relay-backed `FedosEventReader` implementation
   would look like — previewed, not built

A hypothetical `RelayEventReader` would take an injected Relay client
or connection descriptor in its OWN constructor (mirroring
`NostrPublicIdentityReader`'s own injected-Source pattern, Alpha 103),
and implement `readEvents()` by querying that Relay internally,
mapping whatever wire-format events it receives into
`FedosEventDescriptor` values before returning them. `FedosEventReader`
itself would not change at all — no new method, no new parameter — the
SAME "interface stays fixed, implementations vary" shape
`FedosPublicIdentityReader` already demonstrates across
`NostrPublicIdentityReader` (Alpha 103) and `NullPublicIdentityReader`
(Alpha 104).

## 4. Confirmed: no Relay/WebSocket/Subscription/Filter reference
   anywhere in this Arc's own five new/reviewed files

Direct inspection, this Stage: `fedos_event_descriptor.ts`,
`fedos_event_reader.ts`, and `null_event_reader.ts` (Alpha 202/203)
carry zero reference to `Relay`, `WebSocket`, `Subscription`, or
`Filter` in their own CODE (doc-comment mentions discussing these as
forbidden guardrails are expected and excluded from this check,
exactly as Alpha 199 §5 already excluded its own doc-comment mentions
from an equivalent code-only check). `src/nostr/relay.ts` and
`src/nostr/ws_relay.ts` — this repository's own PRE-EXISTING Relay
code — remain completely unmodified and unimported by any of this
Arc's own three new files.

## 5. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** implement `RelayEventReader` or any Relay-backed
  `FedosEventReader` implementation of any kind.
- Does **not** modify `src/nostr/relay.ts`, `src/nostr/ws_relay.ts`, or
  any other pre-existing Relay code.
- Does **not** add a Subscription, Filter, or streaming method to
  `FedosEventReader`.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, Storage,
  Observation, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_206_runtime_boundary_review.md`
- `docs/secure_runtime_alpha_202_desktop_facing_event_reader_abstraction.md`
- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
- `docs/secure_runtime_alpha_103_source_injection.md`
- `docs/secure_runtime_alpha_200_event_foundation_completion.md`
