# FedOS — Nostr Consolidation Plan

Status: **Steps 1-4 EXECUTED** (Architecture Dependency Closure +
Ports/Factories Completion + OSS Catalog Completion arc, Agent N). Pure
software architecture, no legal/compliance content. Step 5 (duplicate
relay/transport/subscription logic) intentionally NOT attempted at scale
this pass — see "Execution record" below for exactly what landed, what's
still open, and why. The rest of this document is the ORIGINAL frozen
analysis this pass started from; it is left unedited below except where
marked, so the delta is visible.

## The three current implementations (post-Messenger-migration paths)

1. **`src/os/messenger/adapters/nostr/protocol/`** (12 files, formerly
   `src/nostr/`) — this repo's own hand-rolled Nostr primitives:
   `event.ts`, `crypto.ts`, `relay.ts`, `messages.ts`, `signature.ts`,
   `noble_signature.ts`, `ws_relay.ts`, `publish.ts`, `types.ts`, `sign/`.
   No third-party Nostr SDK dependency anywhere. Responsibility: the
   canonical wire-level event/crypto/relay TYPES and signing primitives.
2. **`src/os/messenger/desktop/` — ~24 top-level files** (formerly flat
   under `src/desktop/`): `fedos_relay.ts`, `websocket_relay.ts`,
   `node_websocket_relay_socket_factory.ts`, `fedos_event_reader.ts`,
   `fedos_event_descriptor.ts`, `fedos_nostr_wire_event.ts`,
   `fedos_subscription.ts`, `fedos_subscription_filter.ts`,
   `subscription_messages.ts`, `relay_inbound_parser.ts`,
   `nostr_event_id_verifier.ts`, `nostr_signature_verifier.ts`,
   `combined_inbound_event_validator.ts`, `null_relay.ts`,
   `null_event_reader.ts`, `nostr_public_identity_reader.ts`,
   `fedos_public_identity_reader.ts`, `static_nostr_public_identity_source.ts`,
   plus `desktop_application.ts`/`create_desktop_application.ts`. This is a
   **deliberately independent, second implementation** — `websocket_relay.ts`'s
   own header states: *"`WebSocketRelay` is a NEW, INDEPENDENT socket-transport
   type — it shares NO code, NO type, and NO import with `src/nostr/ws_relay.ts`...
   that file is REQ/EOSE/CLOSE-oriented, explicitly out of this Arc's own
   scope."* Responsibility: the actual socket transport and event-validation
   pipeline underneath `create_desktop_application.ts`, consumed by
   `desktop/host/` and `desktop/runtime/`.
3. **`src/os/messenger/adapters/nostr/{conversation_delivery,transport}/`**
   (45 files, formerly `src/conversation/delivery/nostr/` +
   `src/conversation/transport/`) — the NIP-17/NIP-59 private-delivery wire
   adapter plus outbox/publish-scheduling/relay-set/dedup transport layer.
   Responsibility: turning a Messenger `MessagePayload` into a signed,
   sealed, gift-wrapped Nostr event and getting it published/deduped/retried.

All three now live inside `src/os/messenger/adapters/nostr/` or
`src/os/messenger/desktop/` (i.e. all physically inside the Messenger
capability as of the physical migration this arc completed) — the physical
migration did NOT consolidate them into one implementation; it only moved
all three, unconsolidated, into the same capability tree. Consolidation
remains entirely undone.

## Responsibilities and duplication

