# 19 — Implementation Arc Packaging

## Comparison

| | A. Portable artifact only | B. NSIS installer only | C. Installer + checksums | D. Installer + signing | E. Installer + signing + manual update metadata | F. Full auto-update | G. Phased packages |
|---|---|---|---|---|---|---|---|
| Delivers this review's own primary format (`03`) | no | yes | yes | yes | yes | yes | yes, eventually |
| Requires a certificate this project does not have (`05`) | no | no | no | **yes — blocked today** | **yes — blocked today** | **yes — blocked today** | only in a later phase |
| Requires a distribution host this project does not have (`16`) | needs SOME host, but a simpler one | same | same | same | same, plus update-feed hosting | same, plus update-server infrastructure | needs a host by phase 1, more infrastructure by later phases |
| Combines unrelated concerns into one oversized Arc | no | no | no | yes (packaging + certificate acquisition/custody, a governance task, not an engineering one) | yes, more so | yes — packaging + signing + auto-update + implicitly schema-migration readiness, exactly the combination this review's own instructions warn against | no — each phase is independently shippable |
| Recommended? | as ONE deliverable within phase 1, not standalone | as the OTHER phase-1 deliverable | **yes — this is phase 1** | not yet (blocked on `05`) | not yet (blocked on `05` and `16`) | not yet (blocked on `05`, `16`, and real update-mechanism design, `15`) | **yes — this is the recommended shape** |

## Recommended sequencing (Phased, per option G)

**Phase 1 (the exact next Arc, named in `20`)**: implement the NSIS
installer target + the ZIP portable artifact + the `SHA256SUMS`
generation step, matching `02`/`03`/`07` exactly. No signing, no update
mechanism, no CI/release automation (all remain Absolute Prohibitions
for that Arc too, unless the user explicitly authorizes otherwise at
that time). This phase is safely separable from everything else because
it requires NO external dependency this project doesn't already have
(electron-builder already bundles NSIS; checksum generation needs only
`node:crypto`, already used elsewhere in this codebase, `07`).

**Phase 2 (a LATER, separate Arc, not named as "the next Arc" here)**:
stand up the actual distribution host (`16`) and publish a real Beta 0.1
release using Phase 1's own packaging output — a governance/operations
task (choosing and configuring real hosting) more than an engineering
one, and separable from Phase 1's own code changes.

**Phase 3 (a LATER, separate Arc)**: code signing, once a real
certificate is available (`05`) — a governance/procurement task
(acquiring and safely custodying a certificate) that this project has no
evidence is ready for yet, kept separate because bundling it with Phase 1
would block shippable packaging work on an unrelated procurement
timeline.

**Phase 4 (a LATER, separate Arc, only after Phases 2-3 are real and
stable)**: revisit `15`'s own automatic-update decision with real
signing and real hosting in place — not before.

## Why NOT to combine phases

Per this review's own instruction ("avoid an oversized Arc that combines
installer + signing infrastructure + auto-update + schema migration +
distribution hosting unless actual source proves they are safely
inseparable"): actual source proves the OPPOSITE — packaging (Phase 1)
requires zero new external dependency and zero external governance
decision; signing (Phase 3) requires a real-world certificate-acquisition
process with its own timeline entirely independent of any code; hosting
(Phase 2) is a separate operational decision; auto-update (Phase 4)
is explicitly rejected until Phases 2-3 exist (`15`). None of these four
are technically coupled in this codebase today — they are separable, and
this review recommends shipping Phase 1 alone as the next Arc.
