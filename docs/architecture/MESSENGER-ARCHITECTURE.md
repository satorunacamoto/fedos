# FedOS Messenger — Capability Boundary

Status: architecture draft accompanying this arc's scaffolding + Port
adapters. Describes the target shape of the `os/messenger` capability, most
of which has not physically moved yet — see
`docs/architecture/MESSENGER-MIGRATION-MAPPING.md` (the complete file-by-file
mapping) and `docs/architecture/MESSENGER-MIGRATION-STAGING.md` (the
proposed move order) for the mechanics of getting there.

No legal/compliance/regulatory content — this document is pure software
architecture.

## What "Messenger" is

Everything the shipped FedOS application uses to let one FedOS identity
exchange private messages with another over Nostr, plus the federated
social posting feature (Board) and the device pairing/sync machinery that
supports both. Concretely, today, under these five directories:

- `src/conversation/` (422 files) — conversation construction, membership,
  readiness, encryption/identity resolution, envelope, Double Ratchet
  session state, group pairwise fanout, NIP-17/NIP-59 private delivery wire
  adapter, transport/outbox, persistence, payload storage, archive, search,
  retention, deletion (+ deletion requests), capability (invitation
  redemption), identity transition (key rotation continuity).
- `src/board/` (85 files) — public Nostr/ActivityPub/AT-proto posting.
  Federated social, not direct messaging — but a deliberate product
  decision keeps it inside `os/messenger` as Messenger's own social/
  federated sub-capability, not a separate top-level `os/` capability.
- `src/desktop/` (157 files) — the Electron-facing composition layer:
  shell, the one Runtime assembly point, `host_boundary`
  (`FedosDesktopHostPort`, already a framework-neutral host contract),
  notification (the LIVE coordinator — not the dormant top-level
  `src/notification/`, quarantined separately by a different agent),
  background lifecycle, badge, tray, onboarding, settings, presentation,
  renderer, production activation, the Beta capability manifest.
- `src/device/` (88 files) — device identity/pairing/sync: binding
  challenge, relay sync, persistence, sync events/package/scheduler/
  session, transfer.
- `src/nostr/` (12 files) — this repo's own low-level Nostr protocol
  primitives (event/crypto/relay/signature/message types, signing
  authority). No third-party Nostr SDK anywhere in this codebase.

`packages/fedos-desktop-electron-spike/` (the Electron composition root —
main/preload/renderer trios) stays a sibling package, never moving into
`src/os/` — it has its own `tsconfig`/`package.json` and is deliberately
isolated per existing repo convention; nothing in this arc changes that.

## Target shape: `src/os/messenger/`

```
src/os/messenger/
  conversations/        <- src/conversation/** (minus delivery/nostr, transport)
  contacts/              (RESERVED pointer only — see below)
  device/                <- src/device/**
  board/                  <- src/board/**
  adapters/
    messaging_port_adapter.ts        (real, working — this arc)
    conversation_port_adapter.ts     (real, working — this arc)
    notification_port_adapter.ts     (real, working — this arc)
    nostr/                <- src/nostr/** + conversation/delivery/nostr/** + conversation/transport/**
  notifications/          <- src/desktop/notification/**
  desktop/                <- the rest of src/desktop/**
  onion/                  (RESERVED, empty — no onion-routing code exists anywhere in this repo)
```

Every subdirectory listed with a `<-` is scaffolding only today — an empty
directory holding one `README.md` that names its mapping. See each
README for the reasoning specific to that bucket; two decisions are worth
restating here because they're the ones a reader is most likely to
second-guess:

### Why `conversations/` is one bucket, not split into "messages" vs. "conversations"

The kickoff prompt for this arc explicitly allowed keeping `conversation/`
as one cohesive bucket if the real code doesn't cleanly separate. It
doesn't: `messaging/fedos_conversation_direct_messaging_coordinator.ts`
alone composes over envelope, construction/activation, membership,
encryption (+ identity), retention, payload_storage, ratchet, and the
NIP-17 delivery wire adapter, in one file. Every other feature-layer
subtree (archive, deletion, identity_transition, invitation) has a similar
web of internal dependencies. Splitting this into artificial top-level
buckets would rename the coupling across a longer relative-import path
without removing any of it.

### Why `contacts/` is empty rather than holding `encryption/identity/`

