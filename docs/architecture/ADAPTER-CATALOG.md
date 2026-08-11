# FedOS — Adapter Catalog

Status: written this arc (Architecture Dependency Closure + Ports/Factories
Completion + OSS Catalog Completion). Pure software architecture, no
legal/compliance content. Describes the CURRENT state of every real
adapter in the repo, plus every RESERVED (not-yet-implemented) seam —
each explicitly labeled so neither is mistaken for the other. Checked
against real source this pass; supersedes any adapter description in
`FACTORY-PORT-COMPLETION-PLAN.md` that predates Agents C/N/S's landed
work.

## Real, implemented adapters

### The three `os/core/ports/*` Port adapters (`src/os/messenger/adapters/*_port_adapter.ts`)

| Adapter | Implements | Delegates to (real, canonical path) | Notes |
|---|---|---|---|
| `FedosMessengerMessagingPortAdapter` | `MessagingPort` (widened this pass: `send`/`read`/`list`/`onMessage`) | `FedosConversationDirectMessagingCoordinator` (`os/messenger/conversations/messaging/`) | `send()` maps the coordinator's 9-outcome closed vocabulary to `MessageSendFailureReason`; `read()`/`list()` are NEW this pass (previously absent); `onMessage()`/`dispatchInbound()` remain an honestly-documented registered-but-never-fired gap (no live inbound subscription exists yet). |
| `FedosMessengerConversationPortAdapter` | `ConversationPort` (widened this pass: `createDirect`/`createGroup`/`listParticipants`/`admit`/`revoke`/`leave`/`readiness`) | `FedosPrivateConversationConstructionCoordinator` + `FedosConversationMembershipAuthority` (both `os/messenger/conversations/`) | `admit`/`revoke`/`leave`/`readiness` are NEW this pass. `identityResolver`/`draftPersistence`/`clock` are OPTIONAL constructor deps — omitted, `leave()` returns `unavailable` and `readiness()` returns `null` rather than guessing. |
| `FedosMessengerNotificationPortAdapter` | `NotificationPort` | `FedosDesktopNotificationCoordinator` (`os/messenger/notifications/`) | Deliberately never forwards caller-supplied `title`/`body` — routes through `meta.kind`'s closed vocabulary only. Both the Port's own doc comment (widened this pass) and this adapter's doc comment now state the gap. |

All three now import their coordinator/authority dependencies from the
CANONICAL post-migration location (`os/messenger/conversations/...`,
`os/messenger/notifications/...`), not the old top-level compatibility
shims (`src/conversation/...`, `src/desktop/notification/...`) — repointed
this pass (see `FACTORY-PORT-COMPLETION-PLAN.md`'s execution record for
the full internal-import sweep).

### Safe Noop defaults (`src/os/messenger/adapters/noop_messenger_ports.ts`)

`NoopMessagingPort`, `NoopConversationPort`, `NoopNotificationPort`, and
`NoopTransportPort` (added Compatibility Facade Reduction + Package
Extraction Readiness + Remaining Architecture Debt Closure arc, Agent P) —
every method total, never throws, zero external contact. Exist so
`createMessenger()` (`src/os/messenger/create_messenger.ts`) has a
genuinely safe default for any Port a caller omits.

### `TransportPort` adapter (`src/os/messenger/adapters/nostr_transport_adapter.ts`, Agent P this arc)

| Adapter | Implements | Delegates to (real, stable entry points only) | Notes |
|---|---|---|---|
| `NostrTransportAdapter` | `TransportPort` (`send`/`subscribe`/`connect`/`disconnect`/`status`) | `RelayPublisher` (`adapters/nostr/protocol/publish.ts`) for write, `RelayAdapter` (`adapters/nostr/protocol/relay.ts`) for read — both STABLE interfaces this adapter is handed a concrete implementation of, never `ws_relay.ts`/`FedosRelay`/`FedosConversationRelaySet` directly (Agent N concurrency note, this arc). | Never chooses a Nostr `kind`, never signs, never decides public-vs-private — all delegated to an injected `NostrTransportEventSource` the composition root supplies. `subscribe()` is honestly poll-based (`RelayAdapter.query()` has no push primitive), gated on `connect()`'s logical "armed" flag since neither `RelayPublisher` nor `RelayAdapter` exposes a real persistent-socket state to this adapter. `pollOnce()` (test-only) mirrors `dispatchInbound()`'s "test-callable escape hatch" precedent. |

