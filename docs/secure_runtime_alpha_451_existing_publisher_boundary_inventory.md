# Secure Runtime Alpha 451 — Existing Publisher Boundary Inventory

Stage 1 of the Alpha 451–460 Canonical Nostr Outbound Publisher
Foundation Arc. Review only — no code changes. Re-verifies, by direct
source inspection, every boundary Alpha 448
(`docs/secure_runtime_alpha_448_outbox_publisher_readiness_adapter.md`)
already reviewed, plus the one boundary Alpha 448 did not need to
review because nothing consumed it yet.

## 1. Boundaries re-confirmed unchanged

- **`FedosBoardOutboxIntent`** (`src/board/outbox/fedos_board_outbox_types.ts`,
  Alpha 413/414) — carries `id`/`postId`/`target`/`createdAt` only.
  `target.protocol`/`target.destination` are the ONLY routing fields;
  there is no event-body field, no signed-payload field, no protocol-native
  object field of any kind. Confirmed unchanged (`git log` shows zero
  commits touching `src/board/outbox/*` since Alpha 420).
- **`FedosBoardOutboxPersistence`** (`./fedos_board_outbox_persistence.ts`,
  Alpha 417) — exposes exactly `putIntent`/`getIntent`/`listIntents`.
  No `delete`, no `dequeue`, no acknowledgment method — so nothing in
  this Arc can "mark an intent published" by mutating the Outbox itself;
  that vocabulary is Observation/ACK, out of this Arc's own scope.
- **`FedosNostrSigningAuthority.signEvent()`**
  (`src/nostr/sign/fedos_nostr_signing_authority.ts`, Alpha 442/445) —
  `(request: FedosNostrUnsignedEventRequest) => Promise<FedosNostrWireEvent | null>`.
  No Relay/Outbox import (re-grepped, same finding as Alpha 448 §"Reviewed").
- **`FedosNostrWireEvent`** (`src/desktop/fedos_nostr_wire_event.ts`,
  Alpha 234) — the seven NIP-01 wire fields (`id`, `pubkey`,
  `created_at`, `kind`, `tags`, `content`, `sig`). No `provider` field.
- **`FedosEventDescriptor`** (`src/desktop/fedos_event_descriptor.ts`,
  Alpha 202) — the protocol-neutral already-signed shape `FedosRelay.publish()`
  accepts: `id`/`provider`/`author`/`createdAt`/`kind`/`tags`/`content`/`signature`.
- **`FedosRelay.publish(event: FedosEventDescriptor): Promise<void>`**
  (`src/desktop/fedos_relay.ts`, Alpha 216) — UNCHANGED, still transport
  only, still no ACK. `WebSocketRelay.publish()`/`NullRelay.publish()`
  (Alpha 216) both still reject (throw) when not connected, and neither
  registers a `"message"` listener inside `publish()` itself.

## 2. The gap this Arc must resolve

`FedosNostrWireEvent` (a signed Nostr event) and `FedosEventDescriptor`
(the protocol-neutral shape `FedosRelay.publish()` requires) are two
DIFFERENT types with different field names. Alpha 234's own header
already named this explicitly: "a later adapter... MAY map one onto the
other; this Stage builds no such adapter." No such adapter exists
anywhere in this repository as of Alpha 450. This Arc's Alpha 454
resolves it.

Separately: `FedosBoardOutboxIntent` never carries a signed event body
(§1 above). A Publisher therefore cannot obtain a `FedosNostrWireEvent`
BY READING THE OUTBOX ALONE — the Outbox supplies routing identity
(`postId`/`target`) only. This Arc's own Publisher interface (Alpha 455)
therefore takes the intent and an already-signed
`FedosNostrWireEvent` as two separate, caller-supplied inputs, paired
together at the call site — never derives one from the other, and never
reads a signed event out of Outbox persistence, which has no such field
to read.

## 3. No existing Publisher

`grep -r "FedosNostrBoardPublisher\|publishOne\|publishBatch" src/` (run
directly during this Stage) finds zero matches anywhere in tracked
source. Alpha 448's own prediction — that this file does not yet exist
— still holds.

## 4. Stray untracked file — acknowledged, not adopted

`git status --short` shows one untracked file this Arc did not create:
`src/board/outbox/fedos_board_outbox_publisher.ts`. Its own header
labels it "Secure Runtime Alpha 473" — an Arc number AHEAD of this
repository's own committed history (`git log` tops out at Alpha
431–450 as of this Stage) — and `git log` shows zero commits touching
it: it was never part of any completed Arc. It also fails
`npm run typecheck` on its own (`this.#results[callIndex]` under this
project's `noUncheckedIndexedAccess`), independent of anything this Arc
changes. It defines a DIFFERENT, broader `FedosBoardOutboxPublisher`
contract carrying retry-policy vocabulary (`FedosBoardOutboxRetryPolicy`)
this Arc's own instructions explicitly forbid, and its own header
explicitly states no `FedosNostrBoardPublisher` is created inside it.

This Arc treats it exactly like the pre-existing untracked `p2p/`
directory (see every prior Arc's own README status entry): acknowledged
by this doc, left completely untouched, not imported, not extended, not
deleted, and excluded from this Arc's own commit. Its one pre-existing
`npm run typecheck` failure is not fixed by this Arc — see Alpha 460 §4
for confirmation this is not a regression this Arc introduces.

## 5. See also

- `docs/secure_runtime_alpha_448_outbox_publisher_readiness_adapter.md`
- `docs/secure_runtime_alpha_450_master_seed_authority_and_nostr_signing_activation_completion.md`
- `docs/secure_runtime_alpha_234_inbound_event_representation.md`
