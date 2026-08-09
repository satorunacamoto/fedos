# FedOS — Capability Catalog

Status: written this arc (Architecture Dependency Closure + Ports/Factories
Completion + OSS Catalog Completion). Pure software architecture, no
legal/compliance content. Every row below was checked against REAL current
source (`Glob`/`Grep`, this pass) — file counts, class names, and test file
names are measured, not assumed. Counts include `.ts` files only and were
taken after this arc's own internal-import-repointing sweep (see
`FACTORY-PORT-COMPLETION-PLAN.md`'s execution record).

Legend for **Standalone?**: "Yes" means the architecture boundary tests
(`test/architecture_boundary_*.test.ts`) prove no forbidden import edge
exists FROM this capability INTO another; it does not mean the capability
is reachable/usable on its own at runtime (several sub-buckets below are
explicitly inert scaffolding — see their own **Status** cell).

## `os/core`

| Field | Value |
|---|---|
| Purpose | Protocol-neutral Port CONTRACTS + general-purpose primitives (identity/crypto/settings/storage/vault) that Messenger and Commerce both may depend on, never the reverse. |
| Layer | Foundation (Ports-and-Adapters "core"). |
| Public API | `src/os/core/index.ts` (barrel, added this pass) — re-exports the 5 Port interfaces (`MessagingPort`, `ConversationPort`, `NotificationPort`, `SealingAuthorityPort`, `LocalAIProvider`) and their supporting types only. |
| Depends on | Nothing outside `os/core` itself (no relative import resolves into `os/messenger` or `os/commerce` — enforced). |
| Ports consumed | None (core is the layer that DEFINES Ports, not one that consumes another domain's). |
| Ports provided | `MessagingPort`, `ConversationPort`, `NotificationPort` (`src/os/core/ports/*.ts`, widened this pass), `SealingAuthorityPort` (Agent S, this arc), `LocalAIProvider` (interface only, zero implementations anywhere). |
| State owned | None directly by the Ports themselves (pure interfaces). `identity/`, `settings/`, `vault/`, `storage/`, `crypto/` subdirectories hold concrete state-owning classes, but most have zero production consumers (see each subdirectory's own doc comments) — `os/core/vault/wasm/` (Agent S's move) is the one exception with real production consumers (the Messenger ratchet runtimes, via `SealingAuthorityPort`). |
| Adapters | None live inside `os/core` itself — adapters implementing its Ports live in `os/messenger` (`FedosMessenger*PortAdapter`) and `os/core/vault/wasm/` (`FedosWasmMasterSeedAuthority` implements `SealingAuthorityPort`). |
| Standalone? | Yes — `test/architecture_boundary_core.test.ts` (2 tests, passing). |
| Tests | `test/architecture_boundary_core.test.ts`, `test/architecture_boundary_adapter_port_shapes.test.ts` (Port-shape checks), `test/architecture_boundary_payment_provider_shape.test.ts` (adjacent — see commerce), plus scattered `identity`/`settings`/`vault` unit tests. |
| Status | Ports are real, load-bearing contracts (widened this pass). Most of `identity/`/`settings/`/`storage/`/`vault/`/`crypto/` is pre-pivot scaffolding with few or zero production consumers — see `docs/architecture/OS-CAPABILITY-BOUNDARIES.md` and `CORE-SECRETS-OWNERSHIP-PLAN.md` for the corrected, per-directory ownership finding. |

## `os/messenger` (top level)

| Field | Value |
|---|---|
| Purpose | The shipped FedOS Desktop product's entire live surface: end-to-end encrypted Direct/group messaging over Nostr, device pairing/sync, board posting, desktop composition/packaging. |
| Layer | Domain capability (consumes `os/core` Ports where it acts as an adapter; owns everything else itself). |
| Public API | `src/os/messenger/index.ts` (barrel, added this pass) — `createMessenger()`/`Messenger`/`MessengerDependencies`, the 3 real Port adapters + dependency shapes, the 3 `Noop*Port` safe defaults. Deep internals (`conversations/`, `board/`, `device/`, `desktop/`, `notifications/`, `adapters/nostr/`) are NOT re-exported — see the barrel's own header. |
| Depends on | `os/core` (Port contracts only). Architecturally forbidden from depending on `os/commerce` (enforced). |
| Ports consumed | None internally (Messenger IS the concrete implementation behind the Ports, not a consumer of them) — its own `create_messenger.ts` accepts Port implementations only as an aggregation input. |
| Ports provided | `MessagingPort`, `ConversationPort`, `NotificationPort` (via the 3 adapters below). |
| State owned | Every durable Messenger fact: conversations, memberships, envelopes/payloads, device registry/pairing/sync, board posts, ratchet sessions, archive bundles, retention decisions — all append-only, hand-rolled persistence (no shared ORM/DB). |
| Adapters | `FedosMessengerMessagingPortAdapter`, `FedosMessengerConversationPortAdapter`, `FedosMessengerNotificationPortAdapter` (`adapters/*.ts`, widened this pass) + the consolidated Nostr adapter tree (`adapters/nostr/`). |
| Standalone? | Yes — `test/architecture_boundary_messenger.test.ts` (no relative import from Messenger resolves into Commerce). |
| Tests | ~600+ `test/secure_runtime_alpha_*.test.ts` files exercise Messenger sub-buckets individually (see sub-bucket rows below for the ones added/changed this pass). |
| Status | The real, shipped product. |

### `os/messenger/conversations` (377 files)

| Field | Value |
|---|---|
| Purpose | Direct/group conversation lifecycle: construction/draft, membership, activation, encryption/decryption, messaging (send/read/list), ratchet (forward secrecy), archive, retention, search, deletion requests. |
| Layer | Domain (Messenger sub-bucket). |
| Public API | No barrel of its own — consumed via `os/messenger/adapters/*_port_adapter.ts` (the Port seam) or directly by the desktop composition root. |
| Depends on | `os/messenger/board` (author-authority reuse), `os/messenger/adapters/nostr` (delivery), `os/messenger/desktop` (production activation wiring, one direction). |
| Ports consumed | `SealingAuthorityPort` (ratchet secret sealing, optional — `FedosDirectRatchetSealingAuthority` is a type alias of it). |
| Ports provided | Backs `MessagingPort`/`ConversationPort` via the adapters in `os/messenger/adapters/`. |
| State owned | `FedosConversationDraftRecord`, `FedosConversationMembership`, message envelopes/payloads, ratchet session state, retention decisions, archive bundles, search index. |
| Adapters | None of its own — it IS what the Port adapters delegate to. |
| Standalone? | Part of the Messenger boundary (Yes, transitively). |
| Tests | The bulk of `test/secure_runtime_alpha_7*/8*` files; this pass added/updated `test/architecture_boundary_adapter_port_shapes.test.ts` (repointed to this bucket's canonical paths) and `test/architecture_factory_composition.test.ts`. |
| Status | Real, shipped. `FedosConversationDirectMessagingCoordinator`/`FedosPrivateConversationConstructionCoordinator`/`FedosConversationMembershipAuthority` are the 3 real classes this pass's widened Ports were measured against. |

### `os/messenger/board` (85 files), `os/messenger/device` (88 files), `os/messenger/desktop` (153 files), `os/messenger/notifications` (3 files)

| Field | Value |
|---|---|
| Purpose | `board`: public post/thread runtime. `device`: pairing, relay sync, archive-suppression sync. `desktop`: the Electron-adjacent composition root, runtime config, onboarding, presentation/renderer glue, production activation. `notifications`: the real `FedosDesktopNotificationCoordinator` + its closed-vocabulary types + `FedosDesktopNotificationPort` (a SEPARATE, framework-neutral in-messenger port, not `os/core/ports/notification_port.ts` — see `ADAPTER-CATALOG.md`). |
| Layer | Domain (Messenger sub-buckets). |
| Public API | None of their own; consumed via `os/messenger/adapters/*_port_adapter.ts` or directly by the desktop composition root (`create_desktop_application.ts`). |
| Depends on | Each other + `os/messenger/adapters/nostr` + `os/messenger/conversations`. |
| Ports consumed | `notifications` backs `NotificationPort` via `FedosMessengerNotificationPortAdapter`. |
| Ports provided | See above. |
| State owned | Board posts, device registry/trust/pairing state, desktop runtime config/onboarding state, notification delivery outcome. |
| Adapters | `notifications/fedos_desktop_notification_coordinator.ts` is itself the thing `FedosMessengerNotificationPortAdapter` wraps. |
| Standalone? | Yes (transitively, part of Messenger). |
| Tests | Scattered across `test/secure_runtime_alpha_*` by era. |
| Status | Real, shipped — `desktop/beta/fedos_desktop_beta_capability_manifest.ts` (note: this ONE file still lives at the OLD top-level `src/desktop/beta/` path, not `os/messenger/desktop/beta/` — it was never migrated, it is not a shim; verified this pass) is the evidence-derived, closed-vocabulary answer to "what can the packaged Beta actually do". |

### `os/messenger/adapters` (61 files: 4 top-level + 57 under `nostr/`)

| Field | Value |
|---|---|
| Purpose | The Port-adapter seam (`messaging_port_adapter.ts`, `conversation_port_adapter.ts`, `notification_port_adapter.ts`, `noop_messenger_ports.ts` — the last two added/widened this pass) PLUS the consolidated Nostr protocol/transport/delivery implementation (`nostr/`). |
| Layer | Adapter (Ports-and-Adapters). |
| Public API | Re-exported via `os/messenger/index.ts`. |
| Depends on | `os/core/ports/*`, `os/messenger/conversations`, `os/messenger/board`, `os/messenger/notifications`. |
| Ports consumed | None (it implements Ports, doesn't consume them). |
| Ports provided | `MessagingPort`, `ConversationPort`, `NotificationPort` (real); `NoopMessagingPort`/`NoopConversationPort`/`NoopNotificationPort` (safe defaults, this pass). |
| State owned | None of its own — pure translation layer over `conversations`/`board`/`notifications` state. |
| Adapters | See `ADAPTER-CATALOG.md` for the full Nostr breakdown. |
| Standalone? | Yes. |
| Tests | `test/architecture_boundary_adapter_port_shapes.test.ts` (21 tests, widened this pass), `test/architecture_factory_composition.test.ts` (9 tests, new this pass). |
| Status | Real. The 3 Port adapters now genuinely satisfy the WIDENED Ports (read/list, createDirect/createGroup, admit/revoke/leave, readiness) against the real coordinators — not stubs. |

### `os/messenger/contacts`, `os/messenger/onion` (0 `.ts` files each — `README.md` only)

| Field | Value |
|---|---|
| Purpose | Reserved seams — `contacts`: a future contact-list capability; `onion`: Tor/onion-routing transport. |
| Layer | Reserved (no implementation). |
| Public API | None. |
| Depends on | N/A. |
| Ports consumed / provided | None. |
| State owned | None. |
| Adapters | None. |
| Standalone? | Trivially yes (empty). |
| Tests | None. |
| Status | **RESERVED / NOT IMPLEMENTED.** Do not describe as shipping. |

## `os/commerce`

| Field | Value |
|---|---|
| Purpose | Inert, pre-pivot-prototype-derived scaffolding for a future digital-goods/marketplace capability — product catalog, payment-request policy boundary, marketplace listing boundary, creator trust/entitlement shapes. |
| Layer | Domain capability (scaffolding-only today). |
| Public API | `src/os/commerce/index.ts` (barrel, added this pass) — `createCommerce()`/`Commerce`/`CommerceDependencies`, catalog/payment/marketplace types + their real Noop/InMemory implementations. `creator/`, `support/` NOT re-exported (see barrel header). |
| Depends on | `os/core` (nothing today — no real Port dependency exists yet; `createCommerce()` accepts none). Architecturally forbidden from depending on `os/messenger` (enforced) and from leaking a Telegram/BTCPay SDK specifier outside its own reserved adapter directory (enforced, currently trivial — no such SDK installed). |
| Ports consumed | None currently wired (the plan's speculative `{ payments, messaging, storage }` shape does not match real code — see `create_commerce.ts`'s own header for why `messaging`/`storage` were NOT added). |
| Ports provided | None (commerce does not implement any `os/core/ports/*` Port). |
| State owned | None durable — every "provider" is either `Noop*` (denies everything) or a pure in-memory array (`InMemoryProductDirectory`). |
| Adapters | `catalog/adapters/nostr/` (the one place commerce may touch a raw Nostr event, per its own boundary-test carve-out — repointed to the canonical `os/messenger/adapters/nostr/protocol/` location this pass); `support/adapters/telegram/` and `payment/adapters/btcpay/` are RESERVED, empty. |
| Standalone? | Yes — `test/architecture_boundary_commerce.test.ts` (2 tests, updated this pass for the Nostr-consolidation carve-out). |
| Tests | `test/architecture_boundary_commerce.test.ts`, `test/architecture_boundary_payment_provider_shape.test.ts` (new this pass), `test/architecture_factory_composition.test.ts` (new this pass). |
| Status | Inert scaffolding, not reachable from the shipped Electron app (`src/os/commerce/README.md`'s own status). `createCommerce()` (this pass) is real, safe, and constructs successfully, but nothing in the shipped product calls it. |

### `os/commerce/catalog` (8 files), `os/commerce/payment` (3), `os/commerce/marketplace` (3), `os/commerce/creator` (6), `os/commerce/support` (0, `README.md` only)

| Field | Value |
|---|---|
| Purpose | `catalog`: `Product`/`PurchaseGrant` model + `InMemoryProductDirectory`. `payment`: `PaymentProvider` seam + `NoopPaymentProvider`/`PlaceholderPaymentProvider` + pure bridge functions. `marketplace`: protocol-neutral listing seam + `NoopMarketplaceProvider`. `creator`: profile/trust/entitlement/reputation shapes (pure policy functions, no real verification). `support`: reserved Telegram ticketing seam. |
| Layer | Domain sub-buckets (all inert scaffolding per the parent row). |
| Public API | `catalog`/`payment`/`marketplace` re-exported via `os/commerce/index.ts`; `creator`/`support` are not. |
| Depends on | Each other minimally (`payment/commerce_bridge.ts` depends on `catalog/types.ts`). |
| Ports consumed / provided | None. |
| State owned | None durable. |
| Adapters | `catalog/adapters/nostr/` only (see above). `payment/adapters/btcpay/` reserved. |
| Standalone? | Yes. |
| Tests | `test/architecture_boundary_payment_provider_shape.test.ts` (new this pass, `payment/` only). |
| Status | Inert scaffolding (all five). |

## `os/_legacy_prototype` (87 files)

| Field | Value |
|---|---|
| Purpose | Dead, quarantined pre-pivot ("nostr-window") code with no deploy path — kept only because `os/commerce/catalog` still references its `AssetMetadata` type. |
| Layer | Legacy (excluded from the shippable product). |
| Public API | None — no barrel, not intended for external use. |
| Depends on | Nothing outside itself and (one direction only) into `os/commerce` (verified: no reverse edge — `test/architecture_cycle_detector.test.ts`'s own "no SCC contains any file under `os/_legacy_prototype/`" assertion). |
| Ports consumed / provided | None. |
| State owned | None reachable. |
| Adapters | None. |
| Standalone? | Yes (participates in no cycle). |
| Tests | None dedicated; covered incidentally by the cycle detector's own legacy-specific assertions. |
| Status | **DEAD CODE, QUARANTINED.** Its own README documents this. Not reachable from the shipped Electron app. |