| Concern | Impl 1 (`protocol/`) | Impl 2 (`desktop/` top-level) | Impl 3 (`conversation_delivery/`+`transport/`) |
|---|---|---|---|
| Event/tag/pubkey TYPES | Owns `NostrEvent`, `NostrTag` | Has its OWN parallel type, `FedosNostrWireEvent` (deliberately, "preserves NIP-01's own seven field names verbatim") | Consumes both — imports `NostrEvent` from Impl 1 in 2 files (`invitation_bootstrap/`, `ratchet/peer_capability/`, see `ADAPTER-CATALOG.md`), imports `FedosNostrWireEvent` from Impl 2 elsewhere |
| Relay socket transport | `ws_relay.ts` (REQ/EOSE/CLOSE-oriented) | `websocket_relay.ts` + `node_websocket_relay_socket_factory.ts` (explicitly independent) | Neither — delegates to Impl 2's relay stack via `desktop/host/` |
| Event validation/signature verification | `signature.ts`, `noble_signature.ts` | `nostr_event_id_verifier.ts`, `nostr_signature_verifier.ts`, `combined_inbound_event_validator.ts` | Neither — consumes Impl 2's validators |
| Publishing | `publish.ts` (has the live→`_legacy_prototype` dependency, see `CIRCULAR-DEPENDENCY-BREAK-PLAN.md`) | Not directly — delegates | `transport/`'s outbox/publish-scheduling calls into Impl 1's `publish.ts` |
| Private delivery (NIP-17/NIP-59 seal/gift-wrap) | None | None | Owns this entirely — the one concern genuinely unique to Impl 3 |

**The duplication that matters most: two competing event type representations**
(`NostrEvent` in Impl 1 vs. `FedosNostrWireEvent` in Impl 2), each with its
own signature-verification path, and messenger domain code (per this
session's own Phase 1 audit) inconsistently reaches for one or the other
depending on which file happens to import which — not a principled split.

## Logical backward dependencies (measured)

- **`src/os/messenger/adapters/nostr/protocol/sign/{fedos_nostr_signing_authority,fedos_wasm_nostr_signing_authority}.ts`
  (Impl 1) imports `FedosNostrWireEvent` from `src/os/messenger/desktop/fedos_nostr_wire_event.ts`
  (Impl 2).** This is backward relative to the "protocol primitives should
  be the dependency sink" framing — Impl 1 is supposed to be the lowest-level
  primitive layer, but one of its own files reaches UP into Impl 2's
  desktop-composition-adjacent type. This dependency existed before the
  Messenger physical migration (Agent M's Phase 1 finding: "`src/nostr/sign/`
  imports `FedosNostrWireEvent` from `../../desktop/fedos_nostr_wire_event.js`")
  and was explicitly carried forward UNCHANGED by Stage 4/Stage 6 of the
  physical migration, per each stage's own instruction not to deviate from
  the frozen mapping. It still exists today, at the new paths, unfixed.
- **`src/os/messenger/conversations/invitation_bootstrap/fedos_conversation_invitation_authentication.ts`
  and `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.ts`**
  (both domain/session-authentication code, NOT inside any of the three
  Nostr-adapter directories) import `NostrEvent`/`NostrTag` directly from
  Impl 1, converting their own normalized `FedosNostrWireEvent` (Impl 2's
  type) BACK into a raw `NostrEvent` to satisfy `NobleSignatureVerifier.verify()`'s
  signature (also Impl 1). This is the domain-type-leakage class already
  fixed once in `os/commerce` — unfixed here. See `ADAPTER-CATALOG.md`.

## Canonical location after consolidation (recommended)

**`src/os/messenger/adapters/nostr/` as the single home, internally
structured as:**

```
adapters/nostr/
  types.ts              <- the ONE event/tag/pubkey type (reconcile
                           NostrEvent vs FedosNostrWireEvent into one
                           shape — likely FedosNostrWireEvent's verbatim-
                           NIP-01-field-name design wins, since it's the
                           more deliberately-designed of the two per its
                           own header comment)
  crypto/                <- signing, verification (merge signature.ts +
                            noble_signature.ts + nostr_event_id_verifier.ts +
                            nostr_signature_verifier.ts + combined_inbound_event_validator.ts)
  transport/              <- relay.ts + ws_relay.ts + websocket_relay.ts +
                            node_websocket_relay_socket_factory.ts
                            (reconcile: keep BOTH relay implementations only
                            if they genuinely serve different protocols —
                            re-verify the "REQ/EOSE/CLOSE-oriented" vs
                            general-purpose claim before merging; if one is
                            a strict subset, delete it)
  publish.ts              <- (with the isSignedEventLike() fix from
                            CIRCULAR-DEPENDENCY-BREAK-PLAN.md applied first)
  subscription/            <- fedos_subscription.ts + fedos_subscription_filter.ts +
                            subscription_messages.ts + relay_inbound_parser.ts
  identity/                <- nostr_public_identity_reader.ts +
                            fedos_public_identity_reader.ts +
                            static_nostr_public_identity_source.ts
  conversation_delivery/   <- unchanged (Impl 3, NIP-17/NIP-59, already
                            genuinely distinct responsibility)
  event_reader/            <- fedos_event_reader.ts, fedos_event_descriptor.ts,
                            null_event_reader.ts, null_relay.ts (the
                            null-object-pattern test doubles)
```

`create_desktop_application.ts`/`desktop_application.ts` are NOT part of
this consolidation — they're composition-root code (construct a
`DesktopApplication` from concrete pieces), correctly staying in
`os/messenger/desktop/`.

## Migration order (mechanical, once a follow-up arc starts)

1. **Reconcile the type question first** (`NostrEvent` vs `FedosNostrWireEvent`)
   — this is a design decision, not a mechanical move, and every other step
   depends on it. Recommend `FedosNostrWireEvent`'s shape wins (deliberately
   designed to preserve NIP-01 field names verbatim); `NostrEvent` consumers
   (Impl 1's own `crypto.ts`/`signature.ts`, and the 2 domain-leakage files
   above) get migrated to it.
