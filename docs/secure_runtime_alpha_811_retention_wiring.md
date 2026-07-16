# Secure Runtime Alpha 811 — Retention Wiring

Stage 21. `FedosPayloadRetentionAuthority` connects the Retention
Decision Log to Payload Storage NARROWLY — the only place either
concern is combined; neither port references the other directly
(confirmed: `fedos_payload_retention_persistence.ts` and
`fedos_conversation_payload_storage.ts` import nothing from each
other).

- **Tombstoned** — `readPayload()` checks retention state BEFORE ever
  calling `payloadStorage.getPayload()`; normal reads are denied
  (`{ outcome: "denied", state: "tombstoned" }`).
- **Payload removed** — same gate, `state: "payload-removed"`; the
  descriptor/history remain reachable via `getDescriptor`/
  `listConversationPayloads` directly on the port (never through the
  Authority's own gated `readPayload`) — this Arc's own chosen
  contract keeps metadata visible for auditing while denying byte
  access through the normal path.
- **No fake transactionality** — the Retention Decision Log and
  Payload Storage are two separate append-only logs with no shared
  commit. A crash between "the Authority validated the transition" and
  "the decision was durably written" leaves the payload in its PRIOR
  state (the decision write either succeeded or it didn't — there is no
  partial decision record, since `putDecision` is a single call). No
  atomicity is claimed beyond that.
