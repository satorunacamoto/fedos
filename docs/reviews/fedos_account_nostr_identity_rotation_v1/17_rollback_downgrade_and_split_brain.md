# 17 — Rollback, Downgrade, and Split-Brain

## Threat model

| Scenario | Defense |
|---|---|
| Stale old-identity event replay | Monotonic `revision` + durable replay ledger keyed by the claim's own nonce (reusing `d825aa0`'s exact `FedosRatchetPeerCapabilityObservationV1`/exact-`sourceId`-short-circuit pattern) |
| Lower transition revision after a higher one | Rejected as `"stale"` — reusing the EXACT fix this review's own predecessor Arc (`d825aa0`) had to make for its own advertisement-vs-notification revision counters: **revision comparisons must be scoped to one fact-kind's own counter, never mixed across unrelated fact streams** (a bug found and fixed in `d825aa0`'s own Inbound Coordinator; this review requires the Implementation Arc treat "identity-transition revision" as its own, separately-scoped counter, never compared against Device-lifecycle or capability-advertisement revisions) |
| Two different new identities claiming the same predecessor | `"conflicting"` (`10`) — both are durably recorded as evidence; neither is auto-accepted; local manual resolution required |
| Old and new identity both active simultaneously | Never auto-resolved; both remain independently addressable (`13`) until local policy accepts one transition, at which point the OLD one's Ratchet sessions are `"reset-required"` (`12`) but its MEMBERSHIP/Archive history is never deleted |
| Different local Devices accepting different transitions | An acknowledged, real risk this review does not fully solve: `d825aa0` already establishes that acceptance state is per-local-Device (`localDeviceRef` is part of every Observation's key) — this is INTENTIONAL for ordinary peer-capability facts (Phase M multi-device isolation) but for identity-transition specifically, a future Arc SHOULD consider whether acceptance ought to be an account-wide (not per-Device) local decision, since inconsistent per-Device acceptance of "who a specific peer now is" is a worse UX/security outcome than inconsistent per-Device Ratchet readiness. This review flags it as an OPEN QUESTION for the Implementation Arc to resolve explicitly, rather than silently inheriting the per-Device default. |
| Archive restored before a transition was known | Archive Restore never establishes trust (`14`) — restoring old history does not retroactively accept or reject any transition; the transition's own acceptance state is evaluated independently, whenever the claim itself is (re-)observed |
| Peer capability DB rolled back (e.g., restored from an old backup) | The durable Observation store's own append-only, corruption-fail-closed discipline (`d825aa0`) already defends against silent rollback — a restored-from-backup DB simply resumes from whatever revision it last recorded; a NEWER, already-seen-elsewhere transition claim (if re-delivered) is evaluated fresh against the (older) locally-recorded revision, correctly detected as advancing, never treated as `"stale"` incorrectly |
| Malicious Relay suppresses the transition | The existing Relay-ACK-is-not-peer-acceptance discipline (`d825aa0` Phase G) already means a sender cannot assume a peer received anything from ACK alone; this review adds no NEW defense against Relay-level suppression beyond what already exists (retry via the existing Outbox, out-of-band fallback per `16`) |
| Compromised old key signs a competing transition | Recorded as a `"conflicting"` or independently `"signature-valid"` claim like any other — evidence-level distinguishes it (`07`) but does not by itself resolve which is legitimate; manual verification is the only true resolution (`09`) |
| Compromised Device signs a competing transition | Same as above, one evidence-level lower in severity (a compromised Device alone cannot forge the account-level signature too, unless the SAME compromise reached both, `09`) |
| User restores an old profile backup | Equivalent to "the old identity is available again" — if no transition was ever locally accepted, nothing changes; if one WAS accepted, the restored old profile is simply an old identity a peer has already recorded as `"superseded"` — its future messages are evaluated fresh, not specially trusted |
| Transition chain cycle (A→B→A) | Rejected structurally by requiring `previous-transition reference` to form a strictly monotonic, non-repeating chain per predecessor identity — a future Arc's validation must reject a transition whose predecessor reference already appears later in an already-accepted chain |

## Defined mechanisms (specification only — not implemented here)

- **Monotonic revision** — per predecessor-identity subject, exactly
  like `d825aa0`'s own `revision` field, scoped to this fact-kind alone
  (see the table above).
- **Previous-transition hash/reference** — every transition claim names
  the specific prior transition (or "none," for a first transition) it
  supersedes, forming a verifiable chain, never a bare "trust me, I'm
  newer" claim.
- **Conflict state** — `"conflicting"` (`10`), a first-class, durably
  recorded outcome, never silently resolved by "last one wins."
- **Terminal supersession** — once a transition is `"locally-accepted""`
  and a later one supersedes it, the earlier is marked terminal
  (`"superseded"`), matching the exact terminal-state discipline
  `f80889d`'s own session lifecycle and `d825aa0`'s own acceptance
  outcomes already use.
- **Local manual resolution** — required, never automated, for any
  `"conflicting"` state.
- **No automatic downgrade** — an already-`"locally-accepted"` transition
  is never silently reverted by a later, weaker-evidence claim; only an
  explicit local decision can undo an acceptance.
- **No silent merge of conflicting identities** — Archive/Search/Membership
  never combine two identities' histories absent an explicit accepted
  transition (`14`).
