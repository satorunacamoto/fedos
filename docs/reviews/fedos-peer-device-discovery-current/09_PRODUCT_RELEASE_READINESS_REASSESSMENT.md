# Product Release Readiness Reassessment (Coordinator, mandate §54-58)

Fresh, bounded, 4-role review of the CURRENT product (not historical scores,
not code ambition), performed after Peer Device Discovery + Direct Ratchet
work stabilized. Method: 4 independent agents, each explicitly instructed
NOT to read prior readiness docs before forming their own view, each doing
real static source inspection plus (where applicable) actually running
real scripts/checks against the real, already-built artifact — never
fabricated. **FRESH NATIVE TABLETOP: NOT EXECUTABLE** by these agents (no
agent in this pass launched a real Electron process itself) — the
real, native, installed-binary evidence used instead is this arc's own
already-gathered E2E proof (Commerce full happy path, Security UI 3-scenario
suite, Peer Device Discovery 5-test suite including a real "active" Direct
Ratchet session), which is real native evidence but not independent human
UX validation.

## P0s found (4 total; 1 fixed this arc, 3 disclosed for separate follow-up)

### FIXED this arc: MESSENGER/SECURITY P0 — counterparty ref never resolved

`openConversation()`'s one call site of `conversationSecurityState()`
hardcoded `null` for `counterpartyAccountRef` on every conversation,
permanently stranding the Encryption/Forward-secrecy/Device-knowledge axes
at Unavailable/Unknown for every real conversation — including this arc's
own new, real peer-device-discovery data. **Fixed** (CandidateHead
`c5a06953`): `openConversation()` now resolves the one non-local active
membership from `conversationOpen()`'s own already-returned data and
threads it through. Re-verified live: the "never fabricate GOOD" safety
invariant still holds for a genuinely new peer even with a real
(non-null) counterparty ref (`verified_secure_session_ui_packaged_binary_real_electron.test.ts`,
3/3 passing post-fix); `test:current` (191/191) and the Commerce packaged
regression both re-run clean.

### DISCLOSED, NOT fixed (out of scope for this arc)

1. **FIRST-RUN/ACCOUNT — an interrupted first "Create profile" attempt
   permanently dead-ends a brand-new user with zero data to lose, no
   in-UI reset path.** The profile descriptor is durably written
   `"initializing"` before Runtime bootstrap completes
   (`fedos_profile_initialization_coordinator.ts:455-467`); any crash/
   force-quit in that window routes every future launch to a recovery
   screen offering only Retry/Copy-diagnostic/Quit — no "start over"
   action exists (`#recovery-actions` in `fedos_electron_beta_page.html`
   is declared but never populated by the renderer). Compounded by zero
   visual progress feedback during the real multi-second Argon2/WASM wait
   (a static, non-animated "Working…"), which raises the odds of the
   triggering force-quit. Belongs to the onboarding-coordinator subsystem;
   not touched by this arc.
2. **RELEASE/OPERATIONS — the pilot's own documented checksum-verification
   instructions reference filenames that don't exist.** `docs/pilot/INSTALLATION.md`
   tells users to verify `FedOS-Setup-<version>.exe` against `SHA256SUMS`;
   the real artifacts are `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` and
   `SHA256SUMS.txt`. Since the installer is genuinely unsigned (confirmed:
   `Get-AuthenticodeSignature` → `NotSigned`, no `win.sign` config, no
   signing attempt logged at all), this checksum instruction is the
   pilot's *entire* integrity story — and it's currently broken by a
   documentation/filename mismatch. A doc fix, not a code fix; out of this
   arc's scope.
3. **RELEASE/OPERATIONS — `packages/fedos-core-rust/Cargo.lock` is
   gitignored** (confirmed via `git check-ignore`), for a crate that now
   ships a real, embedded, cryptographic WASM binary in every artifact
   (not the "skeleton" the `.gitignore` comment's own rationale still
   describes). Already a known, standing gap per project memory; this
   pass independently reconfirmed it and notes its severity has grown
   quietly as the crate graduated from placeholder to shipping component.

## P1s found (scored harshly, not exhaustively re-listed here — see each
agent's own full report in the conversation record for file:line detail)

- **BUYER/COMMERCE**: "Acting as" selector on the buyer Shop screen reads
  "My Store — ⟨name⟩ (real profile)" — merchant-branded label bleeding
  onto a buying screen. "Pay Now" carries no TEST/LOCAL disclaimer at the
  moment of the click (the disclaimer only appears one step later, on the
  follow-up Simulate button). JPY prices render with a spurious ".00"
  (currency-agnostic cents-based formatting).
- **MESSENGER/SECURITY**: raw, untruncated 64-hex pubkeys shown with no
  comparison aid on the Identity Replacement accept/reject screen (the
  single highest-stakes trust decision in the product); the invitation
  flow requires pasting a raw 64-hex pubkey with no npub/bech32/QR/contact-
  picker support; conversations are identified only by raw `conversationId`
  in the list/header, never a contact name; this arc's own new peer-
  device-discovery capability has no UI entry point at all yet (reachable
  only via the acceptance-mode/IPC test harness — a real, disclosable gap,
  not a P0, since nothing false is claimed); SmartScreen/unsigned-installer
  guidance exists only in an external doc, never shown in-app at the
  moment a user hits it.
- **FIRST-RUN/ACCOUNT**: unlock-failed screen unconditionally blames "the
  passphrase did not match" even for non-passphrase failures (e.g. a
  genuine Runtime-start failure), sending a user into a futile retype
  loop; no confirmation gate on the "your passphrase cannot ever be
  recovered" warning; password-mismatch clears both fields, no show/hide
  toggle.
- **RELEASE/OPERATIONS**: no release-notes/changelog discipline anywhere
  in the repo, zero git tags ever cut; a real, working "is this actually
  ready for pilot publication" gate script (`generate_public_beta_gate.mjs`,
  confirmed run this pass: reports `humanApprovalPending: true`, several
  gates `not-met`) exists but is wired into nothing in the actual release
  process; the packaged-dependency-closure regression guard (created after
  a real prior incident) is not part of the scripted release pipeline;
  root/Electron-package version numbers are computed independently and
  never cross-checked; CI never exercises the real Windows packaging path
  at all (honestly disclosed in `ci.yml` itself, not a fake-green gate).

## Overall verdict

Commerce and account-creation happy paths are real and materially more
polished than typical Beta-stage code; the release SCRIPTS that exist
(allowlist, checksum, secret-scan) are real, correct, and independently
re-verified passing. But the product is **not yet release-ready** as a
whole: one genuine security-UI dead-end existed until this arc's own fix
landed; a real onboarding crash-recovery dead-end and a broken pilot
integrity-verification instruction remain open, disclosed, and require
separate follow-up arcs before a public/wider pilot.
