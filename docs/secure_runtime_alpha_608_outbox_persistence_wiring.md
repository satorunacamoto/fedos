# Secure Runtime Alpha 608 — Outbox Persistence Wiring

Stage 8 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## What was wired

`startFedosDesktopRuntime()` constructs `new AppendOnlyFedosBoardOutboxPersistence(config.outboxLogPath)`
(Alpha 418, UNCHANGED) and passes it as `outboxPersistence` to
`createFedosDesktopHost()` — a genuinely separate file from the Board
log (`config.outboxLogPath` is its own, independent, caller-supplied
path — never derived from `boardLogPath`).

## Every named requirement, verified by real execution

- **Separate file from the Board log:** confirmed —
  `test/secure_runtime_alpha_606_...test.ts` uses two distinct temp
  paths throughout; nothing in this Arc's own code ever derives one
  path from the other.
- **Caller-supplied path:** `config.outboxLogPath`, required, explicit.
- **Corrupt log fails closed:** `outboxPersistence.listIntents()` has
  no internal `try`/`catch` (Alpha 418, unchanged); a corrupt line
  throws, unconditionally, whenever hydration or the Scheduler reads
  it — verified, `test/secure_runtime_alpha_614_...test.ts` §2.
- **Local-only `submitPost()` creates no Outbox entry; only
  `submitPostWithOutbox()` with an EXPLICIT `targets` array does:**
  this is `FedosDesktopHost`'s own existing, UNCHANGED contract
  (Alpha 419) — this Arc introduces no new submission path, only wires
  a durable backend behind the SAME two existing methods. Verified
  again here, `test/secure_runtime_alpha_606_...test.ts` §3/§4.

## See also

- `docs/secure_runtime_alpha_418_append_only_durable_outbox.md`
- `docs/secure_runtime_alpha_606_runtime_assembly.md`
