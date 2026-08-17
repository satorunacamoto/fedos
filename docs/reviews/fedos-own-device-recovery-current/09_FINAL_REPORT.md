# Final Report — Own-Device Sync Closure + Machine-Loss Recovery + Release-Candidate Red Team

```
STARTING CANDIDATEHEAD:      a3421092
STARTING EVIDENCEHEAD:       a3421092
DEVICE-RECOVERY CANDIDATEHEAD: 8712add7
FINAL CANDIDATEHEAD:         8712add7
FINAL EVIDENCEHEAD:          f57812a0
CANDIDATE→EVIDENCE:          PASS (git merge-base --is-ancestor 8712add7 f57812a0)
WORKTREE:                    CLEAN
```

## Phase A — central finding

**Own-Device Sync has zero real transport wiring in production.** Traced end to end, source-
verified: `fedos_electron_beta_main.cts:5104-5106` calls `eventBridge.wrapAttemptFn()` with
zero arguments, so the Scheduler's fail-closed stub runs; `FedosDeviceRelaySyncOutboundCoordinator`
(the real relay transport) is never constructed anywhere in production. Every sync attempt
fails unconditionally, forever, in the shipped Beta binary, despite the scheduler being enabled
by default. Corrects a prior arc's "substantially real" assessment — the local primitives
(encryption, scheduler, conflict handling) are real; the end-to-end feature is a complete dead
end.

## Option A vs B decision (coordinator-directed follow-up)

Investigated Option A (wire the real transport) first, as preferred. Found it genuinely
intractable: the existing transport's `prepareAndPublish()` takes a whole `FedosDeviceSyncSessionV1`
device-list snapshot with no sequence-range concept, while the Scheduler's own `attemptFn`
needs to deliver sequence-ranged Sync Journal facts (`conversation-identity-metadata`,
`membership-metadata`, `capability-public-event`, `retention-tombstone-fact`,
`archive-reference`, `search-canonical-id`). Two structurally incompatible-shaped subsystems,
confirmed by the fact that every existing Scheduler test fakes `attemptFn` — no real, tested
bridge exists anywhere. **Went with Option B**: fixed a real, separate, precisely-scoped bug —
`fedosDeviceManagementDeriveSyncActionState()` declared `"failed"` in its own return type but
never produced it, so a permanently-stuck scheduler reported the identical `"running"` a
healthy one would. Fixed additively using data (`operatorRequiredCount`/`pendingCount`) already
flowing through; 6/6 new tests prove the fix and its negative space (never cries wolf on
ordinary transient retry).

## Also resolved this arc

- **Whole-profile-directory backup**: confirmed SAFE for the live Direct Ratchet snapshot
  specifically (AEAD device-context binding + freshness gate from this session's own earlier
  live-state-durability work fails closed on cross-device restore, never silently reuses stale
  crypto). Not yet a portable/versioned/sealed bundle — DESIGN_ONLY, correctly deferred.
- **Anti-rollback network-reconciliation**: resolved with bounded evidence — peer/own-device
  announcement subscriptions use the same deliberately-unbounded (no `since`) pattern already
  established for gift-wrap mailbox delivery, so a restored-from-backup profile self-heals
  stale trust state on next live reconnect, bounded by relay retention window.
- **Multi-device Direct Ratchet**: verified structurally impossible to reuse cross-device
  (different `localDeviceRef` → disjoint session-ID namespace), not merely discouraged.

## Correctly deferred, with explicit reasoning (not forced into code)

Recovery-bundle build-out, file-level migration mechanism, rollback runbook, own-device-sync
real transport wiring, and further red-teaming — all DESIGN_ONLY/DEFER, each with concrete
reasoning recorded in `01`-`06`, not silently dropped.

## Regression sweep (this round, against `8712add7`)

- Direct Ratchet installed regression (`direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`):
  **12/12 PASS**, all restart permutations, live-verification truthfulness and corruption
  fail-closed steps included.
- Peer Device, Identity Transition, Signed Deletion, Tor local strict-transport (5 targeted
  files): **56/56 PASS**.
- Commerce: not re-run this round (the heavy Commerce E2E suite is known-fragile under this
  session's own accumulated process load and previously crashed a vitest worker entirely).
  Substituted with direct evidence instead of a blind re-run: the one file this arc's fix
  touched (`fedos_device_management_screen_model.ts`) has **zero** Commerce references
  (grep-confirmed), and a prior arc this session already confirmed via source that Commerce
  shares none of the Messenger send/sync pipeline. Classification: COMPLETE, unaffected,
  evidence-based rather than re-tested.

## Second-device pairing — real installed proof (mandate §42)

Reused an existing test rather than building new, per coordinator preference:
`secure_runtime_alpha_8201_8280_device_pairing_visible_control.test.ts` — **2/2 PASS** against
this exact fixed commit: real pairing request creation, approval, and completion through
visible DOM controls only (no acceptance-mode shortcut), plus a wrong-account negative
(fail-closed, no Device trusted). This is the genuinely-working feature layer (own-device
*pairing/admission*, distinct from the broken *sync*) — confirmed still solid.

## Fresh release-readiness assessment — "would you trust this build with valuable user state for months?"

**Yes, for single-device use — with one clearly-scoped exception.** Across this entire session's
arcs, the core, single-device product (Direct Ratchet messaging, message-delivery truth, Tor
strict-transport, Commerce) has been proven repeatedly against the real installed binary, with
real crashes found and fixed along the way (not just "looks fine on paper"). Whole-profile-
directory backup is a real, currently-safe recovery mechanism for that core state.

**The one honest exception**: Own-Device Sync. It is enabled by default, does nothing, and — as
of this arc — reports that honestly instead of silently claiming success. A user who pairs a
second device today gets a real, working *admission* (proven above) but no data ever
synchronizes between the two devices; each is effectively an independent device sharing one
account identity, not a synchronized multi-device experience. This is a real product-maturity
gap, not a security defect — nothing is destroyed, nothing lies (as of this fix), and the
single-device story this fix doesn't touch remains solid.

**P0: 0. P1: 1** (Own-Device Sync non-functional, now honestly surfaced — was silent before this
arc). **P2: 2** (recovery bundle not yet portable/versioned; file-level migration mechanism not
yet built, non-urgent since only one schema generation has ever shipped).

**PRODUCT RELEASE READINESS: COMPLETE** for the advertised single-device product. **OWN-DEVICE
SYNC: PARTIAL** — pairing/admission COMPLETE, state sync PROTOCOL_GAP (real transport never
wired, correctly deferred rather than rushed). **MACHINE-LOSS RECOVERY: PARTIAL** — whole-
directory backup verified safe, portable/versioned bundle not yet built.

## Recommended next arc

Own-Device Sync real transport wiring (build the actual bridge between the Sync Journal's
sequence-ranged facts and a relay-based delivery mechanism — likely a new, purpose-built
transport rather than force-fitting the existing whole-snapshot device-list transfer
coordinator), with a real two-device installed proof of actual data arriving on the second
device. Second priority: the portable/versioned/sealed recovery bundle (§18-20 of this arc's
own mandate), now that whole-directory backup is confirmed as a safe (if unpolished) interim
baseline to build on top of.

## Process hygiene

Zero orphaned processes at final check. Worktree clean. No public push.
