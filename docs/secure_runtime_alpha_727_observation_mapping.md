# Secure Runtime Alpha 727 — Observation Mapping

Stage 7.

## Finding

The mapping this Alpha asks for ALREADY EXISTS, byte-for-byte, in
`FedosPublishScheduler.#attemptOnce()`
(`src/board/outbox/fedos_publish_scheduler.ts`, line ~322, unchanged by
this Arc):

```ts
const kind = result.outcome === "delivered" ? "delivered"
  : result.outcome === "rejected" ? "rejected"
  : "failed";
```

And the transition graph
(`src/board/observation/fedos_delivery_observation_transition_graph.ts`,
unchanged) already enforces exactly the required shape:

```
queued -> publishing -> { accepted | rejected | failed }
```

with every terminal state (`accepted`/`rejected`/`failed`) final —
`TERMINAL_STATES` includes `"rejected"`, and `rejected` has an empty
outgoing-transition list (`rejected: []`). No direct `queued -> rejected`
transition exists in the graph. No dual-terminal-observation path exists
either — a Scheduler tick observes at most one terminal kind per attempt.

**No change was made to the transition validator** — the task's own
"unchanged unless demonstrated defect" condition was checked and no
defect was found. This Arc's entire contribution is making the Nostr
publish path finally SUPPLY a `"rejected"` `FedosBoardOutboxPublishResult`
for the validator to correctly accept (Alpha 723/724).

Verified end to end in
`test/secure_runtime_alpha_736_permanent_rejection_verification.test.ts`
and `test/secure_runtime_alpha_739_full_vertical_verification.test.ts`.
