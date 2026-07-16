# Secure Runtime Alpha 797 — Retention Result Vocabulary

Stage 7. `FedosPayloadRetentionResult`
(`src/conversation/retention/fedos_payload_retention_authority.ts`):

```ts
type FedosPayloadRetentionResult =
  | { outcome: "tombstoned" }
  | { outcome: "already-tombstoned" }
  | { outcome: "payload-removed" }
  | { outcome: "already-removed" }
  | { outcome: "not-found" }
  | { outcome: "conflict" }
  | { outcome: "failed" };
```

**`"unavailable"` is deliberately OMITTED** from the real type, though
the task's own candidate list names it: nothing in this synchronous
design (both ports are synchronous, in-process or direct-file-I/O) can
ever produce it. Including an unreachable outcome would be dead
vocabulary — this Arc's own "no speculative abstraction" rule, applied
to result types too, not just classes. If a future async/networked
backend is ever introduced, that is the point to add it back, with a
real code path that produces it.

No `Error` object or raw filesystem message ever escapes this
vocabulary — `tombstonePayload`/`removeLocalPayload` catch every
`FedosPayloadRetentionPersistenceWriteResult` outcome
(`"inserted"`/`"already-present"`/`"conflict"`/`"failed"`) and map it to
a closed token; no code path returns or rethrows a native `Error`.

`"conflict"` is deliberately REUSED for two different situations rather
than inventing new tokens: a genuine persistence-level write conflict,
AND a forbidden state transition (Alpha 798) — both are "the requested
change disagrees with the current authoritative state," which is
exactly what `"conflict"` already means everywhere else in this
codebase.
