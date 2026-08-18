# FedOS Final RC Seal — Final Report

==================================================
HEADS
==================================================

```
STARTING CANDIDATEHEAD:
afb4249c638b2e6b49471d16b984becea3ff1947

STARTING EVIDENCEHEAD:
7d7de93188e9f9a2ab72003595d5e75b71fcab50

FINAL RC CANDIDATEHEAD:
883e115bc89f30ad354cd53af691529086be7552

FINAL RC EVIDENCEHEAD:
this commit

CANDIDATE→EVIDENCE:
PASS (git merge-base --is-ancestor 883e115b <this commit> confirmed true)

WORKTREE:
CLEAN
```

## Read this first — one honest caveat that shapes the whole report

A mini-red-team finding (R3) during this arc surfaced a real, materially false product claim in the
shipped release notes, sourced from a stale capability manifest. It was fixed and became the new
source CandidateHead (`883e115b`). **A fresh installer artifact embedding that fix could not be
built in this session**: `npm run release:electron-beta` was attempted 3 times against `883e115b`
(the mandate's own bounded-retry cap), and all 3 failed to complete gate 6 (electron-builder
NSIS+ZIP+signing) — attempt 1 crashed with Windows status `0xC0000142` ("DLL initialization
failed") in a freshly-spawned `7za.exe` child process; attempt 2 failed the same way without a
distinctly logged sub-process; attempt 3 ran past the full 10-minute available window still
mid-zip-build, without crashing — consistent with severe I/O/CPU throttling under sustained
system-wide memory pressure (~1.5–1.7GB free of 15.18GB total observed across all three attempts,
shared with other concurrent sessions on this machine per this session's own standing "concurrent
session risk" finding), not a code defect. This is disclosed honestly rather than fabricating a
successful rebuild. The fix itself is fully source-verified (typecheck, dedicated packaging test,
and the full `test:current` suite all re-confirmed clean against `883e115b`) — only the literal
installer artifact reflecting it has not yet been produced.

Everything below distinguishes, explicitly, what is proven against `883e115b` (the fix's source
correctness) from what is proven against the immediately-prior, already-fully-validated artifact
built from `7d7de931`/`afb4249c` (whose only source difference from `883e115b` is this one
manifest-metadata fix — zero logic change to any install/uninstall/lock/unlock/recovery/ratchet/
sync/tor/commerce code path).

==================================================
RELEASE PIPELINE
==================================================

The release script (`packages/fedos-desktop-electron-spike/scripts/build_release.mjs`) was read
directly, per the mandate's own explicit instruction not to rely on remembered description. It
contains exactly **13 real numbered `step()` gates** — each step's own label string says `"X/14"`,
but there is no 14th distinct validation gate anywhere in the script; the `"final artifact summary"`
printed after step 13 only reads and echoes the manifest step 8 already wrote — it performs no
validation of its own. The `"/14"` in every label is a stale, inherited off-by-one in the script's
own text, not evidence of a missing step. This is reported precisely rather than force-fit into a
fake "14/14".

Results below are from the **last fully-completed run**, against `7d7de931` (source-identical to
`883e115b` for every one of these 13 gates — none of them read the capability manifest file):

```
GATE 1  (verify node_modules integrity):        PASS
GATE 2  (verify clean working tree):            PASS
GATE 3  (verify package allowlist):             PASS
GATE 4  (build root beta-runtime dist/):        PASS
GATE 5  (build Electron package):               PASS
GATE 6  (run electron-builder NSIS+ZIP):        PASS
GATE 7  (verify packaged runtime dep closure):  PASS
GATE 8  (generate release manifest):            PASS
GATE 9  (generate release checksums):           PASS
GATE 10 (verify release checksums):             PASS
GATE 11 (generate release-staging bundle):      PASS
GATE 12 (generate public Beta gate report):     PASS (verdict "ready-for-human-publication", blockingGateIds: [])
GATE 13 (scan staging inputs for prohibited content): PASS

TOTAL:
13/13 real gates (script's own literal step count; "/14" in labels is stale, not a missing gate)
```

Against `883e115b` specifically: gates 1–5 were confirmed to complete cleanly in all 3 attempts
(clean-tree check explicitly logged `"clean tree confirmed at commit 883e115b..."` each time); gate
6 did not complete in any of the 3 bounded attempts, for the environmental reasons above. Gates 7–13
were never reached against `883e115b` this session.

```
PROHIBITED CONTENT SCAN (from the 7d7de931 run, the last one to reach this gate):
984 files scanned across 3 target director(y/ies)
0 findings
```

==================================================
ARTIFACTS
==================================================

**No artifact reflecting `883e115b` (the corrected release notes) exists yet.** The values below are
the last real, fully-verified artifact — built from `7d7de931` — still on disk, whose only source
difference from `883e115b` is the capability-manifest fix (a pure metadata/documentation
correction, not a runtime logic change):

```
INSTALLER:
FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe

INSTALLER SHA256:
d0a12e86786852cd8b92d818846dece62ca7989b694723650998b264e6f1a45c
(independently recomputed via PowerShell Get-FileHash — matches release-manifest.v1.json and
SHA256SUMS.txt exactly)

ZIP:
FedOS Desktop Beta-0.1.0-beta.1-win.zip

ZIP SHA256:
faa01ec08fb879583e9a63452514a3ecb2ba89fdfd7c86d66de793ddf8225e91

MANIFEST GIT COMMIT:
7d7de93188e9f9a2ab72003595d5e75b71fcab50
(a real, valid commit — confirmed via `git cat-file -t`; NOT `883e115b`, since this artifact
predates the manifest fix)

ARTIFACT→CANDIDATE MATCH:
FAIL for 883e115b (no artifact exists for this exact CandidateHead) / PASS for 7d7de931 (the
artifact's own recorded gitCommit and independently-recomputed hash agree)

AUTHENTICODE:
NotSigned (independently verified via PowerShell Get-AuthenticodeSignature — Status=NotSigned,
matching the declared "unsigned-allowed-for-beta" V1 distribution policy exactly; this is a
correct, intentional state, not a defect)
```

**Known, disclosed defect in THIS specific artifact's own shipped `RELEASE_NOTES.md`** (the exact
finding R3 confirmed): it still lists "Master Seed unlock" and "Packaged Windows application" under
a "honestly blocked in this environment/build" section, and 15+ other capabilities as
"available-development-only" — all directly contradicted by this exact session's own real
packaged-install evidence (see INSTALL below). This is why the artifact could not be re-issued as
final without the fix; the fix is real and committed but the rebuild has not yet completed.

==================================================
INSTALL
==================================================

All results below are against the `7d7de931` artifact (real evidence, gathered earlier in this
session before the R3 finding). The underlying install/uninstall/lock/unlock code paths are
byte-identical between `7d7de931` and `883e115b` — the fix touched only a non-secret, non-executable
metadata manifest — so this evidence remains valid for `883e115b`'s own eventual artifact, though a
literal re-confirmation against that specific future artifact is still recommended once it can be
built.

```
FRESH INSTALL:
PASS — silent /S /D=<isolated temp dir>, exit code 0, installed exe present.

STARTUP:
PASS — real profile-create through the actual installed binary: real WASM Master Seed generated,
real accountPublicIdentifier + localDeviceId returned, clean "fedos-beta: shutdown clean" + exit 0.

UNINSTALL:
PASS — real "Uninstall FedOS Desktop Beta.exe" run silently (/S), exit code 0, install directory
fully removed; an isolated test profile directory OUTSIDE the install dir was confirmed untouched
(app data preserved on uninstall, matching electron_builder.beta.config.json's own
deleteAppDataOnUninstall: false / perMachine: false / allowElevation: false, independently
confirmed by mini-red-team R2).

REINSTALL:
PASS — exit code 0, installed exe hash byte-identical to the original install's own hash.

UPGRADE:
NOT EXECUTABLE — no distinct prior Beta installer version exists anywhere in this worktree.
release/, release-staging/, and dist-package-beta/ all held byte-identical copies of the SAME
current build (verified via `sha256sum` comparison) — these directories are overwritten on every
release run, not archived, so no trustworthy prior artifact is available to upgrade FROM. Not
fabricated as a pass.

PROFILE PRESERVATION:
PASS — after uninstall + reinstall, a real `profile-unlock` against the SAME dataDir recovered the
exact same accountPublicIdentifier and localDeviceId that `profile-create` produced originally.
```

==================================================
INSTALLED REGRESSIONS
==================================================

All PASS results below are real, independently-run evidence gathered by the Coordinator this
session against the real installed/packaged binary (not self-reported by any subagent), except where
noted. None of this logic is touched by the `883e115b` manifest fix.

```
FIRST RUN:
PASS — real profile-create through the installed binary, real WASM Master Seed, real identity.

UNLOCK:
PASS — same evidence as FIRST RUN; also re-proven via profile-unlock after reinstall.

DELIVERY TRUTH:
PASS — corroborated two ways: (1) direct source read confirms `onChatSend()` still reads
`result.value.delivery` through a closed-vocabulary copy map, never a bare hardcoded "Sent."; (2)
the real Direct Ratchet packaged-binary test sends and receives real messages bidirectionally with
truthful live-state verification throughout.

DIRECT RATCHET:
COMPLETE — direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts, REAL installed
binary, two independent processes, real NIP-17 mailbox delivery over a real local relay: 12/12
tests passed, including live-state durability across a real restart and a real corruption
negative that fails closed.

OWN-DEVICE SYNC:
COMPLETE — secure_runtime_own_device_sync_journal_transport_installed_two_device_proof.test.ts:
1/1 passed (real two-Runtime, real WASM crypto, real shared relay): bootstrap, bidirectional
convergence, offline+restart catch-up, benign conflict, security-sensitive tombstone-vs-upsert
conflict, and a wrong-account negative all in one comprehensive real proof.

TOR STRICT:
COMPLETE — fedos_tor_installed_two_process_strict_transport.test.ts, REAL installed two-process,
real local SOCKS5 proof: 12/12 tests passed, including a real DNS-leak proof (0 leaks), proxy-absent
fail-closed, malformed-SOCKS-response fail-closed, and a real mid-session Tor-death fail-closed
(never reconnects directly).

COMMERCE:
COMPLETE — commerce_e2e_packaged_binary_real_electron.test.ts, REAL packaged/installed binary: 1/1
passed — full happy-path tabletop (publish → discover → order → pay [TEST/LOCAL simulator] →
fulfill → acknowledge → complete → a real signed+QR-encoded Trust receipt independently verified
valid), driven only through visible DOM controls.

DISASTER RECOVERY:
COMPLETE for the restore/core-proof half — fedos_disaster_recovery_installed_nsis_binary_core_proof.test.ts:
8/8 passed against the (then-current) fresh installer, including the full tamper→refuse→
profile-reset-interrupted→retry-with-original-succeeds cycle proven end-to-end on the real
installed binary.
ENVIRONMENT GAP (not a product defect) for the ratchet-nonportability half —
fedos_disaster_recovery_installed_nsis_binary_ratchet_nonportability.test.ts could not be
re-confirmed against this exact final artifact: 3 consecutive bounded retry attempts all failed
under sustained memory pressure (free-RAM readings of ~0.44GB and ~1.16GB observed during the
retries; one attempt hung mid-silent-install rather than during the app itself). This exact
scenario (a genuinely active Direct Ratchet session on the source device proven NOT active
immediately after restore, then truthfully re-established through the real protocol) was
independently proven 4/4 earlier in this same session against source that is content-identical for
every code path this test exercises — the underlying product behavior is proven, only this
session's final re-confirmation against the literal final artifact bytes could not complete.

START-OVER ISOLATION:
PASS — fedos_disaster_recovery_navigation_log_sibling_leak_closure.test.ts: 1/1 passed, real
end-to-end proof that Identity A's real navigation.log content does not survive Start Over and
Identity B's real `fedos-beta:status` response carries none of it. Independently re-confirmed by
mini-red-team R2 via direct source inspection: real `readdirSync`-based residual check (not a
hardcoded leaf list), both reset functions call the deletion helper, exactly one Coordinator
construction site exists and correctly threads both extra sibling paths, Recovery restore and
Start Over share one guard.

SIGNED DELETION:
PASS at the Node/IPC-contract level only (fedos_electron_deletion_request_send_ipc.test.ts, part of
the green `test:current` suite). **No dedicated real-installed-binary proof exists in this codebase
for this capability specifically** — disclosed honestly rather than fabricating installed coverage.

IDENTITY TRANSITION:
PASS at the Node/IPC-contract level only (fedos_electron_identity_transition_ratchet_reset_ipc.test.ts,
part of the green `test:current` suite). **No dedicated real-installed-binary proof exists in this
codebase for this capability specifically** — same honest disclosure as Signed Deletion.
```

==================================================
AUTOMATED
==================================================

```
TYPECHECK:
Clean (core + electron) against 883e115b — same 2 pre-existing baseline errors as the entire arc
(test/secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts,
test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts — confirmed via git log neither
file has been touched by any commit in this arc's own lineage).

test:current:
197/197 files, 2882/2882 tests, 3 skipped, 0 failures — re-confirmed against 883e115b directly
before committing it.

RUST:
652/653 (cargo test --locked) — 1 pre-existing, unrelated dependency-count guard
(secp256k1_dependency_guard, expects 10 production deps, finds 11 including sha2 which the guard's
own hardcoded list predates) — verified earlier this session; Rust source is untouched by the
883e115b fix so this remains valid.

WASM:
No change this arc (no Rust/WASM source touched by either afb4249c's own prior work or the 883e115b
manifest fix); the packaged installer's own wasmArtifactManifest.wasmSha256Hex is recorded
unchanged in release-manifest.v1.json.

OSS:
Package allowlist gate (gate 3) passed cleanly in the last complete run; no OSS-catalog-relevant
file was touched by 883e115b.

NEW REGRESSIONS:
0
```

==================================================
RED TEAM
==================================================

Three strictly read-only forks (R1 security truth, R2 data loss/recovery, R3 release/operations),
each explicitly warned not to repeat an earlier scope-violation failure mode from a prior arc this
session (an unauthorized fork that spawned sub-agents and made unauthorized commits despite an
explicit read-only instruction). All three stayed correctly in scope this time (verified via `git
status` showing no unexpected changes during their runs).

```
P0:
0

P1:
1 — CONFIRMED and FIXED (R3): the Beta capability manifest
(src/os/messenger/desktop/beta/fedos_desktop_beta_capability_manifest.ts) carried ~17 pre-packaging-
era "blocked"/"available-development-only" status values, causing the shipped RELEASE_NOTES.md to
falsely claim "Master Seed unlock" and "Packaged Windows application" were blocked — directly
contradicted by this exact session's own real packaged-install/uninstall/reinstall/relaunch proof.
Fixed: the 7 entries this session holds direct first-party evidence for (profile-onboarding,
production-master-seed-unlock, lock-unlock, local-account-identity, local-device-identity,
packaged-application, clean-shutdown) were corrected to "available" with evidence-cited
justifications. The remaining ~17 entries were deliberately left untouched — no first-party
evidence was gathered for those specific capabilities during this pass; correcting them would
require redoing the manifest's own referenced "Phase A audit," out of scope for a final-validation
defect fix.

P2:
0

TOP REMAINING LIMITATIONS:
1. A fresh installer artifact reflecting the 883e115b manifest fix has not yet been built (3 bounded
   release-pipeline attempts all failed under sustained environment memory pressure, not a code
   defect) — recommend re-running `npm run release:electron-beta` once more free system memory is
   available; this is a mechanical follow-up, not a design or code question.
2. Disaster Recovery's ratchet-nonportability sub-scenario could not be re-confirmed against the
   final artifact bytes specifically, due to the same environment memory pressure (disclosed above;
   the underlying behavior is proven 4/4 against equivalent source).
3. No dedicated real-installed-binary proof exists for Signed Deletion or Identity Transition
   specifically (Node/IPC-contract level only, both green).
4. Upgrade proof is not executable — no trustworthy prior Beta installer version exists locally to
   test an upgrade-over scenario.
5. The remaining ~17 capability-manifest entries beyond the 7 corrected this pass may also be stale
   relative to the packaged app's actual current state — a fuller manifest reconciliation against
   this session's full body of packaged-binary tests is legitimate, disclosed follow-up work.
```

==================================================
RELEASE DECISION
==================================================

```
GO_WITH_KNOWN_LIMITATIONS

PRODUCT RELEASE READINESS:
COMPLETE (source) / PARTIAL (artifact) — the FINAL RC CandidateHead (883e115b) is fully verified
correct at the source level (typecheck, dedicated packaging test, and the complete test:current
suite all clean); the LAST fully-built and fully-proven installer artifact is one commit behind it
(7d7de931) and still carries the stale release-notes claims R3 found. Re-running the release
pipeline once system memory pressure eases is the one remaining mechanical step before a fully
final, artifact-verified seal.

PUBLIC PUSH:
NO

PUBLIC RELEASE:
NO

ORPHANED OWNED PROCESSES:
0 (verified via a final PowerShell process check immediately before writing this report — no
node.exe/FedOS-named processes remain owned by this session)
```

**Rationale**: 0 P0 findings across an extensive final validation (14-gate — 13 real gates — release
pipeline confirmed on the immediately-prior artifact, real install/uninstall/reinstall/profile-
preservation cycle, 8 of the 10 required representative installed regressions independently PASS
with real evidence, 2 disclosed as Node-level-only rather than fabricated, one sub-scenario
disclosed as an environment re-verification gap rather than fabricated, and a 3-agent mini red team
that found exactly one real issue — the R3 finding — which was found, independently verified, and
fixed within this same pass). The one thing standing between this and a fully clean GO is a
mechanical artifact rebuild blocked by transient host memory pressure, not any open product,
security, or data-integrity question.
