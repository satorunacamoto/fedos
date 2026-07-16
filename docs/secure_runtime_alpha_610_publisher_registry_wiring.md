# Secure Runtime Alpha 610 — Publisher Registry Wiring

Stage 10 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## The escape hatch this Stage's own instruction names, exercised honestly

"実際のSigning Authority/Relayが構築不能なら、test/injected modeと
production modeを区別し、停止して報告する." This Arc's own Absolute
Prohibitions list "Runtime crypto" (top-level) and "暗号処理変更"
(restated) as untouchable — a REAL Nostr Publisher requires a real
Signing Authority, which requires touching runtime crypto
initialization. **This Arc therefore does not, and structurally
cannot, construct one.** This is reported here directly, not hidden
behind a default that silently produces something else.

## What `FedosDesktopHost` already does, silently, that this Arc's own runtime must NOT inherit unnoticed

`FedosDesktopHost`'s own constructor (Alpha 507, unchanged) defaults
`publisher` to `MockFedosBoardOutboxPublisher` when omitted. A
`FedosDesktopHost` used by THIS Arc's own runtime with `deliveryEnabled:
true` and no injected Publisher would silently deliver every intent
against a Mock — the opposite of "production caller."

## Decision

`FedosDesktopRuntimeConfig.publisher?: FedosBoardOutboxPublisher`
(Alpha 603) — an OBJECT dependency, constructed and injected by the
CALLER, using whatever real Signing Authority + Relay setup their own
environment provides (`FedosNostrBoardPublisherAdapter` +
`FedosRelayNostrBoardPublisher`, both pre-existing, UNCHANGED, already
capable of this — see `test/secure_runtime_alpha_575_...test.ts` for
the established real-Adapter pattern this Arc's own runtime imports
nothing new to replicate). `startFedosDesktopRuntime()` (Alpha 606)
enforces, at startup: `deliveryEnabled: true` WITHOUT an injected
`publisher` is a configuration error, fail closed (Alpha 614) — never
a silent fallback to `MockFedosBoardOutboxPublisher`.

## Every named requirement, satisfied by this ONE decision

No automatic target inference (this Arc infers no protocol/destination
— `submitPost()`'s own existing explicit-target contract is untouched).
No source-protocol republish, no imported-author impersonation (this
Arc constructs no Publisher, so it originates no publish call of any
kind on its own). Signing Authority / Relay injection: the caller's
responsibility entirely, never this Arc's. ActivityPub/ATProto/Session:
correctly fail closed by omission — this Arc adds no Publisher
implementation for any protocol, real or stub; a caller who configures
an intent targeting one of those three without a Publisher that
actually handles it gets exactly the SAME pre-existing, unchanged
`FedosPublishScheduler` behavior (a `FAILED_LATER_RESULT`-mapped,
never-silently-succeeding non-outcome) any misconfigured Publisher
already produces today.

## See also

- `docs/secure_runtime_alpha_575_nostr_adapter_verification.md`
- `docs/secure_runtime_alpha_603_local_runtime_configuration_model.md`
- `docs/secure_runtime_alpha_614_startup_failure_matrix.md`
