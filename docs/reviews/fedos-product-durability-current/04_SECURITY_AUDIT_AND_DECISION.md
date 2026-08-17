# Security Spot-Audit + Implementation Decision

## Security spot-audit (mandate §29-33), bounded

Grep-based, not exhaustive: zero `console.log`/`console.error`/`console.warn` calls
near passphrase/seed/secret/private-key-named variables found in
`fedos_electron_beta_main.cts` (the real packaged main process entry). Zero
`clipboard.writeText`/`clipboard.write` calls found anywhere under the Electron
package's `src/` or the desktop presentation layer — meaning there is currently no
copy-to-clipboard feature at all for secrets OR public identities in this codebase
(so no "accidentally exposes a private key via clipboard" risk exists, but also no
convenient public-key-copy feature — noted as a possible future UX nice-to-have,
not a security finding). No temp-file secret-leak scan performed this pass beyond
what the earlier `dataDir()` architecture fact already implies (all durable secret
material lives in the one profile root, sealed; no evidence found of secrets being
written to OS temp directories separately). **0 findings this pass** — bounded
scope, disclosed honestly.

## Implementation decision (mandate §52)

| Candidate | Decision | Reasoning |
|---|---|---|
| Broaden recovery notice to cover the whole `dataDir()` tree, not just 2 files | **IMPLEMENT_NOW** | High value (closes a real truthfulness gap — conversations/Device trust/Commerce/Ratchet sessions ARE recoverable by file copy today but the in-app notice doesn't say so), low ambiguity, file-disjoint from the Outbox arc (touches only `fedos_profile_recovery_notice.ts` and its 1 call site), no crypto/migration risk |
| General migration-transaction infrastructure | DESIGN_ONLY / DEFER | Speculative ahead of an actual second schema generation (mandate §52's own "do not force all discovered gaps into code") |
| Own-device-sync payload-coverage confirmation | DEFER | Needs its own focused pass to trace exactly which domains serialize into the sync package; not safely completable at solo-pass depth without risking a wrong claim |
| Own-device revocation parity proof | DEFER | Same reasoning — real, bounded, but needs dedicated verification time this pass doesn't have |
| Session-Generation Ratchet implementation | REJECT (this pass) | Explicitly design-only per mandate §38/§54; MEDIUM_VALUE/NEEDS_RESEARCH, not settled enough to implement |
| Alternate Persona implementation | REJECT (this pass) | LOW_VALUE relative to other open items, explicitly design-only per mandate §39 |
| Auto-update mechanism | REJECT, permanently per this codebase's own Absolute Prohibition | Confirmed already deliberately disabled; mandate §41 explicitly forbids building it without signing infrastructure this repo doesn't have |
| Full disaster-recovery E2E on installed binary | DEFER | The one thing worth backing up (whole `dataDir()`) already works by construction (it's just files) — a full installed-binary E2E proving "copy directory, launch, everything's there" is valuable but heavy; not attempted solo this pass, flagged as the top recommended follow-up |
| Fresh product tabletop | NOT EXECUTABLE | No native GUI automation tool available in this environment for a fresh-agent-driven session; not fabricated |

## Acceptance for what WAS implemented

`buildFedosProfileRecoveryNotice()`'s `warnings` array gains one new, honest,
non-secret-bearing entry recommending a whole-directory backup, and the
`backupItems` list gains a note-level clarification (kept as a new, additive,
purely-informational `wholeProfileDirectoryRecommendation` field rather than
silently expanding the required `backupItems` array's items list, since the
current 2-item required list is still independently correct — expanding the
"backup THIS directory too, for completeness" story is a genuinely new,
additive fact, not a replacement of the existing minimum requirement).