Proven against `TransportPort` two ways: type-level `implements` plus a
runtime shape/behavior check against hand-built `RelayPublisher`/
`RelayAdapter`/`NostrTransportEventSource` doubles
(`test/architecture_boundary_adapter_port_shapes.test.ts`, 9 new tests),
and a from-scratch `FakeTransportPortAdapter` worked example proving
`createMessenger({ transport: fake })` constructs and is usable
(`test/example_fake_transport_adapter.test.ts`, 4 new tests).

### `SealingAuthorityPort` implementers (Agent S, this arc's earlier phase)

| Implementer | Location | Notes |
|---|---|---|
| `FedosWasmMasterSeedAuthority` | `src/os/core/vault/wasm/fedos_wasm_master_seed_authority.ts` (moved from `src/runtime/master_seed/` this arc; old path now shimmed) | The real production WASM-backed sealing authority. `sealDirectRatchetSecret`/`restoreDirectRatchetSecret` — AEAD-sealed, fails closed on any binding-tuple mismatch (wrong local/remote Device, Conversation, or generation), never a string comparison. |
| `FedosProductionMasterSeedAuthority` | `src/os/messenger/desktop/production_activation/fedos_production_master_seed_authority.ts` | Also implements `SealingAuthorityPort` additionally, alongside its own separate `FedosMasterSeedAuthority` contract. Lives inside `os/messenger/desktop/` (intra-domain — not a boundary issue). |

`DevelopmentFedosMasterSeedAuthority` deliberately does NOT implement this
Port, matching its own narrow, opt-in, "unavailable is a valid state"
discipline — consumers hold `SealingAuthorityPort | null`.

### Nostr adapter tree (`src/os/messenger/adapters/nostr/`, 57 files) — CONSOLIDATED type, NOT yet consolidated directories

Per `docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`'s execution record
(Agent N, this arc's earlier phase): the event-type duplication (`NostrEvent`
vs. `FedosNostrWireEvent`) is RESOLVED — `NostrEvent`/`FedosNostrWireEvent`
are now one canonical type at
`src/os/messenger/adapters/nostr/protocol/types.ts`
(`src/os/messenger/desktop/fedos_nostr_wire_event.ts` is now a type alias,
not a second definition), and the previously-documented backward
dependency (`protocol/sign/*.ts` importing `FedosNostrWireEvent` from
`desktop/fedos_nostr_wire_event.ts`) is fixed — both `sign/` files now
import `NostrEvent` from their own sibling `protocol/types.ts` (verified
fresh this pass, and pinned by
`test/architecture_dependency_rules_electron_nostrsdk_protocol.test.ts`'s
new "protocol -> desktop-concrete forbidden" regression guard).

What remains NOT done: the three sub-implementations below still live in
**physically separate directories** — the type unification did not trigger
a directory-level merge, and the plan's own migration order names that as
deliberately LAST, once the logical fixes are stable.

| Sub-tree | Files | Responsibility | Consolidation state |
|---|---|---|---|
| `protocol/` | 12 | Canonical wire-level event/crypto/relay types + signing primitives. No third-party Nostr SDK anywhere (enforced — `test/architecture_dependency_rules_electron_nostrsdk_protocol.test.ts`). | Type-unified (this arc). Directory-canonical home for `NostrEvent`. |
| `conversation_delivery/` (incl. `nip17/`) | 24 | NIP-17/NIP-59 gift-wrap/seal private-delivery wire adapter — turns a `MessagePayload` into a signed, sealed, gift-wrapped event. | Genuinely distinct responsibility from the other two; not slated for merging, only for staying under the same parent. |
| `transport/` (incl. `relay/`) | 21 | Outbox/publish-scheduling, relay-set/dedup transport plumbing. | Still a logically separate relay/socket implementation from `os/messenger/desktop/`'s own `websocket_relay.ts` — the "genuinely different protocols" claim (REQ/EOSE/CLOSE-oriented vs. general-purpose) is documented but not re-verified this pass; see `NOSTR-CONSOLIDATION-PLAN.md` step 3 (not attempted). |

