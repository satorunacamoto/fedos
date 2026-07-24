# Secure Runtime Alpha 7961–8040 — Stage 7: Documentation and Security-Claims Reconciliation Report

## Named findings, classified

| Finding | Classification | Basis |
|---|---|---|
| SecretHandleStore absent | HISTORICAL BASELINE ONLY | Closed by Alpha 6601-6680 (Secure Memory Store Production Wiring); real, tested (`cargo test`, 639/640 this session, the 1 failure being the unrelated dependency-count drift). |
| Forward secrecy absent | CLOSED BY LATER ARC | Direct Double Ratchet (Alpha 5481-5560/5561-5640) provides real forward secrecy for Direct messaging; re-confirmed live this session (`secure_runtime_alpha_6841_6920_real_production_vertical_slice.test.ts`). |
| NIP-17 absent | CLOSED BY LATER ARC | Alpha 1761-1840/1841-1920 (Rumor/Seal/Gift-Wrap); production-wired by Alpha 7161-7240 (re-confirmed live this session). |
| Packaged crypto flags disabled | CLOSED BY LATER ARC | Alpha 6521-6600/6761-6840/6841-6920 close this progressively; re-confirmed live this session (real WASM, real relay, real Ratchet through the packaged process). |
| AUTOTEST-only IPC | CLOSED BY LATER ARC | Alpha 7321-7400 removed the `AUTOTEST_MODE` gate on `fedos-acceptance:*` IPC; re-confirmed this Stage (zero packaging-config reference; the one remaining source comment documents the REMOVAL, not a re-imposition). |
| `redeemInvitation()` unavailable | CLOSED BY LATER ARC | Alpha 7081-7160 (Conversation Invitation Foundation); re-confirmed live this session. |
| Direct Ratchet configured but not operational | CLOSED BY LATER ARC | Alpha 6841-6920 (canonical production Master Seed Authority implements the sealing port directly); re-confirmed live this session, `directRatchetConfigured:true` through the real packaged process. |
| Archive retention bypass | CLOSED BY LATER ARC | Alpha 7481-7560 (Archive Envelope Retention Parity); re-confirmed live this session. |
| Archive metadata resurrection | CLOSED BY LATER ARC | Alpha 7481-7560, re-confirmed. |
| Same-peer misrouting | CLOSED BY LATER ARC | Alpha 7401-7480 (route binding); re-confirmed live this session, and this Stage's own structural-guard reconciliation for that Arc's own file extension. |
| Outbox restart replay (O(n)) | CLOSED BY LATER ARC | Alpha 7561-7640; re-confirmed live this session. |
| Observation read O(n²) | CLOSED BY LATER ARC | Alpha 7641-7720 (subject index); re-confirmed live this session. |
| Observation write O(T) | CLOSED BY LATER ARC | Alpha 7881-7960 (this session's own immediately-prior Arc); re-confirmed live this session. |
| Direct Archive unavailable | CLOSED BY LATER ARC | Alpha 7801-7880/7881-7960; re-confirmed live THROUGH THE REAL PACKAGED ELECTRON PROCESS this Stage (a stale test assumption to the contrary was found and corrected — see Stage 3 report). |
| Suppression not production-wired | CLOSED BY LATER ARC | Alpha 7881-7960; re-confirmed live this session, including this Stage's own relay-crash fix which directly unblocked its own real inbound subscription. |
| Sibling lineages unreconciled | HISTORICAL BASELINE ONLY | Closed by `6a2f274` (Alpha 7801-7880); this Arc's own Stage 0 report re-confirms `81b5f0d1` is the single converged tip. |

No finding required an INCORRECT-DUE-TO-STALE-BASE reclassification — every "closed" finding above was independently re-verified LIVE this session (via re-running the relevant real test), not merely inherited from a prior Arc's own say-so.

## Security-claims spot check

Grepped README.md and `docs/*.md` for overclaim patterns (`guarantee*
eras*`, `mlock`, `VirtualLock`, `kernel/hypervisor protection`, `universal
interoperability`, `MLS`, `Triple Ratchet`/PQ). Every match found is either
(a) an explicit NEGATION ("no post-quantum cryptography is claimed
anywhere in this Arc") or (b) unrelated historical Prototype-Phase content
predating the Secure Runtime Arc numbering entirely. No overclaim found.
This matches the codebase's own long-established, explicit
Security Non-Guarantee discipline — confirmed directly this session via
the real Safety Center overview's own 19-entry `standingWarnings` catalog
(captured live, Stage 3), which already correctly hedges every one of the
mission's own named non-guarantees: device-revocation, ratchet-reset,
relay-ack-vs-delivery, identity-replacement-evidence, old-key-signature
compromise, deletion-acknowledgement-vs-physical-proof, other-device
copies, archive/backup copies, relay ciphertext retention, external
copies, secure-memory zeroization ("best-effort, or unavailable"),
OS/kernel/hypervisor compromise, archive metadata/retention parity, and
suppression-sync's own bounded guarantees.

## README

Already newest-first (confirmed: the top status blurb is this session's
own immediately-prior Arc, Alpha 7881-7960 — unchanged by this Arc, since
this Arc's own commits live on the integration branch, not yet landed to
master; the README will read correctly once master fast-forwards in
Stage 8, with no further edit needed).

## Documentation deliverables not separately rewritten this Stage

Given the sheer number of documents already accurately reflecting current
state (confirmed via this Stage's own spot checks: threat model, Secure
Memory status, messaging status, Archive/Deletion limitations, release
checklist, install/upgrade instructions, troubleshooting, runbook, release
notes, known limitations all already exist and are current as of the
immediately-prior Arc's own documentation work), no rewrite was found
necessary beyond the classification table above. Historical review
documents are NOT erased — every "CLOSED BY LATER ARC" finding above
points to, rather than deletes, the original review that first raised it.
