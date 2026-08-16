# Direct Ratchet Identity-Space Unification — Final Architecture Decision

**Status**: Coordinator decision record. Frozen. Written against `arc/fedos-installed-startup-root-cause` @
`83dca4ee`.

## Decision

**OPTION A.** Direct Ratchet's own `localDeviceRef` (currently Device Pairing's Space A `localDeviceId`) is
retired in favor of Peer Device Discovery's Space B `deviceId` — the only space a genuine cross-account peer's
`remoteDeviceRef` can ever come from. Full rationale, scoring, and alternatives comparison: `06_DECISION_MATRIX.md`.

## Canonical device identity

Going forward, "this local Device" for Direct Ratchet purposes means: the `deviceId` from
`readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`'s own durable identity file. Device Pairing's own
`localDeviceId` (Space A) is **unaffected** and continues to mean exactly what it means today for same-account
multi-device pairing — Option A does not touch Device Pairing's own writes/verification, only what *Direct
Ratchet* reads as "my device."

## Account→Device authority

Unchanged. `PersistedFedosDeviceTrustAuthority`'s "one account per device id" conflict rule and its
revoked-is-terminal rule continue to apply identically, keyed purely on `deviceId` string, regardless of which
subsystem generated it (design doc 02 §6, threat model 05 attack 9).

## Wire change

**NO.** `FedosDirectRatchetSessionInitPayloadV1.senderDeviceRef`/`recipientDeviceRef` and
`FedosDirectRatchetSessionResetSignableContent` keep their exact byte shape — only *which string* populates
these already-generic, already-opaque fields changes (design doc 02 §2, independently confirmed by design doc 03).

## Persistence change

**YES, additive only.** One new local self-binding `FedosDeviceBindingV1` row, written exactly once, at the
moment a fresh PDD identity is first generated, via the existing (unmodified) dual-signature
`FedosDeviceBindingRegistrationAuthority` — the same authority `#bootstrapLocalDevice()` already uses for Space A
self-registration. No new persistence *type* is introduced (contrast: Option B would have required one).

## Migration

**NONE required for live data.** `sessionId` is itself derived from `localDeviceRef`/`remoteDeviceRef`, so
changing which value populates `localDeviceRef` produces a new namespace automatically — old Space-A-keyed
session/sealed-secret rows become orphaned, unreachable, harmless dead data, never re-interpreted (design doc 02
§4.3). Confirmed independently: zero real cross-account Direct Ratchet session exists in production data today
(recon doc §5, re-confirmed by design docs 02 and 05).

**Known, disclosed limitation** (not a migration failure, a capability gap): any profile whose PDD identity file
already exists before this fix ships cannot be retroactively self-registered, because its Device private key was
already discarded per the codebase's own "never durably store a Device private key" invariant (design doc 02 §3.2,
§10 item 2). This affects zero current real users (Beta is unsigned, not publicly distributed, no closed-pilot
users on record) and is the same category of disclosed limitation as this Beta's existing "forgotten passphrase
is unrecoverable" / "no automatic update" notices. It is recorded here as a known constraint for any future
closed-pilot distribution planning, not silently glossed over.

## Old session compatibility

Old (pre-this-fix) session/sealed-secret records simply become unreachable — never read, never corrupted, never
silently reinterpreted under the new space (INV-12/13 from threat model 05 do not actually apply in practice,
since no re-seal migration is needed at all — see "Migration" above).

## Multi-device

Improves the future extension path: Space B is already the per-physical-device identity model every future
multi-device arc would need (one PDD identity file per machine); Option A means Direct Ratchet inherits this
model immediately rather than carrying Space A's "one value per running Runtime" assumption forward as a second,
competing concept (design doc 02 §9).

## Identity replacement

Unaffected. `06_PROTOCOL_CONTRACT_FREEZE.md` §8's existing rule (a trusted binding under account X never
auto-carries to a later Identity Replacement identity Y) is enforced by the Registry's own account-scoped
conflict rule, independent of which space `deviceId` values are drawn from (threat model 05 attack 7).

## Non-negotiable invariants carried into implementation

From threat model `05` §3, the Option-A-relevant subset (INV-1 through INV-11 are option-agnostic and already
hold; INV-12/13 formally apply but the underlying migration they guard turns out not to be needed — see
"Migration" above, so they are retained here only as regression guards against a *future* engineer mistakenly
believing a re-seal step is required):

- INV-1, INV-2: Registry conflict/revoked-is-terminal rules — untouched, must keep firing on the new self-binding
  write exactly as on every other `registerDevice()` call.
- INV-9: profile isolation — the new self-binding write targets the same profile-scoped Registry log, no new
  cross-profile surface.
- INV-12 (retained as a discipline note, not a live migration requirement): the self-binding registration itself
  must be idempotent (check-then-write) so a restart between "PDD identity created" and "self-binding registered"
  never double-registers or trips the conflict rule against itself.

## Implementation plan and test matrix

See `08_IMPLEMENTATION_PLAN.md` and `09_TEST_MATRIX.md`.