Measured: 22 files inside `src/conversation/**` import from
`encryption/identity/` (the participant/identity/counterparty/key
resolvers — this codebase's closest thing to "contacts"); exactly 1 file
outside it does
(`src/desktop/runtime/fedos_desktop_runtime_config.ts`). The real audience
for this code is `conversations/` itself. It stays nested at
`conversations/encryption/identity/**`; `contacts/` is a documented,
reserved pointer — see `src/os/messenger/contacts/README.md` for the full
analysis and the condition under which a future arc should revisit this.

### Why `onion/` is empty

No Tor/onion-routing implementation exists anywhere in this repository —
only design-notes documentation (a prior arc's own finding: "onion corpus
is 6,050 lines of zero code"). This is a reserved seam for a future arc,
not a stub implying partial support.

## The Port adapters (real, working, delegating to unmoved code)

`src/os/messenger/adapters/{messaging,conversation,notification}_port_adapter.ts`
implement the three seams defined in `src/os/core/ports/` (owned by a
concurrent agent in this same arc):

| Port | Adapter delegates to (unmoved, real) |
|---|---|
| `MessagingPort` | `FedosConversationDirectMessagingCoordinator` (`src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts`) |
| `ConversationPort` | `FedosPrivateConversationConstructionCoordinator` + `FedosConversationMembershipAuthority` (`src/conversation/construction/`, `src/conversation/membership/`) |
| `NotificationPort` | `FedosDesktopNotificationCoordinator` (`src/desktop/notification/fedos_desktop_notification_coordinator.ts`) |

Each adapter class declares `implements <Port>` — `npm run typecheck:core`
is itself the strongest proof each one genuinely satisfies its Port; see
`test/architecture_boundary_adapter_port_shapes.test.ts` for an additional,
explicit, runtime-checked version of the same claim against hand-built test
doubles (the real coordinator classes use ECMAScript `#private` fields,
which block structural typing, so a genuine instance would require
assembling each coordinator's full production dependency graph — that
wiring is the composition root's job, today `src/desktop/runtime/`, not an
adapter-shape test's job).

These adapters exist to prove one thing concretely: **`os/commerce` can
depend on `os/core/ports/*` today, without waiting for the physical file
move.** Every adapter imports the real coordinator class via a relative
path back into its still-current location; once the physical migration
(staging doc) actually moves that coordinator, only the adapter's own
import path changes — its logic does not.

Two adapter design notes worth a reader's attention, both documented in
the adapter files themselves:

- **`MessagingPort.onMessage` has no live producer yet.** There is no
  push-based "a message arrived" observer anywhere in the current inbound
  pipeline — `FedosPrivateNostrInboundDeliveryCoordinator.receivePrivateEvent()`
  is called once per already-validated inbound Nostr event by whatever
  polls/subscribes the relay, with no listener registry of its own. The
  adapter is honest about this: `onMessage()` registers real handlers, and
  a separate, non-Port method `dispatchInbound()` is the seam a future
  relay-subscription wiring point uses to feed them — nothing calls it yet.
- **`NotificationPort.notify(title, body, meta)` cannot forward arbitrary
  `title`/`body` text.** `FedosDesktopNotificationCoordinator` enforces a
  CLOSED vocabulary of notification `kind`s with FIXED, non-caller-supplied
  templates, specifically to stop message content or other sensitive text
  from ever reaching the OS notification tray (its own "Phase B: Fail
  Closed" guardrail). The adapter honors that guardrail rather than
  defeating it: routing happens through `meta.kind` (validated against the
  coordinator's own closed `FedosDesktopNotificationKind` vocabulary);
  `title`/`body` are never forwarded, and an unrecognized/missing
  `meta.kind` fails closed (no notification raised) rather than inventing a
  custom-payload path the underlying coordinator was explicitly designed
  never to support.

## The dependency rule

**Messenger must never import commerce** — `src/commerce`, `src/payment`,
`src/marketplace`, `src/creator` (old locations) or `src/os/commerce` (new
location). Commerce may only *consume* messenger through the neutral seams
in `src/os/core/ports/*` — never by importing a messenger-internal type
directly.

`test/architecture_boundary_messenger.test.ts` enforces the messenger→
commerce half of this mechanically, walking every `.ts` file under the five
current live messenger locations AND `src/os/messenger/**`, and failing if
any relative import resolves into a commerce directory (old or new). It
passes today. A companion test on the commerce side
(`test/architecture_boundary_commerce.test.ts`, a concurrent agent's own
work) checks that commerce never reaches around the Ports into a messenger
directory — together the two tests cover both directions of "the boundary
is a Port, not a shared internal type," for the parts of each domain that
exist so far.

### An already-existing violation this arc found and resolved

`src/commerce/bridge.ts` and `src/commerce/classify.ts` (now moved to
`src/os/commerce/catalog/`) imported `NostrEvent` from `src/nostr/types.ts`
directly — a real, pre-existing commerce → messenger dependency found
during this arc's audit, predating both this scaffolding pass and the Port
adapters. The Coordinator resolved it during reconciliation: the two
`NostrEvent`-typed functions (`classify.ts` in full, and `bridge.ts`'s
`productFromEvent`) moved to a reserved adapter directory,
`src/os/commerce/catalog/adapters/nostr/`, leaving `catalog/bridge.ts` and
`catalog/classify.ts`'s former location free of any Nostr/messenger
dependency. `test/architecture_boundary_commerce.test.ts` now permits
`src/nostr/` imports only from that one adapter directory (the same pattern
already used for the reserved Telegram/BTCPay adapter directories) — see
`docs/architecture/COMMERCE-ARCHITECTURE.md` for the full before/after.
Both boundary tests pass with zero violations as of this arc's CandidateHead.

## Pointers

- **Complete file-by-file migration mapping:**
  `docs/architecture/MESSENGER-MIGRATION-MAPPING.md` — every one of the 764
  `.ts` files currently under `src/conversation/`, `src/board/`,
  `src/desktop/`, `src/device/`, `src/nostr/`, old path → proposed new
  path, grouped by target bucket, generated mechanically (not sampled).
- **Proposed move order:**
  `docs/architecture/MESSENGER-MIGRATION-STAGING.md` — six stages, ordered
  by measured external import fan-in (ascending) with `desktop/` forced
  last as the highest-risk composition layer, each stage specifying its own
  move → shim → typecheck → targeted-tests → packaging-audit checklist and
  which of the five root build tsconfigs need a literal-path update in the
  same commit.
