# Secure Runtime Alpha 6681–6760 — Packaged Secret-Surface Audit

**FedOS Desktop Beta Release Candidate and Packaged Security Acceptance Arc — Phase G.**

## Method

`packages/fedos-desktop-electron-spike/scripts/scan_release_artifacts_for_secrets.mjs`
walks the ACTUAL staging inputs electron-builder packages (the compiled
`.cjs`/`.js`/`.html`/`.json`/`.d.ts`/`.ts` files under `packages/fedos-desktop-
electron-spike/dist/`, root `dist/`, and `packages/fedos-core-rust/pkg/`) —
not the compressed NSIS/ZIP containers themselves (LZMA/ZIP compression
means a raw-byte substring scan of the containers is unreliable; the
staging inputs are a strict superset check, since nothing reaches the
final artifact without passing through staging first).

Patterns scanned: embedded PEM private key/certificate, the repository's
own well-known test passphrase fixture, `.env`-style secret assignment
lines, npm/GitHub tokens, credential-embedded URLs, local worktree/user-
profile absolute paths, and the dev-only Master Seed double class name
(comment-aware as of this Arc's own fix, see the Execution Specification).

Per-run unique fixtures were used for the packaged vertical-slice checks
below (`FEDOS_BETA_AUTOTEST_SECRET` set to a distinct string each run,
never the repository's own well-known `correct horse battery staple`
fixture verbatim, to avoid a false "this exact string always appears"
result masking a real leak).

## Result

`node scripts/scan_release_artifacts_for_secrets.mjs` (from
`packages/fedos-desktop-electron-spike/`, against a freshly-built staging
tree): **0 findings across 732 staged files**, after this Arc's own fix to
the `dev-master-seed-double` pattern (see Finding 1 in the Execution
Specification — the 3 pre-fix matches were all inside comments explaining
why that class is NOT used, never real code, independently confirmed the
class's own file is not even compiled into the staged `dist/`).

## Additional manual checks performed

- **Renderer-visible output**: `fedos-beta:status`/`fedos-profile:status`
  IPC handlers (`handleBetaStatus`/`handleStatus` in
  `fedos_electron_beta_main.cts`) return only `displayLabel`/
  `accountPublicIdentifier`/`localDeviceId`/`deviceTrustState`/lifecycle
  strings — no `SecretHandle`, no raw Master Seed, no passphrase, by
  direct source inspection of every field constructed in `readyResult()`/
  `sanitizeStatus()`.
- **Main/preload logs**: `console.log`/`console.error` call sites in
  `fedos_electron_beta_main.cts` were enumerated; none log a secret byte,
  passphrase, or raw handle — only outcome strings, public identifiers,
  and non-secret status objects (this Arc's own new
  `unifiedGraphDiagnostics()` diagnostic follows the same discipline:
  booleans and a Shell-provided safe status `outcome` string only, never
  the Runtime/handle itself).
- **Durable profile stores**: `packages/fedos-core-rust`'s own
  `master_seed_authority_tests`/`secret_handle_store_production_wiring_tests`
  (re-run this session, all passing) already assert sealed envelopes and
  signed events never contain the raw seed material in plaintext; this
  Arc changes none of that code.
- **Local absolute paths**: the `worktree-absolute-path`/
  `windows-user-profile-path` scan patterns (unmodified, still
  comment-INSENSITIVE per the existing test's own explicit expectation)
  found 0 matches in the staged output.

## Honest limits (not overclaimed)

- This is a static/disk scan of staging inputs and observed process
  stdout/stderr, not a memory/heap inspection. It **does not prove total
  RAM erasure** — the repository's own Secure Memory guarantees remain
  handle-based zeroization-on-drop (`SecretHandleStore`), never an
  `mlock`/`VirtualLock`/OS page-locking claim (still honestly
  `Unsupported`/`NotRequested` — no native Desktop Rust host exists to
  request it from, unchanged by this Arc).
- A literal string scan cannot detect a secret split across multiple
  variables, base64/hex-encoded at rest, or introduced by a future
  dependency this pattern list does not yet name (the scanner's own
  header already discloses this; unchanged by this Arc).
- The compressed NSIS/ZIP containers themselves were not byte-scanned
  (by design — see Method); the staging-input superset check is the
  established, deliberate methodology from Alpha 5241–5320, unmodified in
  substance by this Arc (only the one comment-awareness precision fix).