2. **Fix the 2 domain-leakage files** (`invitation_bootstrap/`,
   `ratchet/peer_capability/`) as part of step 1, not separately — once the
   type is unified, `NobleSignatureVerifier.verify()`'s signature can accept
   the unified type directly, and the awkward `toMutableNostrEvent()`
   conversion these two files currently do becomes unnecessary.
3. **Merge the relay/transport implementations**, re-verifying the
   "genuinely different protocols" claim before deleting either.
4. **Fix the backward dependency** (`sign/` → `desktop/fedos_nostr_wire_event.ts`)
   — should resolve naturally once step 1's type unification lands, since
   both sides will import the same canonical type from the same new location
   rather than reaching across the old Impl-1/Impl-2 boundary.
5. **Physically consolidate directories** last, once the above are logically
   settled — this step is the mechanical "make the file tree match the
   already-fixed import graph" pass, using the same shim-based move pattern
   validated across all 6 stages of the completed Messenger migration.

## Compatibility strategy

Same shim pattern as the completed migration: leave one-line re-export
shims at every old path throughout steps 1-4 (which touch imports, not
locations) and step 5 (which physically moves files). Given the type
reconciliation in step 1 changes actual TYPE SHAPES (not just re-exports),
shims alone won't fully insulate every caller — expect some genuine call-site
updates wherever code destructures `NostrEvent`-specific fields that don't
exist on the unified type, or vice versa. Budget real review time for step 1
specifically; it is the one step in this plan that is not purely mechanical.

## Execution record (this pass — Agent N, Architecture Dependency Closure arc)

**Steps 1-2-3-4: DONE.** Step 5: not attempted at scale, see below.

**Step 1 — re-verified before trusting the frozen analysis above, and found
one of its own premises did not hold.** Reading `NostrEvent` (`adapters/nostr/protocol/types.ts`)
and `FedosNostrWireEvent` (`desktop/fedos_nostr_wire_event.ts`) side by side:
both ALREADY used NIP-01's own verbatim field names (`id`, `pubkey`,
`created_at`, `kind`, `tags`, `content`, `sig`) — the plan's premise that
`FedosNostrWireEvent`'s design "preserves NIP-01's own field names" as a
differentiator from `NostrEvent` does not hold; `NostrEvent` already did
too. The ONE real difference: `FedosNostrWireEvent.tags` was deep-readonly
(`readonly (readonly string[])[]`), `NostrEvent.tags` was shallowly-typed
mutable (`NostrTag[]`). A repo-wide grep for in-place tag mutation
(`.tags.push/splice/pop/shift/unshift/sort/reverse(`, `tags[n] =`) found
zero call sites anywhere in `src/`, so tightening `NostrEvent.tags` to
match was a strict, safe narrowing, not a behavior change.

