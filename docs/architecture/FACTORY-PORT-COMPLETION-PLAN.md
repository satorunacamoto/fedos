# FedOS — Factory / Port Completion Plan

Status: **MOSTLY EXECUTED** (Architecture Dependency Closure +
Ports/Factories Completion + OSS Catalog Completion arc, Agent F). Pure
software architecture, no legal/compliance content. See "Execution record"
below for exactly what landed, what's still open, and why. The rest of
this document is the ORIGINAL frozen analysis this pass started from; left
unedited below except where marked, so the delta is visible.

## Execution record (Agent F, this arc)

**Landed:**
- `MessagingPort`/`ConversationPort` widened exactly per this plan's own
  gap list (`read`/`list`, `admit`/`revoke`/`leave`, `readiness`,
  `createDirect`/`createGroup`, a structured `MessageSendFailureReason`/
  `MessageReadFailureReason`/`MembershipMutationResult` in place of
  stringly-typed `reason`, `replyToMessageId` support, speculative
  `attachments?` REMOVED — nothing in the repo used it). Interface
  segregation applied: `MessageSendPort`/`MessageHistoryPort`/
  `MessageInboundPort` and `ConversationCreationPort`/`ConversationQueryPort`/
  `ConversationMembershipPort`/`ConversationReadinessPort`, composed back
  into the existing `MessagingPort`/`ConversationPort` names.
  `NotificationPort`'s own doc comment widened to state the
  title/body-non-forwarding gap (adapter already documented it; the Port
  signature itself did not).
- All 3 existing Port adapters (`messaging_port_adapter.ts`,
  `conversation_port_adapter.ts`, `notification_port_adapter.ts`) updated
  in the same pass to genuinely satisfy the widened interfaces against the
  REAL coordinators (`FedosConversationDirectMessagingCoordinator`,
  `FedosPrivateConversationConstructionCoordinator`,
  `FedosConversationMembershipAuthority`) — verified via
  `test/architecture_boundary_adapter_port_shapes.test.ts` (21 tests) and
  full `typecheck:core`/`typecheck:electron`.
- `PaymentProvider` shape test added
  (`test/architecture_boundary_payment_provider_shape.test.ts`, 8 tests) —
  the gap this plan and `COMMERCE-ARCHITECTURE.md` both flagged.
  **`PaymentProvider` itself was NOT redesigned** — the invoice/payment
  identity field, status-polling method, webhook/callback ingestion,
  idempotency key, and refund/expiry states this plan's own "not
  BTCPay-ready" section names are all still absent. Out of scope for this
  pass; the shape test only proves the CURRENT interface is genuinely
  implementable, not that it's complete for a real rail.
- `createMessenger()`/`createCommerce()` both implemented
  (`src/os/messenger/create_messenger.ts`, `src/os/commerce/create_commerce.ts`)
  — took option (b) from this plan's own instruction for `createMessenger()`:
  no `TransportPort` was added (confirmed: Agent N's Nostr type
  unification did NOT create an injection seam a second transport could
  use — the real pipeline is still hard-wired to Nostr-shaped delivery
  internals); the factory instead accepts the 3 widened core Ports
  directly, with `storage` deliberately OMITTED (not merely defaulted) —
  see that file's own header for why. `createCommerce()`'s field names
  were VERIFIED against real code rather than copied from this plan's
  speculative `{ payments, messaging, storage }` snippet — neither
  `messaging` nor `storage` is consumed by any real `os/commerce` code
  today, so `CommerceDependencies` is `{ catalog?, payments?, marketplace? }`
  instead. Both factories default every omitted dependency to a safe
  `Noop*`/empty implementation (`noop_messenger_ports.ts`, new this pass) —
  zero external contact by default, verified by
  `test/architecture_factory_composition.test.ts` (9 tests).
- Public API barrels added: `src/os/core/index.ts`,
  `src/os/messenger/index.ts`, `src/os/commerce/index.ts` — re-export
  factories + Port/contract types + each capability's real public surface
  only. Cycle detector re-run after each addition; zero new SCCs.
- `docs/architecture/CAPABILITY-CATALOG.md`, `ADAPTER-CATALOG.md`,
  `ADDING-A-CAPABILITY.md`, `ADDING-AN-ADAPTER.md` (with a real, running,
  4/4-passing worked example, `test/example_fake_transport_adapter.test.ts`)
  all added this pass.
