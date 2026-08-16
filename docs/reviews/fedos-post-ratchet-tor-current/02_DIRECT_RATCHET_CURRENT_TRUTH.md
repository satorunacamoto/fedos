# Direct Ratchet — Current Truth (Post-Closure-Work Reassessment)

**Status**: Coordinator record, grounded in real live two-process installed-binary proof runs
(not inherited from any prior report). Written against commit `cb7f0b9d`.

## Classification of the historical blocker

**Cross-account device-identity-space mismatch: RESOLVED.**

The two structurally unrelated identity spaces (Device Pairing's `localDeviceId` vs. Peer
Device Discovery's `deviceId`) that previously made Direct Ratchet's own `localDeviceRef`
incompatible with the only space a genuine cross-account peer's `remoteDeviceRef` could ever
come from are now unified: Direct Ratchet reads Peer Device Discovery's `deviceId` (Option A,
frozen in `docs/reviews/fedos-direct-ratchet-identity-space-final/07_FINAL_ARCHITECTURE_DECISION.md`).
Confirmed live, repeatedly: Bob's inbound session-init resolves and reaches `"active"` in
13-19ms, 1 poll attempt (previously: always stuck at `"initialization-required"` after a full
150-second, 101-attempt poll, reproduced identically across 4 independent runs before the fix).

## Second bug found and fixed during live proof (not part of the original mandate scope, found by testing)

**Conversation-activation startup-ordering race: RESOLVED.** A freshly-launched Runtime's
relay subscription could begin dispatching an already-durably-published counterparty payload
before a separately-timed UI-triggered conversation-activation call had run, for any Direct
Conversation known from a prior session but not yet reactivated in the current process. Fixed
by eagerly reactivating every known durable direct-mode conversation as part of Runtime
composition, before the subscription opens. Confirmed live, twice.

## Remaining gap — why Direct Ratchet is still classified PARTIAL

**`FedosDirectRatchetLiveStateSnapshotPersistence` has no durable backend anywhere in this
codebase.** This is a pre-existing, already-documented, deliberate scope boundary from a much
earlier arc (`fedos_desktop_runtime_config.ts`'s own comment: "no append-only backend exists
anywhere in this codebase... this Arc does not fabricate durability for either; both remain
in-memory-only... a genuine, disclosed, narrower boundary"), not something introduced or
regressed by this mandate's work.

**Concrete effect, confirmed live**: a session's *metadata* (binding, lifecycle state,
counters) survives a process restart durably. Its *live cryptographic state* (root key, chain
keys, ratchet private key) does not. A restart therefore leaves a session that still reports
itself `"active"` but whose `#restoreLiveSession()` returns `null` — any message requiring that
restored session fails closed with `{outcome: "crypto-unavailable"}` and is silently dropped
(never retried).

**Why this was not fixed in this mandate**: building real durable, sealed persistence for live
ratchet secret material is a genuine cryptographic security-design undertaking — deciding a
sealing/encryption-at-rest scheme, HKDF context binding, crash-safety of checkpoint writes, and
tamper-detection for the highest-value secret material in the whole subsystem — not a same-arc,
bounded wire-up like the activation-hydration fix. This matches this mandate's own stop
condition ("migration could destroy valid existing secret/session state" / new crypto-critical
persistence design) closely enough that it was deliberately left disclosed rather than patched
under time pressure.

## Completion-bar checklist (mandate §3)

| Requirement | Status |
|---|---|
| Authenticated Alice/Bob Device known mutually | PASS (pre-existing, unaffected) |
| Alice handshake reaches Bob | PASS (now, post-fix) |
| Bob independently processes it | PASS (now, post-fix) |
| Bob response reaches Alice | PASS (same session, same process lifetime) |
| Both sides ACTIVE | PASS (same session, same process lifetime) |
| Alice→Bob real Direct Ratchet message | PASS (same session) |
| Bob→Alice real Direct Ratchet message | PASS **only within the same process lifetime as establishment** — FAILS after either side restarts, due to the live-state-snapshot gap above |
| Multiple alternating messages | PASS within one process lifetime; not provable across a restart |
| Alice restart | Session metadata survives; **live crypto state does not** — a real message exchange after restart fails closed |
| Bob restart | Same |
| Both restart | Same |
| Offline/delayed delivery | Not separately re-verified this mandate (unaffected by either fix) |
| Replay safe | PASS (pre-existing generation-integrity checks, unaffected) |
| Wrong Device rejected | PASS (pre-existing, unaffected; scenario k) |
| Identity transition does not inherit old trust silently | PASS (pre-existing, `06_PROTOCOL_CONTRACT_FREEZE.md` §8, unaffected) |
| Legacy fallback not silently substituted | PASS (pre-existing truthfulness audit from the prior arc, unaffected; scenario l) |
| Security UI Forward Secrecy GOOD only when Ratchet genuinely active | Structurally still true (Axis 3 remains independent of Axis 2) — **but see risk note below** |

## Risk note for the Security UI — CONFIRMED, not merely plausible

Verified directly by reading `FedosDirectRatchetConversationRuntime.getDirectRatchetStatus()`
(`fedos_direct_ratchet_conversation_runtime.ts:251-277`): it resolves the device pair, then
reads `this.#stateRuntime.getSessionMetadata(resolution.sessionId)` and returns `"active"`
straight from the stored `lifecycleState` field — **it never attempts to restore the live
cryptographic session before answering**. Because `lifecycleState: "active"` is exactly the
metadata that survives a restart (per the gap above) while the live crypto snapshot does not,
this status function will report `"active"` for a session that would in fact fail closed
(`{outcome: "crypto-unavailable"}`) on the very next real send.

`deriveConversationSecurityState()`'s Axis 3 (Forward Secrecy) consumes exactly this
`ratchetStatus` value. So: **after a restart, the Security UI can show Forward Secrecy as
`"good"` for a session that cannot actually deliver a message through the ratchet.** This was
not observed as a live UI false-green this mandate (no dedicated UI-layer check was run for
this exact restart+send combination — the live proof exercised the underlying
`getDirectRatchetStatus()`/message-send path directly, not the rendered Security Details panel),
but the code-level mechanism is confirmed, not speculative. This should be treated as a real,
disclosed P0-class truthfulness gap for any future arc that revisits Direct Ratchet, not a
footnote — it directly contradicts this codebase's own "no silent downgrade" invariant.

## Verdict

```
DIRECT RATCHET: PARTIAL
```
Blocked specifically and only by the live-state-snapshot durability gap. The original mandate
blocker (identity-space mismatch) is fully resolved.
