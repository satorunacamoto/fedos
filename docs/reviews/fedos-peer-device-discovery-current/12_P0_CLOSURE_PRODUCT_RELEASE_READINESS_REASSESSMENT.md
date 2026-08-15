# Product Release Readiness Reassessment — P0 Closure mandate (mandate task #54)

Fresh, bounded, 4-role review performed AFTER this mandate's own implementation
work (timing fix, first-run recovery, release integrity, peer-device UX,
bidirectional Direct Ratchet proof, silent-downgrade truthfulness audit) had
already landed. Method: 4 independent agents, each forming their own
judgment against current code (not restating the prior
`09_PRODUCT_RELEASE_READINESS_REASSESSMENT.md` pass), each citing exact
file:line, several running real commands (checksums, `cargo build --locked
--offline`, live test suites) rather than trusting narrative claims.

## P0s found (1 new; fixed within this same mandate before closure)

### NEW, found and FIXED this pass: FIRST-RUN/ACCOUNT — corrupted/missing sealed Master Seed misreported as "wrong passphrase," zero recovery route, not even across restart

`detectProfileState()` only ever inspected the sealed-seed file when NO
descriptor existed; once a `"ready"` descriptor existed it routed straight
to `"locked"` without checking the sealed file at all. A live unlock
attempt DID correctly compute a distinct `"corrupt"` outcome, but the
renderer's `onUnlockSubmit()` only special-cased `"ok"`/`"recovery-required"`,
so `"corrupt"` fell into the generic "the passphrase did not match" screen —
and because detection never happened at `status()` time, even a full app
relaunch re-derived the same misleading `"locked"` state. A user whose
sealed key material is corrupted (disk error, partial write, antivirus
quarantine, or a sync conflict — this very repo lives inside OneDrive) was
told forever their passphrase was wrong, with genuinely zero recoverable
data ever at risk (mirrors the already-fixed interrupted-create-profile
P0's own safety invariant).

**Fixed** in this same mandate: `detectProfileState()` now does a cheap,
passphrase-independent structural check of the sealed file whenever a
`"ready"` descriptor exists, tagging a new `recoveryReason: "corrupt"`;
the renderer routes this to the recovery screen (new, honest,
data-loss-disclosing copy, distinct from the interrupted-create screen);
a new, narrowly-guarded `resetCorruptReadyProfile()` mirrors
`resetInterruptedProfile()`'s safety discipline in the opposite direction
(only fires when the descriptor IS `"ready"` AND an independent fresh
re-check proves the sealed file is genuinely missing/unparseable — refuses
unconditionally otherwise). A genuine wrong-passphrase case is structurally
incapable of triggering this path (confirmed by design and by test: a
wrong passphrase never touches/corrupts the sealed file on disk).
62/62 tests passing (50 pre-existing + 12 new), clean typecheck.

### Both previously-disclosed P0s (interrupted Create-Profile dead-end;
release checksum/filename mismatch; Cargo.lock reproducibility) — independently
RE-verified fixed this pass, not just trusted from the implementation streams:
real checksums recomputed and matched, `cargo build --locked --offline`
re-run cold and passed, the reset-guard matrix re-run live, the recovery
screen's real IPC/preload/renderer wiring re-traced end-to-end.

## SECURITY UI TRUTHFULNESS — independent classification: TRUTHFUL

A dedicated bounded audit (mandate items A-F) plus the Messenger/Security
role both independently concluded: **the system cannot currently produce a
false-GREEN security claim.** Every "forward secrecy"/"Ratchet
session"/"trusted device" UI string is gated on real, live state tied to
the same variables that govern the actual routing/trust decision;
`establishDirectRatchetSession()` (the only write that could ever make the
ENCRYPTION axis show "good") is unreachable outside the acceptance-test
harness in a real packaged launch. One DORMANT (never live in production)
false-GREEN vector was found in the forward-secrecy route selector
(missing a `lifecycleState === "active"` filter on candidate sessions) and
was fixed proactively before it could ever become reachable. A separate,
already-dead-in-the-safe-direction wiring gap was also found
(`setMessageDeliveryRemoteDeviceRef()` is never called, permanently
pinning the Forward-secrecy axis to its honest-negative state even in the
one scenario where the real send path would use Ratchet) — not a P0
(under-claim, not over-claim), disclosed as a P1.

