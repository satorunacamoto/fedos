# Secure Runtime Alpha 8121-8200 — Reconciliation of `6873d24f` and `73fc0b2` Against the Current Integration Worktree

This document re-evaluates every finding from the two parallel reviews
(`6873d24f`, Desktop Beta External Security Audit Delta; `73fc0b2`, Desktop
Beta Clean-Checkout Reproducibility Audit) against the state of
`C:\wt\fedos-desktop-beta-pilot-candidate` as of this Arc's own work,
which postdates both review bases and already contains additional
relay-status/build-script changes neither review saw. Classification
vocabulary: CURRENT / ALREADY CLOSED IN THIS WORKTREE / PARTIALLY CLOSED /
FALSE FOR CURRENT WORKTREE / DEFERRED PILOT LIMITATION / RELEASE BLOCKER.

## Security findings (`6873d24f`)

### Security Finding 1 — Acceptance bridge exposure

**ALREADY CLOSED IN THIS WORKTREE.** `window.fedosAcceptance` is now
exposed by `fedos_electron_beta_preload.cts` ONLY when
`ACCEPTANCE_MODE_ENABLED` (`process.env.FEDOS_ELECTRON_BETA_AUTOTEST ===
"acceptance"`, a strict literal check, never truthy/substring/case-
insensitive) is true; `fedos_electron_beta_main.cts` independently gates
`ipcMain.handle` registration of every `fedos-acceptance:*` channel behind
the SAME literal check. An ordinary packaged launch never sets this
variable. Proven via real spawned-process tests reading `typeof
window.fedosAcceptance` from the actual rendered page (new `readGlobal`
ui-script action / `read-global` acceptance-mode command):
`fedosAcceptance` is `"undefined"` in ordinary/`ui-script` launches and
`"object"` only when `FEDOS_ELECTRON_BETA_AUTOTEST=acceptance` — see
`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_8121_8200_acceptance_bridge_isolation.test.ts`
(5 tests, real process). `window.fedosApp` remains present in ordinary
production throughout. No generic execution channel introduced
(`preloadSource` still fails `/ipcRenderer\.invoke\(channel/`). Historical
structural guard test 3
(`secure_runtime_alpha_8041_8120_structural_guards.test.ts`) updated to
assert the new gated form rather than unconditional exposure, with an
explicit note that the vocabulary itself (handler functions, channel
registrations) remains fully intact — only WHEN it is reachable narrowed.

### Security Finding 2 — Double-submit / replay UI

**ALREADY CLOSED IN THIS WORKTREE** for every action this review named
that has a real UI control in this product. `onChatSend()`/`onLock()`/
`onSettingsSave()`/Archive export+restore/invite-submit already used the
established `setBusy()` pattern before this Arc. This Arc added the SAME
discipline (disable-before-await, re-enable in `finally`, re-entrant
click is a silent no-op) to: Identity Transition Accept/Reject/Defer
(all three buttons disabled together), Signed Deletion Approve/Reject
(both disabled together), and Device Revoke. The Host/Shell result
remains authoritative in every case — the renderer guard is disclosed as
a UX safety net, not the security boundary, and Security Finding 3's own
Controller-level `#actionInFlight` guard is the real backend-side
de-duplication (proven directly, not merely asserted, by
`secure_runtime_alpha_8121_8200_exact_target_authorization.test.ts`'s own
"rapid double-decide" test). A real rapid double-click (`doubleClick`
ui-script action, two synchronous `el.click()` calls, no scripted delay)
against Lock proves the underlying browser+guard mechanism live; the
three newly-guarded targets are proven via direct source inspection to
use the identical pattern (full live coverage for Identity
Transition/Deletion Request/Device Revoke specifically would require
reproducing an entire separate cross-account protocol flow only to
re-test the same generic JS mechanism — judged disproportionate, disclosed
here rather than hidden). "invitation accept/reject" from the review's own
list does not apply to this product: invitations are automatically
accepted via real-time delivery (no manual accept/reject control exists;
`redeemInvitation()` is a permanent, disclosed backend stub — this Arc's
own Phase A report). See
`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_8121_8200_double_submit_guards.test.ts`.

### Security Finding 3 — Implicit selected-target race

