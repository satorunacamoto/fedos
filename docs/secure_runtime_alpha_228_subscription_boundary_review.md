# Secure Runtime Alpha 228 — Subscription Boundary Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 8 of the Alpha 221–230 Nostr Subscription Foundation Arc,
following Alpha 227's own Subscription Foundation Verification.**

## 1. Why now

This Arc's own Alpha 228 instruction states plainly: "Boundary review.
Desktop owns subscriptions. Runtime remains protocol-independent."
Alpha 221 §4 already decided every new Subscription file would live
under `src/desktop/`; this Stage confirms that decision was honored
throughout Alpha 222–227, by direct inspection of every file this Arc
could have touched but did not — the SAME discipline Alpha 218 already
applied to the Relay Foundation Arc one Arc ago.

## 2. Desktop owns subscriptions — confirmed by direct inspection

- `FedosSubscription`, `FedosSubscriptionFilter`, `buildReqMessage`,
  and `buildCloseMessage` all live under `src/desktop/` —
  `fedos_subscription.ts`, `fedos_subscription_filter.ts`,
  `subscription_messages.ts` — no Subscription-shaped type exists
  anywhere outside that directory that this Arc added.
- `subscribe()`/`unsubscribe()` were added to `FedosRelay`,
  `NullRelay`, and `WebSocketRelay` — all three already
  `src/desktop/`-resident since Alpha 212–216 (Relay Foundation Arc).
- None of the three new Alpha 222–225 files, and neither of the two
  new Alpha 226 methods, imports `desktop_application.ts` or
  `create_desktop_application.ts` — the Subscription capability exists
  ALONGSIDE Desktop's existing surface, not woven into it, the SAME
  "additive-only" finding Alpha 218 §2 already made for the Relay
  boundary one Arc ago.
- `desktop_application.ts` and `create_desktop_application.ts` are
  BOTH byte-for-byte unchanged by this Arc — confirmed by direct
  inspection, zero reference to `FedosSubscription`,
  `FedosSubscriptionFilter`, `buildReqMessage`, `buildCloseMessage`,
  `subscribe`, or `unsubscribe` in either file.

## 3. `AppRuntime`/`create_runtime.ts`/`types.ts`/`worker.ts` — zero
   reference, confirmed by direct inspection

- `src/runtime/create_runtime.ts`: zero reference to
  `FedosSubscription`, `FedosSubscriptionFilter`, `buildReqMessage`,
  `buildCloseMessage`, or `subscribe`/`unsubscribe` in a
  Subscription-specific sense.
- `src/runtime/types.ts`: same — zero reference.
- `src/worker.ts`: same — zero reference.
- `AppRuntime`'s own public method set (wherever declared/implemented
  across `src/runtime/*`): unchanged — no new method of any kind was
  added by this Arc.

## 4. Why "Runtime remains protocol-independent" holds structurally,
   not merely by convention

`FedosRelay` (now including `subscribe()`/`unsubscribe()`,
Alpha 212–216 and 226) and `FedosEventReader`/`FedosEventDescriptor`
(Alpha 202) remain the ONLY Desktop-owned boundaries this repository's
own Alpha-numbered history has built, and every one follows the exact
SAME shape: a plain TypeScript interface, defined in `src/desktop/`,
imported by NOTHING under `src/runtime/`. Since `AppRuntime` is
constructed entirely via `src/runtime/create_runtime.ts` (Alpha
089/091's own original Worker/Desktop separation decision, reconfirmed
unchanged by Alpha 218 §4 one Arc ago), and that file has zero
reference to any Subscription symbol, there is no CODE PATH by which
constructing or operating `AppRuntime` could ever touch a
`FedosSubscription` value — the independence is a structural
consequence of an import graph with no edge between the two, not an
unenforced convention that could silently erode.

`FedosSubscriptionFilter` is, by NIP-01's own design, Nostr-specific
vocabulary (`ids`/`authors`/`kinds` are Nostr concepts) — exactly as
`WebSocketRelay.publish()`'s own wire mapping (Alpha 216) was
legitimately Nostr-specific INSIDE a protocol-neutral `FedosRelay`
interface. "Runtime remains protocol-independent" describes
`AppRuntime`'s own import graph, never a claim that every
`src/desktop/` type must itself be protocol-agnostic.

## 5. Structural confirmation (real inspection, this Stage)

- `grep`, case-sensitive, for `FedosSubscription`,
  `FedosSubscriptionFilter`, `buildReqMessage`, `buildCloseMessage`,
  and the string `"subscribe"`/`"unsubscribe"` in a Subscription
  sense, across `src/runtime/create_runtime.ts`, `src/runtime/types.ts`,
  `src/worker.ts`, `src/desktop/desktop_application.ts`, and
  `src/desktop/create_desktop_application.ts`: zero matches, all
  symbols, all five files.
- `package.json`'s own `dependencies` count: still 2, unchanged across
  this whole Arc (Alpha 221 §5, reconfirmed here).

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** wire the Subscription boundary into `AppRuntime`,
  `DesktopApplication`, `worker.ts`, or any Runtime/Worker construct.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_227_subscription_foundation_verification.md`
- `docs/secure_runtime_alpha_218_relay_boundary_review.md`
- `docs/secure_runtime_alpha_206_runtime_boundary_review.md`
- `docs/secure_runtime_alpha_089_desktop_runtime_separation_review.md`
- `docs/secure_runtime_alpha_221_subscription_code_review.md`
