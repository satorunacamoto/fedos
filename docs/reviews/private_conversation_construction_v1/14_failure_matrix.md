# Review 14 — Failure Matrix

Every named failure mode, its trigger, and its honest, observable
outcome. "Observable" means a caller (or a restart-time reader) can
tell EXACTLY what state exists — never a silent gap.

| Failure | Trigger | Outcome |
|---|---|---|
| Identity unavailable | Creator identity axis (`02`.2) resolves `"anonymous-local"` or `"unavailable"` and construction's own policy treats that as insufficient (a product decision this review names but does not force — see `06`) | `{ outcome: "identity-unavailable" }` (`03`); NO durable write attempted at all — identity is resolved FIRST, before any port is touched, mirroring `FedosBoardRuntime.createPublicThread()`'s own author-resolution-before-write ordering |
| Duplicate Conversation id | `putConversation()` returns `"conflict"` (a DIFFERENT record already exists at this id) | `{ outcome: "conflict" }`; construction halts immediately — no Membership/Capability write is EVER attempted once the Conversation record write itself conflicts, since every subsequent step depends on a real, agreed-upon Conversation id existing |
| Duplicate Conversation id, IDENTICAL content | `putConversation()` returns `"already-present"` | treated as a RETRY of the identical construction attempt (`10`'s coordination-fact recovery) — proceeds to check/complete remaining steps rather than treating this as an error |
| Policy failure | No `FedosConversationPolicyAuthority` implementation can resolve a valid policy for the requested mode (`07`'s own two named structural blockers) | `{ outcome: "policy-invalid" }`; no Conversation record write is attempted — Policy readiness (`02` axis 4) is checked BEFORE the Conversation record write in construction's own ordering, since a Conversation with no resolvable policy is not a state this review permits durably recording |
| Creator Membership failure | `admit()` returns `"conflict"`/`"invalid-transition"`/`"unavailable"` AFTER the Conversation record was already durably written | `{ outcome: "membership-unavailable" }`, but the Conversation record REMAINS durable — an honest partial-construction state (`06`'s own explicit finding), recoverable on retry via `10`'s deterministic re-derivation, never silently rolled back (no rollback mechanism exists for any append-only port in this codebase) |
| Capability persistence failure | `issueJoinCapability()`/its underlying `putEvent()` returns `"failed"`, requested via `04`'s optional `initialCapability` | `{ outcome: "capability-unavailable" }` is NOT returned as the top-level construction result in this case — the Conversation AND owner Membership are already durable and usable; the FAILED Capability issuance is instead surfaced as a distinct, non-fatal sub-result (e.g. `capability: undefined` on an otherwise `"created"` result) — mirroring `FedosBoardRuntime`'s own Alpha 667 "Option 2: surface the partial failure explicitly, never silently drop it, but do not fail the whole command" precedent for ineligible outbound targets |
| Encryption unavailable | Axis 6 (`08`) resolves `"unavailable"` | under `09`'s recommended Option B: `lifecycleState: "draft"` is recorded, construction still reports `"created"` (with the draft state visible on the record) rather than a readiness-outcome rejection — encryption unavailability is the ONE axis failure that does NOT halt construction outright, by `09`'s own design |
| Payload storage unavailable | `FedosConversationPayloadStorage`/`FedosPayloadRetentionAuthority` cannot be constructed against the injected backend | `{ outcome: "storage-unavailable" }`; checked BEFORE the Conversation record write (a Conversation with no working storage backend for its own future messages is not durably recorded, matching the Policy-failure ordering above) |
| Crash after Conversation record write, before coordination fact `"conversation-recorded"` | process termination mid-sequence | on restart, `getConversation(id)` finds the record; `getCoordination(constructionId)` finds nothing — `10`'s recovery treats this identically to "fresh attempt, Conversation-write step is naturally idempotent" (retried `putConversation()` returns `"already-present"`), proceeds forward |
| Crash after Membership admit, before coordination fact `"membership-admitted"` | process termination mid-sequence | on restart, recovery re-derives the deterministic Membership id (`06`), calls `admit()` again, which returns `"already-present"` per its own existing idempotent behavior (confirmed in `01`) — proceeds forward, no duplicate Membership, no error |
| Crash after Capability issuance, before coordination fact records the issued id | process termination mid-sequence | **the one genuinely unrecoverable-without-a-dedicated-log gap this review names explicitly** (`10`'s own reasoning for recommending Option 1) — without the coordination fact recording the issued `capabilityId`, a naive retry would mint a SECOND Capability; this is exactly why `10` recommends the coordination log, not deterministic re-derivation alone, for this one step |
| Restart recovery, general | any point | `FedosConversationConstructionCoordinationPersistence`'s own fact log (`10`) is read via the SAME deterministic `constructionId` a retry would compute; recovery ALWAYS moves forward from the furthest-recorded phase, mirroring `FedosConversationDurableRedemptionCoordinator`'s own "no fake rollback... only ever moves FORWARD" discipline verbatim |
| Unsupported mode | Caller requests `mode` outside `"private-group"`/`"direct"` on the wrong command, or the Conversation Record/Policy validators themselves reject the mode (`01`'s own central finding — TRUE for every mode value in this checked-out tree, since neither validator accepts anything but `"public"` today) | `{ outcome: "unsupported-mode" }`; construction never begins any durable write |

## Partial creation is observable, honestly

Per this review's own required constraint: at NO point does this
matrix describe a state where a caller or a restart-time reader cannot
determine exactly what exists. Every "partial" row above names EXACTLY
which durable facts exist and which do not, and every recovery path
re-derives that same observation deterministically — matching every
append-only backend's own "fail closed, never repair automatically"
discipline (`AppendOnlyFedosConversationPersistence`'s own header,
`01`) extended across the whole five-concern construction sequence
(`10`).
