# Secure Runtime Alpha 726 — Relay Rejection Reason Handling

Stage 6. Options: A (discard entirely), B (retain only ephemeral
diagnostic output), C (classify into a closed coarse code), D (persist
verbatim, rejected).

## Decision: A — discard entirely (already the case)

`FedosOutboundPublishResult`'s own `"rejected"` variant carries only
`externalReference` (the event id) — no `reason`/`message` field exists
on the type at all (Alpha 492, unchanged). `#correlate()`
(`fedos_relay_ok_correlated_nostr_board_publisher.ts`) reads the inbound
OK's own `message` field only to decide `accepted` (a boolean), and never
forwards it anywhere.

`outboundPublishResultToFedosBoardOutboxPublishResult()` (Alpha 497,
unchanged) leaves `reason` `undefined` on every result it produces.

No classifier (Option C) was introduced — this Arc found no actual
consumer that needs one ("do not invent classifications without actual
consumers," this Alpha's own instruction). If a future Arc needs to
distinguish WHY a Relay rejected an event (e.g. for operator-facing
diagnostics), it should add a narrow, closed, ephemeral (non-persisted)
classifier only once a real caller needs it.

Verified in
`test/secure_runtime_alpha_736_permanent_rejection_verification.test.ts`
test 2: a Relay OK carrying rejection prose
(`"rejected: untrusted content policy violation"`) never appears anywhere
in any recorded Delivery Observation.
