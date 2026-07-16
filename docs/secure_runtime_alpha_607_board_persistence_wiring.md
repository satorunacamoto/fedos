# Secure Runtime Alpha 607 — Board Persistence Wiring

Stage 7 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## What was wired

`startFedosDesktopRuntime()` constructs `new AppendOnlyFedosBoardPersistence(config.boardLogPath)`
(Alpha 353, UNCHANGED) and passes it as `boardPersistence` to
`createFedosDesktopHost()` — the FIRST time this class has ever been
used by a real, callable production path (every prior use was test-only).

## Every named requirement, satisfied by inheritance, not new code

- **Caller-supplied path:** `config.boardLogPath` is a required,
  explicit string (Alpha 603/604) — no default anywhere in this file.
- **No silent in-memory fallback:** `createFedosDesktopHost()`'s own
  `boardPersistence` parameter has no default this Arc invokes — this
  file ALWAYS passes a real `AppendOnlyFedosBoardPersistence`, never
  omits the field.
- **Corrupt log is a startup failure, Host state `"failed"`, error
  propagation preserved:** all three already guaranteed by
  `hydrateFedosBoardService()`/`FedosDesktopHost.start()` (Alpha 318/382,
  UNCHANGED) — `replayLog()`'s own unconditional throw on a malformed
  line reaches `Host.start()`'s own `try`/`catch`, which sets
  `#state = "failed"` and rethrows. This Arc adds no new error handling
  of its own for this path; it relies entirely on already-existing,
  already-tested behavior. Verified again here,
  `test/secure_runtime_alpha_606_...test.ts` §6 and
  `test/secure_runtime_alpha_614_...test.ts` §1.
- **No automatic repair:** confirmed by direct inspection —
  `AppendOnlyFedosBoardPersistence` is UNCHANGED by this Arc; it has
  no repair method.

## See also

- `docs/secure_runtime_alpha_353_append_only_persistence_implementation.md`
- `docs/secure_runtime_alpha_604_filesystem_path_authority.md`
- `docs/secure_runtime_alpha_606_runtime_assembly.md`