- Dependency-rule regression guards added for the 3 rules that had no
  dedicated test: domain -> Electron-concrete, domain -> third-party-
  Nostr-SDK, protocol -> desktop-concrete
  (`test/architecture_dependency_rules_electron_nostrsdk_protocol.test.ts`,
  5 tests) — the last one also serves as a fresh regression-guard
  confirming Agent N's backward-dependency fix (`protocol/sign/*.ts` no
  longer imports from `desktop/`) holds.
- Internal old-path-import sweep: **811 of 811** known compatibility
  shims (764 Messenger-migration + 43 Core-extraction + a handful from
  Agent S's `master_seed` move) had every REPO-INTERNAL importer
  (`src/`, `test/`) repointed to the canonical location — before: 6,596
  old-path import occurrences across 1,144 files; after: **0**. The shim
  files themselves were left completely untouched (any external/unknown
  consumer keeps resolving). One follow-on fix was required:
  `test/architecture_boundary_commerce.test.ts`'s own Nostr carve-out
  check recognized only the OLD `src/nostr/` path — widened to also
  recognize the NEW canonical `os/messenger/adapters/nostr/protocol/`
  location once `os/commerce/catalog/adapters/nostr/{bridge,classify}.ts`'s
  own imports were repointed there.
- Validation: `typecheck:core`/`typecheck:electron` stayed at the
  documented 4/0 pre-existing-error baseline through every step (checked
  after each significant change, not just at the end). All boundary +
  cycle-detector + new tests pass (56 tests across the 8 architecture
  test files, plus the 4-test worked example). A representative slice of
  real Messenger vertical-slice/failure-matrix/structural-guard tests was
  run; several pre-existing failures were found (`"unsupported-runtime"`
  WASM/NODE_ENV-environment failures, and structural-guard tests that
  `readFileSync` an old shim path expecting REAL source text) — each was
  confirmed pre-existing, NOT caused by this pass, by swapping the
  affected test file back to its exact `git show HEAD` content and
  re-running: identical failures reproduce with zero changes from this
  pass in place.

**Deferred (this pass did not attempt):**
- A real `TransportPort` and the Nostr-transport rewiring behind it — per
  this plan's own "genuinely new design work, not a refactor" framing.
- `PaymentProvider`'s own redesign (invoice identity, status polling,
  webhooks, idempotency, refund/expiry).
- `StorageBackend`'s placeholder-vs-real disposition (still reserved, per
  `CORE-SECRETS-OWNERSHIP-PLAN.md`) — `createMessenger()`/`createCommerce()`
  both deliberately omit it rather than accept-and-ignore it.
- Promoting `PaymentProvider` into `os/core/ports/` (stays commerce-local;
  `createCommerce()`'s own header explains why this pass didn't need to
  resolve that question to still ship a real, honest factory).

## The target usage this plan works toward

```ts
const commerce = createCommerce({
  payments: new MyPaymentAdapter(),
  messaging: new MyMessagingAdapter(),
  storage: new MyStorageAdapter(),
});

const messenger = createMessenger({
  transport: new MyTransportAdapter(),
  storage: new MyStorageAdapter(),
});
```

## Current state: NOT YET achievable, for different reasons per factory

### `createMessenger({ transport, storage })` — blocked mainly on `transport`

**No `TransportPort` exists anywhere in `src/os/core/ports/`.** The three
real Ports (`MessagingPort`, `ConversationPort`, `NotificationPort`) are
OUTBOUND-facing (what a Commerce-side consumer gets FROM Messenger), not
INBOUND-facing (what Messenger itself would accept as a pluggable
transport). The real messaging pipeline
(`FedosConversationDirectMessagingCoordinator`, now at
`os/messenger/conversations/messaging/`) is hard-wired to Nostr-shaped
delivery internals (`ratchetDelivery`, NIP-17 routes) — there is no
injection seam a second, non-Nostr transport could plug into today.

### `createCommerce({ payments, messaging, storage })` — blocked on aggregation, not injection

Individually, every real class checked (`InMemoryProductDirectory`,
`NoopPaymentProvider`, `PlaceholderPaymentProvider`, `NoopMarketplaceProvider`)
already takes dependencies via constructor parameters with zero module-level
singletons (`export const ... = new ...` returns zero hits under
`src/os/commerce/**`). **The individual pieces are already injectable-style.**
What's missing is a `Commerce` aggregate type/class that composes
catalog+payment+marketplace+creator into one object a factory could
construct and return — no such type exists anywhere in
`src/os/commerce/**` today (checked: zero matches for
`class.*Commerce`/`interface.*Commerce`).

## Missing/inadequate Port contracts (measured against the real coordinators)

