# Alice-Reply-Send Investigation (bounded pass) + Arc Close

## Investigation, per the coordinator's own two questions

**1. Is this Tor-specific?** NO — confirmed via direct A/B test. Repeating Alice's exact reply
send with `FEDOS_BETA_STRICT_TOR_ENABLED` entirely unset (ordinary direct WebSocket to the same
real `wss://relay.damus.io`, no SOCKS, no Tor) reproduces identically: local `outcome: "ok"`,
Bob's independent process never receives it. This rules out anything specific to the strict SOCKS
factory, connection reuse, or Tor circuit state — the defect (or its trigger condition) lives
above the transport layer.

**2. Is this the known "local success ≠ delivered" pattern?** Partially, but more precisely than
that framing suggests. Traced the exact code path: `FedosConversationDirectMessagingCoordinator.sendDirectMessage()`
(`fedos_conversation_direct_messaging_coordinator.ts:246-283`) DOES `await` the real delivery
attempt (`sendRatchetMailboxNip17`/`sendMailboxNip17`) and attaches its real outcome as a
`delivery` field on its own return value — this is not fire-and-forget. However,
`FedosDesktopConversationContentAccessor.sendMessage()` (`fedos_desktop_conversation_content_accessor.ts:301-315`)
only reads `result.envelopeId`/`result.outcome` from that return value and **unconditionally
hardcodes `fanout: "not-applicable"`** for every direct-conversation send, regardless of what the
real, already-computed `delivery` outcome was. `FedosContentAccessorSendResult`'s own type
(`fedos_desktop_conversation_content_accessor_result.ts:91-97`) has no field to carry it even if
it wanted to. This is a **real, confirmed, always-true architectural gap, independent of Tor**:
the Shell/acceptance-test/renderer-facing `sendMessage()` API can never report the real delivery
outcome for a direct conversation, even though the coordinator underneath already knows it.
Separately, `FedosPrivateWireDeliveryQueueOutcome`'s own header (`fedos_private_wire_prepared_delivery.ts:75-78`)
documents that even the REAL, un-dropped `delivery` value would only ever mean "durably queued for
the Mailbox Delivery Scheduler's own next tick," never "relay-confirmed" — a deliberate, much
earlier (Alpha 1851) design choice, not new.