A SEPARATE, independent second relay/event-validation implementation
still lives in `os/messenger/desktop/` (`websocket_relay.ts`,
`fedos_event_reader.ts`, `combined_inbound_event_validator.ts`, etc.) —
deliberately independent per that code's own header, consumed by
`desktop/host/`/`desktop/runtime/`. Not merged with `adapters/nostr/` this
pass or any prior pass.

### `os/commerce/catalog/adapters/nostr/` (2 files: `bridge.ts`, `classify.ts`)

The ONE place `os/commerce` is allowed to import the Nostr protocol layer
directly (`productFromEvent`, event classification) — both files were
repointed this pass from the old `src/nostr/types.ts` shim to the
canonical `os/messenger/adapters/nostr/protocol/types.ts`, and
`test/architecture_boundary_commerce.test.ts`'s own carve-out check was
updated to recognize both the old and new location so the boundary test
keeps passing without silently widening what commerce may import.

## Reserved / NOT IMPLEMENTED adapter seams

| Seam | Location | Status |
|---|---|---|
| Telegram support channel adapter | `src/os/commerce/support/adapters/telegram/` (directory exists, 0 `.ts` files) | **RESERVED.** No Telegram SDK dependency installed anywhere in this repo (enforced by `test/architecture_boundary_commerce.test.ts`'s SDK-leak check). Do not describe as implemented. |
| BTCPay payment rail adapter | `src/os/commerce/payment/adapters/btcpay/` (directory exists, 0 `.ts` files) | **RESERVED.** No BTCPay SDK dependency installed anywhere in this repo (same enforced check). `PaymentRail`'s `"lightning_placeholder"` etc. are labels of future intent only — see `src/os/commerce/payment/types.ts`'s own header. |
| Contacts capability | `src/os/messenger/contacts/` (`README.md` only) | **RESERVED / NOT IMPLEMENTED.** |
| Onion/Tor transport | `src/os/messenger/onion/` (`README.md` only) | **RESERVED / NOT IMPLEMENTED.** Per prior arc findings (see this repo's own memory of "onion corpus is 6,050 lines of zero code" from an earlier review), no working onion-routing code exists anywhere reachable from the shipped app. |
| `TransportPort` | `src/os/core/ports/transport_port.ts` | **IMPLEMENTED** (Compatibility Facade Reduction + Package Extraction Readiness + Remaining Architecture Debt Closure arc, Agent P) — see that file's own header for the design, `src/os/messenger/adapters/nostr_transport_adapter.ts` for a real Nostr adapter (`NostrTransportAdapter`), and `createMessenger()`'s own header for what `transport` is (and is not yet) wired to: the Port and a real adapter exist and are independently usable/testable, but the real messaging pipeline (`FedosConversationDirectMessagingCoordinator`) still does NOT consume it — it stays hard-wired to its own Nostr-shaped delivery internals. Moved out of the table below into the "Real, implemented adapters" section. |
| `LocalAIProvider` | `src/os/core/ports/local_ai_provider.ts` (interface only) | **RESERVED / NOT IMPLEMENTED.** Zero implementations anywhere in the repo. |

## Framework-neutral, NON-`os/core`-Port adapter (for disambiguation)

`FedosDesktopNotificationPort` (`src/os/messenger/notifications/fedos_desktop_notification_port.ts`)
is a SEPARATE, Messenger-internal, framework-neutral port ("shows one
already-built `FedosDesktopNotificationView`") — NOT the same interface as
`os/core/ports/notification_port.ts`'s `NotificationPort`. Its own
`NoopFedosDesktopNotificationPort` is a different class from this pass's
`NoopNotificationPort`. Mentioned here only to prevent confusing the two
when reading `os/messenger/notifications/`.
