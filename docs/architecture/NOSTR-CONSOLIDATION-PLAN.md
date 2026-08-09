# FedOS — Nostr Consolidation Plan

Status: follow-up-arc-ready plan. Pure software architecture, no legal/
compliance content. Not executed this arc by explicit decision — this
document exists so a follow-up arc can start immediately.

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