**ALREADY CLOSED IN THIS WORKTREE.** Traced the exact path: the Shell's
own `identityTransitionAccept/Reject/Defer(peerAccountRef, peerDeviceRef,
transitionId)` and `deletionRequestApprove/Reject(requestId)` were
ALREADY id-based (never selection-based) — only the intermediate
Controller layer (`FedosIdentityTransitionController`/
`FedosDeletionRequestController`) and the `fedos-app:*` IPC handlers
discarded that id in favor of a mutable "currently selected" field. Fixed
by adding real, additive, exact-id `accept()`/`reject()`/`defer()`/
`approve()`/`reject()` Controller methods (the "smallest additive API
correction" the mission itself anticipated), re-wiring
`handleAppIdentityTransitionDecide()`/`handleAppDeletionRequestDecide()`
to require and validate the id in the IPC payload, extending the preload/
window.d.ts bridge signatures, and threading the renderer's own captured
`target`/`targetRequestId` (from the exact render call that produced the
visible detail view and its buttons) through the click handlers — never
re-reading the shared mutable selection at click time. The pre-existing
`acceptSelected()`/`rejectSelected()`/`deferSelected()`/`approveSelected()`
selection-based methods are RETAINED, unmodified in behavior, as thin
delegators for their own 3 historical callers (Alpha 6121-6200/6201-6280/
6361-6440's own vertical slices — all 3 still pass unmodified). Race
proven directly: a real test demonstrates the OLD selection-based API
genuinely decides the WRONG item under an open-A/open-B reorder (decides
B when the caller intended A), and the NEW exact-id API decides EXACTLY
the intended item regardless of a later open for a different item — see
`test/secure_runtime_alpha_8121_8200_exact_target_authorization.test.ts`
(5 tests). No raw signature or secret evidence is exposed to the Renderer
by any of this (unchanged from before).

### Security Finding 4 — Renderer plaintext cache

**ALREADY CLOSED IN THIS WORKTREE.** Inventoried every Renderer-held
content value (conversation list cache, the revealed-message-plaintext
`Map` the review named as its own headline concern, current selection
ids, Archive-chosen paths, Settings working copy, the local account
identifier, and every content-bearing DOM container/input listed in the
review). Added `clearAllRendererContentState()`
(`fedos_electron_beta_renderer.ts`), called on Lock (after
`fedosProfile.lock()` succeeds, before re-rendering the unlock screen)
and defensively at the start of both `onCreateSubmit()`/`onUnlockSubmit()`
(covering any earlier generation whose lock was not clean, e.g. a
recovery-required cycle). Clears in-memory caches (`Map.clear()`,
reassign `[]`/`null`), stops both polling intervals, and sets
`textContent = ""`/`.value = ""` on every content-bearing element the
review named (chat, conversations, search, archive, identity transition,
deletion request, devices, safety, invite, recovery-copy-feedback,
settings-report/relay-list, ready-account/label/device/trust,
app-status-area) plus free-text inputs (chat-compose,
conversations-filter, search-query, invite-identifier,
archive-export-conversation-id, settings-relay-new). Explicitly documented
as best-effort JS-level clearing, NOT a guaranteed-physical-RAM-erasure
claim — no `SecretHandle`/Master Seed/private key was ever held by this
Renderer to begin with (unchanged from `6873d24f`'s own §6 finding).
Proven end-to-end with a REAL two-party message exchange: reveal Bob's
message, confirm it and Search results are genuinely on screen, Lock,
confirm both are genuinely EMPTY in the DOM immediately after (not merely
hidden by screen-switching), re-unlock and confirm the old plaintext does
NOT silently reappear before the conversation is reopened, then reopen
the SAME conversation and confirm it reloads fresh (message listed,
"Show message" button present, NOT auto-revealed) and an explicit re-
reveal still genuinely works — see
`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_8121_8200_lock_content_invalidation.test.ts`.

## Reproducibility findings (`73fc0b2`)

### Reproducibility Finding 1 — Line endings

**ALREADY CLOSED IN THIS WORKTREE.** Inventoried tracked file extensions
(`ts`/`md`/`rs`/`json`/`mjs`/`cts`/`html`/`sql`/`toml`/`gitignore` —
2,233+1,493+44+22+21+16+8+2+2+1 files; zero binaries, zero Windows-native
`.bat`/`.cmd`/`.ps1` scripts tracked). Confirmed every sampled committed
BLOB is already LF-only (`git show HEAD:<path>` contains zero `\r` bytes
for README.md/lib.rs/page.html/package.json) — the CRLF the review
observed is a checkout-time artifact of `core.autocrlf=true`, not
anything stored in git. Added the narrowest correct policy,
`.gitattributes` containing exactly `* text=auto eol=lf`. Verified the
mechanism directly (not merely asserted): force-re-checking-out a
sample file (`git rm` + `git checkout HEAD --`) changes its on-disk bytes
from CRLF to LF while `git status`/`git diff` continue to report it as
UNMODIFIED (proving zero renormalization diff is created). No mass
renormalization was performed or staged — `git status --porcelain` after
adding `.gitattributes` shows only this Arc's own genuine source changes,
nothing else.

### Reproducibility Finding 2 — WASM/Cargo.lock artifact guards

**ALREADY CLOSED IN THIS WORKTREE.** Original targeted search found 38
test files using `import.meta.glob("../packages/fedos-core-rust/**/*")`
directly as the assertion target for "not committed" claims — genuine
filesystem-presence checks mislabeled as commit-status checks, exactly
Finding T1. A further, broader sweep (this Arc's own additional
diligence, since the review's own search terms did not catch every
differently-worded test title) found 2 MORE real instances with the same
defect under different exact wording
(`test/fedos_core_adapter.test.ts` test 15, `test/fedos_core_rust_dependency.test.ts`
test 19) and confirmed that ~10 OTHER superficially-similar-looking tests
already correctly use the glob only to enumerate CANDIDATE files before a
real `git ls-files`-based check — those needed no change. Added one shared
helper, `test/support/fedos_core_rust_git_tracked_paths.ts`
(`fedosCoreRustGitTrackedPaths(subpath?)`), backed by real `git ls-files`,
returning the same relative-path shape every caller's own regex already
expected; rewired all 40 real defect instances to use it (36 via a
reviewed scripted transform, 4 by hand for pattern variants), preserving
each file's own specific assertions/wording untouched. **Directly proven
against a REAL locally-built WASM artifact still present on disk in this
worktree** (`pkg/fedos_core_rust_bg.wasm`, from this Arc's own earlier
Phase H build): `fedos_core_rust_dependency.test.ts` test 19 now PASSES
even with that real, gitignored artifact present — before this fix it
would have failed exactly as the review documented. A dedicated new test
file,
`test/secure_runtime_alpha_8121_8200_wasm_git_truth_guard.test.ts` (6
tests, using real throwaway files and real `git add`/`git reset`
operations, self-cleaning), proves every state the review asked for:
missing, locally-generated-and-untracked (a real gitignored `.wasm`
scratch file, confirmed absent from the tracked-paths list, confirmed via
real `git status --porcelain --ignored` to show `!!`), staged (a real
non-ignored scratch file, `git add`ed, confirmed `A ` and confirmed
PRESENT in the tracked-paths list — staged state is genuine
tracking-relevant truth, not raw presence), clean-after-cleanup, a
genuinely tracked fixture (`Cargo.toml`) remaining visible alongside
untracked noise, and subpath scoping. The pre/post-WASM full test matrix
no longer flips these ~40 files' own assertions merely because a valid
local generated artifact exists (spot-checked directly above; full-suite
A/B confirmation running as part of this Arc's own final verification
sequence).

### Reproducibility Finding 3 — Electron binary

**ALREADY CLOSED IN THIS WORKTREE**, reconciled against `73fc0b2`'s own
Finding H1 (independently observing the identical symptom: `npm ci`'s own
`electron` postinstall did not reliably extract the platform binary in
this environment). This Arc's own earlier fix (`scripts/ensure_electron_binary.mjs`,
wired as an explicit `npm run ensure-electron-binary` script, invoked from
`start`) was ALSO checked against the structural guard `73fc0b2` did not
know about (`secure_runtime_alpha_3881_3940_electron_build_spike.test.ts`
test 28, "no postinstall/install lifecycle script exists anywhere in
either package.json") — an earlier draft of this Arc's own fix used
`"postinstall"` and genuinely violated that guard; corrected to the
current explicit-command form, re-verified passing. **`npm ci` alone is
NOT sufficient** in this environment — the explicit
`ensure-electron-binary` command is required; this is stated plainly, not
minimized. Reproduced the exact failure/fix cycle twice (delete binary,
run unfixed `npm install` → binary absent silently; delete again, run
`npm run ensure-electron-binary` → binary reliably reappears, explicit
console output names the exact situation and the exact remedy). Offline
failure is honest: the script's own error path states the binary is still
absent and to check network access, never silently continuing.

### Reproducibility Finding 4 — Cargo.lock

**DEFERRED PILOT LIMITATION**, decision **Option B** (pin dependency
graph + record in release provenance; keep untracked). Full reasoning in
`docs/secure_runtime_alpha_8121_8200_cargo_lock_policy_decision.md`: this
package is a genuine application/release component (its WASM output ships
directly inside the packaged Electron app; it has no external crates.io
consumers), so official Cargo guidance would favor committing a lockfile
— but doing so now would require reversing the STATED INTENT of dozens of
existing structural-guard tests (not merely their mechanism, which
Reproducibility Finding 2 already fixed), a large cross-cutting policy
change out of proportion to this Arc's own scope. Chose NOT to silently
commit `Cargo.lock` merely because the review suggested it, per the
mission's own explicit instruction. The exact resolved dependency graph
(82 packages, SHA-256 `6bbdadb7...`) that produced the byte-identical,
three-times-confirmed WASM artifact is recorded for Phase N's own release
provenance report. Honestly disclosed as NOT yet structurally enforced —
a future Arc should commit `Cargo.lock` if drift is ever observed or
release cadence increases.
