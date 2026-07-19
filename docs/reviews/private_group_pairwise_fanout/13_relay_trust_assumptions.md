# Review 13 — Relay Trust Assumptions

## Confirmed: this repository assumes exactly one relay per connection, as a repeated, deliberate hard guardrail — not an omission

A single-relay assumption is stated explicitly and repeatedly across
the codebase, never left implicit:

- `WebSocketRelayAdapter` (`src/nostr/ws_relay.ts:61-76`) and
  `WebSocketRelayPublisher` (`src/nostr/publish.ts:154-165`) each take
  exactly one `url: string` in their constructor — one socket per
  instance.
- `src/desktop/node_websocket_relay_socket_factory.ts:22`: "No Relay
  Pool, no automatic reconnect, no relay discovery — this file
  constructs exactly one socket per call, for exactly the URL it is
  given."
- `src/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts:67`:
  "No Relay Pool, no reconnect logic, no new dependency."
- `src/desktop/runtime/fedos_desktop_runtime.ts:42` and
  `src/desktop/host/fedos_desktop_host.ts:234` both list "Relay Pool"
  as an explicit Absolute Prohibition for their own file.
- `FedosRelayNostrBoardPublisher` (`src/board/publish/nostr/fedos_relay_nostr_board_publisher.ts`)
  calls `this.#relay.publish(...)` **at most once** per entry,
  sequentially, no retry, no backoff — a single-relay assumption baked
  into the Publisher's own control flow, not merely its constructor.

**No "relay pool," "relay selection," "trusted relay," or multi-relay
redundancy concept exists anywhere in this repository.**

## What this means for pairwise fanout and for the eventual protocol-delivery Arc

Whatever protocol-delivery mechanism eventually transports a
fanout-produced Envelope (`11`) will, if it reuses this repository's
own existing Nostr infrastructure unmodified, inherit the single-relay
assumption directly: each of the N per-recipient sends (`04`) would
publish to the same one configured relay, with no fallback if that
relay is unavailable, and no redundancy if it drops the event silently.
This is a **pre-existing repository-wide limitation**, not something
fanout introduces — but fanout's own N-way multiplication (`11`) means
a single relay outage affects N independent deliveries simultaneously
for one logical group message, a real (if not fanout-specific)
availability cost worth naming here.

## Relay trust — no model exists to evaluate

Because no relay-selection or relay-trust concept exists, there is
also no notion of "a malicious relay" being treated any differently
from "a well-behaved relay" anywhere in this codebase — every relay
interaction (`FedosRelayOkCorrelatedNostrBoardPublisher`'s own
OK-correlation, `docs/reviews/private_protocol_delivery_group_v1/04_nostr_readiness.md`)
already assumes the configured relay's own `OK` response is
meaningful, with no cross-relay confirmation. Content confidentiality
(once NIP-44/gift-wrap wiring exists, `01`/`02`) does not depend on
relay trust — a malicious relay sees only ciphertext — but metadata
(`docs/reviews/private_protocol_delivery_group_v1/05_nostr_metadata_leakage.md`,
unchanged) is fully exposed to whichever relay is configured, and
fanout's own N simultaneous deliveries (`05`) make group-size inference
easier for that one relay specifically, not harder.

## Official specification research this review names, does not perform

This review does not evaluate real-world Nostr relay trust practices
(paid relays, relay-operator reputation, NIP-65 relay-list metadata) —
none of this exists in this repository's own source, and per this
review's own ground rules, no external research is performed here.

## See also

- `05_recipient_planning.md`, `11_offline_delivery.md`
- `docs/reviews/private_protocol_delivery_group_v1/05_nostr_metadata_leakage.md`