Decision: **`NostrEvent` at `adapters/nostr/protocol/types.ts` is now the
ONE canonical definition** (tightened to deep-readonly `tags`).
`desktop/fedos_nostr_wire_event.ts` is now a one-line type-alias re-export
(`export type { NostrEvent as FedosNostrWireEvent } from "../adapters/nostr/protocol/types.js";`)
— NOT a duplicate interface. This deliberately OVERRIDES the plan's own
suggested canonical shape-source (it recommended `FedosNostrWireEvent`'s
shape "win," which in practice meant nothing once the field-name premise
was found false) but keeps its recommended LOCATION reasoning: Step 3
needed the canonical definition under `protocol/` (see below), and once
the shapes were confirmed identical there was no reason to define it
under `desktop/` and alias backward into `protocol/`. Kept the
`FedosNostrWireEvent` NAME as an alias specifically so its ~30 existing
import sites (relay/subscription/board-publish/device-sync/conversation-
delivery code) needed zero call-site changes — only 3 files ended up
needing real edits (see Step 2/3 below), all because they held a manual,
now-redundant type-conversion function, not because the type moved.

**Step 2 — done for the 2 named files, PLUS one identical unnamed instance
found by grep.** `invitation_bootstrap/fedos_conversation_invitation_authentication.ts`
and `ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.ts`
each had a `toMutableNostrEvent()` helper converting `FedosNostrWireEvent`
back to `NostrEvent` field-by-field just to satisfy
`NobleSignatureVerifier.verify()`'s parameter type. `grep -r "function
toMutableNostrEvent"` found a THIRD, byte-identical instance the plan
didn't name: `device/binding_challenge/fedos_device_binding_account_authorization.ts`.
Fixed all three identically: deleted the helper, call `verify(event)`
directly (now type-checks with zero conversion since the two names are
one type). Two OTHER files with a superficially similar
`descriptorToNostrEvent()` helper (`device/archive_suppression_sync/fedos_archive_suppression_inbound_handler.ts`,
`device/relay_sync/fedos_device_relay_sync_inbound_handler.ts`) were
investigated and correctly LEFT ALONE — they convert from
`FedosEventDescriptor` (a genuinely different type, with RENAMED fields:
`author`/`createdAt`/`signature`, not `pubkey`/`created_at`/`sig`), not
from `FedosNostrWireEvent` — Step 1's unification doesn't touch that
conversion at all.

**Step 3 — done, and the design choice fell out of Step 1's own location
decision.** `protocol/sign/{fedos_nostr_signing_authority,fedos_wasm_nostr_signing_authority}.ts`
now import `NostrEvent` from their own `../types.ts` instead of reaching
into `desktop/fedos_nostr_wire_event.ts`. Since Step 1 put the canonical
definition under `protocol/` (not `desktop/`), this resolved by
construction rather than needing a separate design call — confirming the
plan's own conditional guidance ("if the canonical location is under
`desktop/`, move it to `protocol/` instead") by having already made that
choice in Step 1.