## DIRECT RATCHET — classification: PARTIAL (exact boundary, no rounding up)

**PASS:** mutual peer-device trust learning, BOTH directions (Alice learns
Bob, Bob learns Alice); wrong-device rejection; stale/replay safety;
restart/offline durability for peer-device trust and for ordinary
(legacy-route) messaging in both directions.

**BLOCKED:** a genuine cross-account Ratchet session reaching `"active"`
on the RECIPIENT's own independent process. Root cause: a real
identity-space mismatch between the sender's same-account `localDeviceRef`
(Device Pairing) and the Peer Device Discovery Arc's separate,
randomly-generated cross-account `deviceId` — `establishSession()` embeds
the former as `senderDeviceRef`; the receiver's `#receiveSessionInit()`
compares against the latter's own space; they can never match for a
genuine two-account peer. The initiator's own unilateral session still
reaches `"active"` (asymmetric, one-sided). NOT fixed this mandate by
deliberate, explicit user decision — matches this mandate's own stop
condition ("account/Device trust authority becoming ambiguous" /
"cryptographic contract needing redesign"). A design-next document
(`11_DIRECT_RATCHET_IDENTITY_SPACE_DESIGN_NEXT.md`) reconstructs three
competing resolutions without choosing one, for a future arc.

**Silent downgrade: YES, confirmed, but NOT a truthfulness violation.**
`sendMessage()` always uses the legacy route in production (Ratchet
delivery is gated on a test-injection-only env var never set on a real
launch) — but see the TRUTHFULNESS classification above: nothing in the
UI/security-state layer claims otherwise.

## P1s found this pass (new or re-confirmed; not exhaustively re-listed —
see each role's own report for full file:line detail)

- **NEW — Peer Device Discovery re-announces on every conversation open,
  no throttling/dedup**: real signed Nostr wire message + append-only
  observation-log growth proportional to how many times a user reopens a
  chat. Not a leak, not a truthfulness issue, real unthrottled churn.
- **NEW — peer-device announcements auto-trust on receipt, no user
  confirmation step**, unlike Identity Replacement's explicit
  accept/reject/defer flow. UI copy is honest about what happened (no
  false claim of human verification), so not a truthfulness violation —
  a TOFU auto-trust design worth tracking given this project's history of
  HIGH-severity auto-accept findings elsewhere.
- **NEW — the mass Cargo.lock-policy test-file edit (35 files) initially
  weakened 33 of them by deletion rather than replacing with a positive
  assertion**, and the supersession doc's own account of this was
  inaccurate. Fixed within this same mandate: all 34 (recount found one
  more than the original 33-estimate) now carry a real positive assertion
  via the existing `fedosCoreRustGitTrackedPaths()` helper; the doc
  corrected.
- Re-confirmed, UNCHANGED from the prior pass: Commerce's 3 P1s (merchant-
  label bleed onto buyer Shop screen, missing TEST/LOCAL disclaimer at the
  Pay-Now click, spurious JPY ".00"); Messenger/Security's 4 P1s (raw
  untruncated pubkeys on Identity Replacement, pasted-raw-pubkey invitation
  flow, raw conversationId-only conversation identification, SmartScreen
  guidance doc-only); First-Run/Account's 3 P1s (unlock-failed
  misattribution — now less severe since the specific "corrupt" case is
  fixed, but the generic mislabeling for OTHER failure reasons remains; no
  confirmation gate on the un-recoverable-passphrase warning; no show/hide
  toggle); Release/Operations' unchanged items (no release-notes/changelog
  discipline, zero git tags, `generate_public_beta_gate.mjs` and the
  packaged-dependency-closure guard both still unwired from the real
  release pipeline, CI still honestly non-covering the Windows packaging
  path).

## Overall verdict

**P0 bar (zero) is met** as of this mandate's closure — the one P0 this
fresh pass found was closed within the same mandate, independently
re-verified by the role that found it would have found it (same detection
mechanism, now fixed). Direct Ratchet remains explicitly PARTIAL with its
exact boundary stated above, by deliberate scope decision, not oversight.
Security UI truthfulness holds. Commerce shows zero blast radius from this
mandate's changes. Multiple real P1s remain open and are disclosed here
for separate follow-up, consistent with this project's established
disclosure discipline.
