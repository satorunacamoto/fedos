# Bounded Red Team — Own-Device Sync / Recovery Surface

Per mandate §34/§51, source-based (no new installed E2E this pass — see
`05_ROOT_CAUSE_AND_IMPLEMENTATION_PLAN.md` for why implementation was deferred, which
also bounds what's newly attackable this pass: nothing new shipped except one
truthfulness fix already gated last arc).

| Attack persona | Attempt | Result |
|---|---|---|
| Cross-device rollback attacker | Replay an old, validly-signed Sync Journal wire delivery after a newer conflicting one | **Would be caught** by `cursor-divergence`/`identical-duplicate` classification if the transport existed — but the transport doesn't exist yet, so this attack surface is currently **absent by construction** (nothing to replay against). Recorded as a requirement for the eventual transport's own test matrix, not a live finding. |
| Identity substitution | Attempt to make Sync Journal traffic claim membership in a different account/device than the signer | Structurally impossible for the EXISTING Job 1 (Registry snapshot) path — `sourceBinding.accountRef`/`targetBinding.accountRef` checked before any Relay I/O, `descriptor.author !== payload.accountPublicIdentifier` checked before any claim is trusted inbound. No live finding. |
| False-synchronized-state | Can a user believe sync succeeded when it silently didn't? | **Already found and fixed last arc** (`8712add7`) — `fedosDeviceManagementDeriveSyncActionState()` now correctly reports `"failed"` for a permanently-stuck schedule instead of a false `"running"`. Re-verified present in this arc's starting commit; unchanged. |
| Commerce authority bypass via sync | Smuggle a payment/completion fact through Sync Journal to force a false-paid/false-completed state on another device | Structurally impossible — no `commerce-*` record type is on `FEDOS_SYNC_ALLOWED_RECORD_TYPES` (verified, see `02_CONFLICT_AND_ANTI_ROLLBACK.md`). Commerce facts never enter this pipeline. |
| Profile-crossing | Payload prepared for Profile A's account applied to Profile B | `FedosSyncState` is constructed per-account (`accountRef` is a constructor parameter, not a runtime-mutable field); `FedosDeviceRelaySyncOutboundCoordinator`/`InboundHandler` both check account identity match before any state mutation. No live finding for the existing (Job 1) transport. The not-yet-built Job 2 transport's own implementation plan requires the identical check as a hard acceptance-matrix item. |
| Corrupt/tampered backup (whole-profile-directory, §22 of the prior Product Durability arc) | Feed a hand-edited settings/journal file back in | Out of this arc's own scope (recovery-bundle work remains P2, unchanged from the prior arc's own classification — see `05_ROOT_CAUSE_AND_IMPLEMENTATION_PLAN.md`). Not re-tested this pass; no new claim made either way. |

**No new P0/P1 found this pass beyond what was already known and already fixed.** The
Own-Device Sync feature itself remains a known, honestly-disclosed P1 (does nothing,
now says so) — not newly discovered, not newly worsened.