**Step 4 — done, and turned out simpler than "move or copy the function."**
`protocol/publish.ts` used to import `isSignedEventLike()` and
`SignedNostrEvent` from `_legacy_prototype/sign/{validate,types}.ts` (the
one live→legacy edge, per `CIRCULAR-DEPENDENCY-BREAK-PLAN.md`'s Edge 2).
Comparing `isSignedEventLike()`'s validation logic against `isNostrEvent()`
(already defined in `protocol/event.ts`) found them to be a byte-for-byte
functional duplicate — same seven fields, same hex-length checks, same
tag-shape check. Rather than moving/copying `isSignedEventLike()` as the
plan suggested, `publish.ts` now just calls the ALREADY-EXISTING
`isNostrEvent()`, and uses `NostrEvent` (canonical, structurally
compatible — `SignedNostrEvent` was itself always documented as
"structurally a NIP-01 `NostrEvent`") in place of `SignedNostrEvent`. Net
effect: zero new/copied code, and the live→legacy edge is gone entirely
(confirmed: `grep _legacy_prototype src/os/messenger/adapters/nostr/protocol/publish.ts`
now matches only the file's own doc-comment explaining the historical fix).

**Fallout fix required by Step 1 (not originally listed as its own step):**
`_legacy_prototype/sign/types.ts`'s `UnsignedNostrEvent.tags` also had to
tighten from `NostrTag[]` to `readonly (readonly string[])[]` to stay
assignable from the now-deep-readonly `NostrEvent` at one call site
(`_legacy_prototype/sign/publish_flow.ts`). Same "no caller mutates tags
in place" justification as Step 1's own main change applies. `NostrTag`
itself (`string[]`) was deliberately left mutable — only the two
interfaces' own `tags` FIELD type tightened, since `NostrTag` is still
used elsewhere as a general mutable tag-building type (e.g.
`_legacy_prototype/sign/build.ts`).

**Test fallout (3 tests, all fixed, not skipped/loosened):** three tests
did raw-source-text structural assertions that directly encoded the
PRE-unification shape (a literal `export interface FedosNostrWireEvent {
... }` declaration, or a literal `FedosNostrWireEvent` return-type
string) — `test/secure_runtime_alpha_242_validated_nostr_event_model.test.ts`,
`test/secure_runtime_alpha_426_signed_nostr_event_output_model.test.ts`,
`test/secure_runtime_alpha_448_outbox_publisher_readiness_adapter.test.ts`.
Updated (not weakened) to assert the new, stronger invariant — the
literal alias re-export syntax, and the canonical type's field shape
checked at its own new source location — rather than deleting the checks.

**Validation:** `typecheck:core` and `typecheck:electron` both at exactly
the pre-existing baseline (4 known errors in `typecheck:core`, 0 in
`typecheck:electron`) — zero new errors. All 4 architecture-boundary test
files pass. The full Nostr/nip17/nip59/signing/relay/subscription/publish
keyword-matched test set (~157 files) plus `commerce_bridge`/`commerce_classify`
were run; every remaining failure (26 across the set, all pre-existing —
`SecretHandleKind`/`HkdfDomain` variant-count snapshots stale since an
earlier NIP-44 arc, "byte-for-byte unchanged Rust source" snapshots stale
since later arcs, two tests with a stale pre-Messenger-migration relative
import-depth regex, one pure CRLF-vs-LF encoding artifact in an unrelated
release-tooling test file, and one pre-existing envelope-dedup test
failure) was individually confirmed pre-existing via a temporary, git-only
A/B worktree at HEAD (`git worktree add --detach`, removed after use)
before being left alone — never assumed.

**Step 5 — deliberately NOT attempted at scale.** Beyond the `isNostrEvent`/
`isSignedEventLike` duplicate resolved as a side effect of Step 4, the
plan's other named duplication candidates remain genuinely open and
UNAUDITED this pass:
- **Relay/transport implementations** (`protocol/ws_relay.ts` vs
  `desktop/websocket_relay.ts` + `node_websocket_relay_socket_factory.ts`)
  — the "genuinely different protocols" claim (REQ/EOSE/CLOSE-oriented vs.
  general-purpose) was NOT re-verified this pass; still needs the
  side-by-side read the original plan called for before any merge/delete
  decision.
- **Signing/serialization/event-normalization/subscription-lifecycle/
  reconnect/transport-error-handling duplication** across Impl 1/2/3 —
  not audited this pass at all.
- **Physical directory consolidation** (this plan's own Step 5,
  renumbered — physically moving files into the `adapters/nostr/{crypto,
  transport,subscription,identity,event_reader}/` tree this doc's
  "Canonical location after consolidation" section sketches) — explicitly
  OUT OF SCOPE for this arc's own binding scope note ("small, targeted
  file moves... a wholesale re-layout... is not"), and still requires the
  above audits to land first per this plan's own migration order.

A follow-up arc picking up Step 5 should start with the relay/transport
"different protocols" re-verification (cheapest to falsify or confirm),
then the signing/serialization duplication (closest in kind to what this
pass already touched), before considering any physical move.
