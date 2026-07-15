# Secure Runtime Alpha 487 — Four-Protocol Future Compatibility Review

Stage 7 of the Alpha 481–490 Publish Pipeline Integration Review Arc.
Review only.

## 1. Question

When a Nostr/ActivityPub/AT Protocol/Session Publisher is added, is no
API change required? `FEDOS_BOARD_OUTBOUND_PROTOCOLS` (Alpha 413)
already names all four as the closed set of legal
`target.protocol` values, so this Arc reviews both existing Publisher
FAMILIES against that same four-protocol requirement.

## 2. Generic `FedosBoardOutboxPublisher` — YES, zero interface change

`publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult>`
carries the protocol as DATA (`record.target.protocol`), never as part
of the method signature. Adding an ActivityPub/AT Protocol/Session
Publisher means writing one new class implementing this SAME interface
— `test/secure_runtime_alpha_487_...test.ts` §1 proves this directly: a
locally-defined, test-only `FakeFourthProtocolPublisher` (implementing
`FedosBoardOutboxPublisher` with zero modification to its own file) is
constructed and driven through a real `FedosPublishScheduler.tick()`
call successfully, with no change anywhere in `src/`.

## 3. Nostr-specific `FedosNostrBoardPublisher` family — NO, a parallel surface per protocol

`publishOne(entry: FedosNostrBoardPublishEntry)` where `entry.event:
FedosNostrWireEvent` is Nostr's own NIP-01 wire shape. This is
INTENTIONAL, not an oversight — Alpha 453 §4's own doc names the
adopted pattern explicitly: "a future ActivityPub/AT Protocol/Session
Publisher Arc would add `publish/activitypub/`, `publish/atproto/`,
`publish/session/` siblings" — i.e., a wholly separate interface +
implementation + entry-pairing type + wire-mapping file PER protocol,
never a shared interface. This is a legitimate, deliberate answer to
the same requirement (each protocol's own already-signed wire event
shape is genuinely different, so a single generic `entry.event: unknown`
would lose type safety) — but it means "add a Publisher" costs a
constant amount of NEW surface area per protocol under this family,
versus a single new class file under the generic family.

## 4. Both answers currently coexist, unreconciled

Neither family currently depends on the other, and nothing in this
repository picks one as canonical for the other three protocols still
to be built. A future Arc adding an ActivityPub Publisher could
legally extend EITHER family — extending the generic one costs one
file; extending the Nostr-specific family's own pattern costs four
(interface, impl, entry type, wire mapping) SOLELY for parity with the
existing Nostr thread, and would not interoperate with the Scheduler
(which depends on the generic family only) without also writing an
adapter from the protocol-specific `publishOne(entry): Promise<boolean>`
shape to the generic `publish(record): Promise<FedosBoardOutboxPublishResult>`
shape — a conversion this Arc confirms does not exist anywhere today
(re-uses Alpha 482 §2's own finding).

## 5. See also

- `docs/secure_runtime_alpha_482_publish_pipeline_type_duplication_review.md`
- `docs/secure_runtime_alpha_453_outbox_relay_entry_pairing_model.md`
- `docs/secure_runtime_alpha_473_publisher_interface_model.md`
