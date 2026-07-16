# Secure Runtime Alpha 604 — Filesystem Path Authority

Stage 4 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## Decision: Option A — the caller supplies every path, explicitly

Confirmed correct against real constraints, not merely preferred in
the abstract: no packaging environment exists (Alpha 601 §8 — no
`bin`, no installer), so there is no OS-conventional "app data
directory" this repository could even resolve consistently (Option B
requires exactly that packaging context). `cwd` (Option C) is
unstable across how `node`/`npm run` may be invoked. Writing durable
runtime data inside the repository's own working tree (Option D) would
risk exactly the class of accidental commit/pollution this repository
already guards against elsewhere (`p2p/` isolation, `.gitignore`'s own
`dist/` exclusion). An environment variable (Option E) is a hidden,
implicit path source this Arc's own Absolute Prohibitions already rule
out in spirit ("default cwd依存の隠れpath" — an env-resolved default is
the identical class of hidden dependency, just relocated).

`FedosDesktopRuntimeConfig.boardLogPath`/`outboxLogPath`/
`observationLogPath` are therefore all caller-supplied, required
strings (the latter conditionally, Alpha 603/609) — this file
introduces NO default path anywhere.

## Directory auto-creation — explicitly assigned, not left ambiguous

`AppendOnlyFedosBoardPersistence`/`AppendOnlyFedosBoardOutboxPersistence`
(both UNCHANGED — this Arc modifies neither) perform NO filesystem
operation in their own constructors (confirmed by direct read) and
treat a missing FILE as an empty log — but a missing PARENT DIRECTORY
causes the same underlying `ENOENT`, which their own `appendFileSync`
write path does NOT tolerate (a write into a non-existent directory
fails, correctly, as `"failed"`). Responsibility is assigned HERE,
explicitly: `startFedosDesktopRuntime()` (Alpha 606) calls
`mkdirSync(dirname(path), { recursive: true })` (`node:fs`/`node:path`,
no new dependency) for each configured log path's own parent directory
BEFORE constructing any Persistence backend — narrowly scoped to the
runtime assembly module only, never added to the unmodified Persistence
classes themselves (preserving "Board Model変更"/"Outbox format変更"
prohibitions by touching neither file).

## See also

- `docs/secure_runtime_alpha_603_local_runtime_configuration_model.md`
- `docs/secure_runtime_alpha_607_board_persistence_wiring.md`