### `MessagingPort` (`send`, `onMessage`) vs. real
`FedosConversationDirectMessagingCoordinator` (`sendDirectMessage`,
`readDirectMessage`, `listDirectMessages`)

- **No read, no list.** A consumer cannot fetch message history through
  this Port — only send.
- **`replyToEnvelopeId` is dropped.** `FedosMessengerMessagingPortAdapter.send()`
  hardcodes `replyToEnvelopeId: null` even though the real coordinator
  supports threaded replies — **reply threading is entirely unmodeled.**
- **~9 real outcome codes collapse into one opaque `reason: string`.** The
  real coordinator's closed outcome set (`invalid-input`,
  `conversation-not-found`, `conversation-not-active`,
  `identity-unavailable`, `unauthorized`, `encryption-unavailable`,
  `persistence-failed`, `failed`, `sent-locally` w/ optional
  `delivery`/`forwardSecrecy`) is not representable by a caller
  programmatically.
- **`MessagePayload.attachments?` is speculative** — no attachment concept
  exists anywhere in the real coordinator; this field isn't grounded in
  real code and should either be removed or explicitly marked aspirational.
- **Forward secrecy is invisible.** The delivery-route/forward-secrecy
  dimension (actively developed — this repo's own recent "Conversation
  Forward Secrecy Phase 1" work) has zero representation in the Port.
- **`onMessage` is currently unfireable dead code** — `dispatchInbound()`,
  the method meant to feed registered handlers, is called by nothing in
  production; there is no live push-based inbound observer anywhere in the
  current pipeline (`FedosPrivateNostrInboundDeliveryCoordinator.receivePrivateEvent()`
  is a pull/dispatch model with no listener registry of its own).

### `ConversationPort` (`createOrResolve`, `listParticipants`) vs. real
`FedosPrivateConversationConstructionCoordinator` + `FedosConversationMembershipAuthority`

- **No direct/group distinction** — real construction has two separate
  entrypoints (different validation, different fanout); the Port flattens
  both into one `createOrResolve(counterparty: string)`.
- **No membership mutation at all** — `admit`/`revoke`/`leave` (real,
  load-bearing operations) have no Port equivalent. A Commerce consumer
  could create a conversation but never remove itself or a counterparty.
- **No readiness/draft lifecycle** — real conversations pass through
  draft → readiness-checked → active states; the Port presents
  conversations as either fully resolved or not.

### `NotificationPort.notify(title, body, meta)` — honestly under-shaped, not silently lossy

The one Port that documents its own limitation rather than hiding it: the
real `FedosDesktopNotificationCoordinator` enforces a CLOSED vocabulary of
`kind`s with FIXED templates specifically to keep message content out of
the OS tray, so `title`/`body` are never actually forwarded — only
`meta.kind` matters. The interface SIGNATURE is still misleading (a reader
would assume free-text `title`/`body` reach the user), but the adapter's
own doc comments are honest about the gap. Recommend widening the doc
comment on the Port itself, not just the adapter, so the gap is visible
without reading the implementation.

### `PaymentProvider` (`os/commerce/payment/types.ts`) — good for onboarding, not BTCPay-ready

Not one of the 4 `os/core/ports/` Ports (it's commerce-owned), but named
as a peer concept (`payments`) in the target `createCommerce()` signature,
so included here. Missing for a real payment-rail adapter: an
invoice/payment identity field on `PaymentDecision` (nothing to key a
later status check against), a status-polling method, a
webhook/callback-ingestion method, an idempotency key on `PaymentRequest`,
and refund/expiry states in `PaymentStatus`. Full detail already in
`docs/architecture/COMMERCE-ARCHITECTURE.md`.

## Adapter changes needed

- **New: `TransportPort`** in `os/core/ports/` — the biggest single gap.
  Design against what `FedosConversationDirectMessagingCoordinator`'s
  delivery layer actually needs (NIP-17 route selection, ratchet-vs-static
  delivery choice, publish/ack/retry) generalized enough that a
  non-Nostr transport could plausibly implement it — this requires real
  design work, not a mechanical extraction, since today's code has never
  been written against an abstraction boundary at this seam.
- **Widen `MessagingPort`**: add `read`/`list`, a structured (not
  stringly-typed) failure-reason union mirroring the real coordinator's
  closed outcome set, `replyToEnvelopeId` support, and either remove
  `attachments?` or explicitly mark it aspirational with a comment. This
  is a BREAKING change to the 3 existing Port adapter files
  (`os/messenger/adapters/*_port_adapter.ts`) — budget for updating them
  in the same pass.
- **Widen `ConversationPort`**: add direct/group distinction, membership
  mutation (`admit`/`revoke`/`leave`), and draft/readiness visibility.
- **Promote `PaymentProvider` into `os/core/ports/`**, or explicitly
  document why it stays commerce-local while `messaging`/`transport`/`storage`
  live in core — the target snippet treats them as peers; today's code
  doesn't.
- **Resolve `StorageBackend`'s status** — `os/core/storage/types.ts`'s
  `StorageBackend` is explicitly a placeholder ("packets carry OPAQUE,
  non-secret labels ONLY — never raw bytes... no implementation performs
  real storage in this stage"), unsuited to real injection as written.
  This should be resolved together with `CORE-SECRETS-OWNERSHIP-PLAN.md`'s
  `os/core/storage` disposition decision (delete / wire to a real
  extraction / relabel reserved) — the SAME seam both plans need settled.

## Public API shape (recommended)

Follow the one existing precedent already in this repo:
`src/os/messenger/desktop/create_desktop_application.ts`'s
`createDesktopApplication()` — "mirrors `createRuntime()`'s own naming and
scoping discipline" per its own doc comment. Neither existing factory
takes injected ADAPTER instances the way the target snippet does (both
construct their ~20 dependencies internally or take an optional data
snapshot) — this arc's target functions would be the first in the
codebase to take real injected Port implementations as constructor
arguments, not just a naming-convention follow, so this is genuinely new
design work, not a refactor of an existing pattern.

```ts
// os/commerce/create_commerce.ts (new file, does not exist today)
export interface CommerceDependencies {
  readonly payments: PaymentProvider;      // or a promoted core Port
  readonly messaging: MessagingPort;       // widened per above
  readonly storage: StorageBackend;        // once its placeholder status
                                            // is resolved per CORE-SECRETS-
                                            // OWNERSHIP-PLAN.md
}
export interface Commerce {               // NEW aggregate type, doesn't exist
  readonly catalog: ProductDirectory;      // or similar existing class
  readonly payments: PaymentProvider;
  // ...
}
export function createCommerce(deps: CommerceDependencies): Commerce { ... }
```

```ts
// os/messenger/create_messenger.ts (new file, does not exist today)
export interface MessengerDependencies {
  readonly transport: TransportPort;       // NEW Port, doesn't exist yet
  readonly storage: StorageBackend;
}
export interface Messenger {              // NEW aggregate type, doesn't exist
  readonly conversations: ConversationPort;
  readonly messaging: MessagingPort;
}
export function createMessenger(deps: MessengerDependencies): Messenger { ... }
```

## Standalone composition tests needed

Once the factories exist, add tests mirroring
`test/architecture_boundary_adapter_port_shapes.test.ts`'s pattern (type-
and runtime-checking a hand-built double against each Port) but for the
FACTORIES themselves:

1. `createCommerce()` with all-fake adapters constructs successfully and
   returns a `Commerce` whose methods are callable without throwing.
2. `createMessenger()` with all-fake adapters, same shape.
3. A `PaymentProvider` conformance test (the gap `COMMERCE-ARCHITECTURE.md`
   and this plan's Port-review section both flag — currently
   `MessagingPort`/`ConversationPort`/`NotificationPort` have a shape test,
   `PaymentProvider` does not).
4. The composition-status table in `CIRCULAR-DEPENDENCY-BREAK-PLAN.md`'s
   sibling doc, `CAPABILITY-MAP.md`, currently marks "Commerce + custom
   `PaymentProvider`" as the ONE composition that already works today
   manually — turn that manual proof into an automated test as part of
   this work, don't just leave it as a documented claim.

## Sequencing relative to the other three plans

Per `CIRCULAR-DEPENDENCY-BREAK-PLAN.md`'s "Recommended migration order for
a combined follow-up arc": this plan runs LAST, because it depends on:
- `NOSTR-CONSOLIDATION-PLAN.md`'s canonical Nostr location (for
  `TransportPort`'s real implementation to be built against something
  stable).
- `CORE-SECRETS-OWNERSHIP-PLAN.md`'s `os/core/storage` disposition (for
  `storage` to be a real, meaningful injected dependency rather than a
  placeholder that carries no bytes).

A 4-agent follow-up arc should hold this plan's work for a later agent
slot once the other two are far enough along, per the sequencing already
laid out in `CIRCULAR-DEPENDENCY-BREAK-PLAN.md`.
