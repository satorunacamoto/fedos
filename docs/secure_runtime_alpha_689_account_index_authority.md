# Secure Runtime Alpha 689 — Account Index Authority

Stage 9 of Phase A.

## Options compared

A. fixed account index 0 in Runtime V1. B. caller supplies `accountIndex`
per command (discouraged). C. `FedosBoardRuntime` config owns a fixed
account index. D. author descriptor embeds account index (discouraged).

## Decision

**C, with a default of 0** — `FedosBoardRuntimeDependencies.nostrAccountIndex?: number`
(`src/board/runtime/fedos_board_runtime.ts`) is the one explicit
configuration value the whole Runtime checks against, for every command,
defaulting to `0` only because Alpha 424 already fixed this codebase's
signing scope around a single account concept (`kind: 1`, one signing
call per event) — no new inference is introduced.

`FedosDesktopRuntimeConfig.nostrAccountIndex?: number`
(`src/desktop/runtime/fedos_desktop_runtime_config.ts`) passes the same
value straight through (Alpha 697).

Per-command caller-supplied account index (Option B) and
descriptor-embedded account index (Option D) are both rejected: either
would let a caller (or an already-untrusted author descriptor) silently
select which cryptographic identity a post binds against, which is exactly
the kind of caller-controlled trust decision this Arc's Permanent
Invariant #4 ("no caller-supplied pubkey may override the derived signing
pubkey") forbids in spirit.

Account index is never inferred from `publicIdentifier` anywhere in this
Arc's code.