**Root cause of the actual non-delivery: NOT CONFIRMED, ruled out two specific hypotheses.**
Ruled out: (a) the Tor transport itself (A/B test above), (b) a too-short test-harness wait before
process exit — retried with the same `FEDOS_BETA_CONVERSATION_TRANSPORT_INTERVAL_MS=50` fast-tick
override that made every other send in this arc succeed, plus a longer 3s post-send wait; still
failed identically. **Best evidence-based hypothesis, not verified further within this bounded
pass**: Direct Ratchet's own documented role asymmetry (see this repo's own
`direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts` header) — Alice called
`establishDirectRatchetSession()` in this session, making her the crypto "receiver" role, whose
sending chain becomes ready only after decrypting a first real message from Bob (which she did,
successfully, in an earlier, separate process launch). Her REPLY attempt happens in a yet-later,
new process launch, meaning her live Ratchet session state has to be *restored* from the durable
sealed snapshot (this same session's own earlier Direct Ratchet Live-State Durability arc) before
a send can use it. A restore that correctly recovers "is this session generally active" but
subtly mishandles the specific "receiver role, sending-chain-now-ready" transition is a plausible,
specific, checkable next step — not confirmed here, and explicitly not chased further per the
coordinator's own bound on this pass.

**No source fix was made.** Per the coordinator's own instruction, a fix is only justified once
the actual root cause is confirmed — applying a change against an unconfirmed hypothesis would
risk masking the real defect rather than fixing it. HEAD remains `d03e48c2`, worktree clean.

**Recommended next step** (separate, focused arc): instrument the Direct Ratchet restore path
specifically for the receiver-role/decrypt-then-later-send transition, confirm or refute the
hypothesis above with real logging, and fix from there. Independently, `FedosContentAccessorSendResult`
should gain a real field carrying the actual `delivery` outcome instead of a hardcoded
`fanout: "not-applicable"` — a small, well-scoped, low-risk fix on its own regardless of the
non-delivery root cause, since it's already confirmed via source reading (not a hypothesis) and
affects every direct-conversation send's honesty, Tor or not.

## Process hygiene

Only the owned Tor process was touched (tracked PID, killed via `taskkill //PID //F`). One
unrelated `node.exe` (`scripts/rc9-real-x402-e2e.mjs`) belonging to a different, concurrent
session was observed and correctly left untouched.

---

# FINAL CONSOLIDATED REPORT — Public Relay Reliability + Gift-Wrap Subscription Narrowing + Tor Security UI + Real Two-Party Public-Tor Completion arc

```
STARTING CANDIDATEHEAD:            2c8cd936
STARTING EVIDENCEHEAD:             666d57b4
PUBLIC-RELAY/TOR-UI CANDIDATEHEAD: 22608b6f
FINAL CANDIDATEHEAD:               22608b6f  (no further source changes this pass)
FINAL EVIDENCEHEAD:                d03e48c2
CANDIDATE→EVIDENCE:                PASS (verified: git merge-base --is-ancestor)
WORKTREE:                          CLEAN
```

## Subscription

- ROOT RELIABILITY GAP: kind-only gift-wrap filter, no server-side recipient narrowing (verified
  via direct source read).
- OLD FILTER: `{kinds:[1059]}`. NEW FILTER: `{kinds:[1059], "#p":[localPubkey]}`.
- PRIVACY IMPACT: none — the tag is already required plaintext on every Gift Wrap.
- SERVER-SIDE NARROWING: YES, protocol-correct. BACKFILL: deliberately unbounded (durable
  mailbox semantics preserved).
- BUSY-RELAY TARGET: PASS — 8/8 new local tests (500→1, 2000→1 noise reduction, adversarial
  rejects, dedup, no-since-regression).
- **Real public-relay confirmation**: PASS — the exact reproduction that failed 4/4 rounds
  before this fix now converges on the first attempt over real Tor + real `relay.damus.io`.

## Public Tor Messenger

- TOR BOOTSTRAP: PASS (~26s real bootstrap, real binary from this repo's own worktree tree, not
  downloaded).
- ALICE FINDS BOB: PASS, first attempt. BOB FINDS ALICE: PASS, one retry (real-world timing).
- DIRECT RATCHET: establishes, reaches genuine `active`.
- BOB→ALICE: PASS — real Ratchet-routed message sent, received, and **correctly decrypted**
  end-to-end over real Tor + real relay.
- ALICE→BOB (reply): **FAIL, unresolved** — confirmed not Tor-specific, root cause not confirmed
  within the bounded investigation pass; see full writeup above. Not a discovery/timing issue —
  a direct raw relay query proved the reply message never reaches the relay at all.
- LEGACY FALLBACK: PASS under strict Tor (same composition-root factory).

## Tor UI

- BACKEND: PASS (pre-existing). RENDERER: PASS — new, 3/3 real DOM-driven tests (Off/Ready/
  Unavailable), explicit no-anonymity-claim scan.
- PACKAGED UI PROOF: dev-mode (dist/ + real electron.exe), not full NSIS package — disclosed.

## Regression

- typecheck: clean (2 pre-existing baseline errors only, unrelated files).
- test:current: 191/191 files, 0 failures (unchanged across this whole arc).
- Real-crypto Direct Ratchet regression suite: green throughout.
- Release pipeline: **re-run twice this arc, 14/14 both times** (`22608b6f` and again against
  `f6350a6a`/`d03e48c2`'s ancestor state) — verdict `ready-for-human-publication` both times, no
  new allowlist gap introduced.
- NEW REGRESSIONS: 0.

## Readiness

- P0: 0.
- P1: 3 — (a) Alice-reply-send non-delivery, general (not Tor-specific), root cause unconfirmed;
  (b) `sendMessage()`'s real delivery outcome is unconditionally discarded for direct
  conversations (confirmed via source, `fanout` always reports `"not-applicable"`); (c) Tor UI has
  no enable/disable toggle, read-only status only.
- P2: 1 — full release-pipeline re-run was done twice this arc but not against the literal final
  evidence commit `d03e48c2` (docs-only, no rebuild needed — the last code-bearing commit,
  `22608b6f`, was the one gated).
- PRODUCT RELEASE READINESS (non-Tor default): **COMPLETE**, unchanged — none of this arc's
  findings are Tor-specific in a way that would block the non-Tor default, though finding (a)/(b)
  above are real, general messaging-reliability gaps that affect the product regardless of
  transport and should be prioritized.
- TOR PUBLIC VALIDATION: **PARTIAL** — strong evidence for every foundational primitive plus
  one full real-message round trip; the reply-direction gap keeps this from COMPLETE per mandate
  §45's own bar (needs both directions).

## Next security/product queue (unchanged from the prior arc's own verified findings — not
re-audited this pass, nothing in this pass touched those systems)

- Session-Generation Ratchet: `NEEDS_DESIGN`.
- Alternate Persona: `NEEDS_DESIGN`.
- Device Sync: substantially wired, not formally re-verified COMPLETE.
- Recovery/Backup: already honestly disclosed in-app (local-backup-only, no cloud/passphrase
  recovery) — accepted, disclosed boundary.

**RECOMMENDED NEXT ARC** (revised, given this pass's own findings): a focused investigation into
the Alice-reply-send non-delivery — instrument the Direct Ratchet restore path for the receiver-
role/decrypt-then-send transition per the hypothesis above, and fix `FedosContentAccessorSendResult`
to carry the real delivery outcome instead of a hardcoded `"not-applicable"`. This is now a
higher priority than further Tor-specific work, since it's a general messaging-trust gap
independent of transport.

ORPHANED OWNED PROCESSES: 0. PUBLIC PUSH: NO.
