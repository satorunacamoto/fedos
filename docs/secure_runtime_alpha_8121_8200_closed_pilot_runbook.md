# FedOS Desktop Beta — Closed Pilot Runbook

**Status: closed-pilot internal document.** Not shown verbatim in the
application UI — referenced from user-facing docs/support guidance. No
secret, credential, or internal review commit hash is contained here.

## Emergency "stop using this build" process

If you discover ANY of the following while running this Beta, stop using
it immediately and do not create new profiles or send further messages
until you hear back from the pilot coordinator:

1. A message you did not send appears to have been sent from your account.
2. The application displays another profile's content after you unlock
   your own.
3. A passphrase, Master Seed, or other secret material appears anywhere
   on screen, in a log file, or in an exported diagnostic.
4. The installer or a running process is flagged by your antivirus/EDR
   tooling as something other than an unsigned, self-built Electron app
   you were explicitly told to expect as unsigned.
5. Any crash occurs during Lock, Archive restore, or Signed Deletion
   approval.

**Immediate action**: close the application, do not delete your profile
directory (it may be needed for diagnosis), and report the issue through
the pilot's designated feedback channel with: what you were doing, the
approximate time, and the version/build identifier shown on the Ready
screen's own "release info" text — never a passphrase, a screenshot of
open message content, or an exported profile/master-seed file.

## Issue severity and triage vocabulary

| Severity | Meaning | Example |
|---|---|---|
| **SEV-1 (stop pilot)** | A real confidentiality, integrity, or authorization break — content leaks across profiles/accounts, a decision is made against the wrong item, a secret is exposed | Cross-profile content leak; wrong-item Identity Transition/Signed Deletion decision |
| **SEV-2 (fix before next build)** | A real defect that does not break confidentiality/integrity/authorization, but produces incorrect or unsafe-adjacent behavior | A crash on a specific screen; a double-submit that is NOT deduplicated server-side |
| **SEV-3 (known limitation)** | Already-disclosed, intentional Beta behavior | Chat live-update is polled, not push; no automatic Relay reconnect |
| **SEV-4 (polish)** | Cosmetic/accessibility rough edge that does not block core use | A missing `aria-label`, a layout issue at high zoom |

A SEV-1 finding pauses the pilot for all participants until a fix and a
re-verification pass land; SEV-2/3/4 do not.

## Pilot exit criteria

The closed pilot concludes (moving toward a public release decision)
only when ALL of the following hold:

1. No open SEV-1 finding.
2. Every SEV-2 finding from the pilot period has either been fixed and
   re-verified, or explicitly re-classified (with reasoning recorded) as
   SEV-3/4.
3. The Pilot Release Matrix (`docs/secure_runtime_alpha_8121_8200_pilot_release_matrix.md`)
   shows no security-correctness FAIL.
4. An independent security audit has been commissioned (this pilot's own
   recommended next action) — public release remains blocked on human
   approval regardless of matrix status.

## Support scope

This is a closed pilot with a small, known participant group. There is
no 24/7 support commitment, no SLA, and no automated crash/diagnostic
upload of any kind. Feedback is reviewed by the pilot coordinator on a
best-effort basis. Do not rely on this Beta for any conversation you
cannot afford to lose or have temporarily unavailable during a fix cycle.
