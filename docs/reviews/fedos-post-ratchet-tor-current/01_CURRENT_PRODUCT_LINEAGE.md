# Current Product Lineage — Reconstructed Authoritative State

**Status**: Coordinator record. Written against `arc/fedos-installed-startup-root-cause`.

## Git topology at the time this mandate started

```
CURRENT PRODUCT HEAD (at mandate start): a67406eb09fcbe0be346055e138721e7dc5bc2bc
```
This was itself a strict descendant of the arc's own prior CandidateHead/EvidenceHead pair
(`8b077419` CandidateHead, `a250e732` EvidenceHead) plus one follow-up source fix, confirmed
clean (`git status --short` empty) at that point.

## Work performed under this mandate (chronological)

| Commit | What |
|---|---|
| `83dca4ee` | Phase 0 evidence reconciliation against `a67406eb` (typecheck, targeted unit tests, forbidden-claim guard, live installed smoke — all re-run and confirmed against that exact commit, not inherited from an earlier one). |
| `b886a176` | Phase A architecture decision docs (`docs/reviews/fedos-direct-ratchet-identity-space-final/06-09`) — four independent parallel investigations (Option A design, Option B design, canonical-primitive archaeology, adversarial threat model) converged on Option A. |
| `f2440e01` | Direct Ratchet Option A composition-root wiring (`fedos_desktop_runtime.ts`: `localDeviceRef` now sources from Peer Device Discovery's `deviceId`, real dual-signature self-registration) + two independent release-readiness P1 fixes (stale `.d.mts` declarations causing `typecheck:electron` failures). |
| `cb7f0b9d` | Fixed a second, distinct, real bug found via live bidirectional proof: a conversation-activation startup-ordering race (inbound payloads for an already-known-but-not-yet-reactivated Direct Conversation were silently dropped). Also closed a typecheck ripple from the `f2440e01` `.d.mts` fix that had been masking a real type mismatch in an unrelated root test file. |

## Reconciled starting evidence

`RECONCILED STARTING EVIDENCEHEAD: 83dca4ee69dbef22be143ff7ee6257f4063fba6c` — confirmed
ancestor of every commit since. See `docs/reviews/fedos-direct-ratchet-identity-space-final/`
for the full architecture-decision record this mandate's Direct Ratchet closure work is built
on.

## Newer local branches with relevant unmerged work (found, not integrated)

`feature/commerce-tor-*`/`agent/tor-*` branch family — diverged from mainline at `4b808995`
(2026-07-26), last committed `27e2772f` (2026-08-05). Contains a substantial, previously
live-tested Tor implementation (SOCKS5 client, bundled-binary manifest, control-port client,
onion-service management). Targets the OLD pre-refactor `src/desktop/`/`src/conversation/`
layout, not the current `src/os/*` layout — real integration work required, not a fast-forward.
Full detail: `04_TOR_EXISTING_ASSET_AUDIT.md`. Not checked out, not merged, not modified by this
mandate.
