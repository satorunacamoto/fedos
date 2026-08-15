# Agent X — Threat Model + Privacy Analysis for a Future Cross-Account Peer-Device Discovery Protocol

Phase A investigation, read-only. Repo worktree `C:\wt\fedos-installed-startup-root-cause`,
branch `arc/fedos-installed-startup-root-cause`. No production file under `src/`
or `packages/` was edited. This document does not design the protocol — it
stress-tests the design space against existing FedOS precedent so the
Coordinator's frozen test matrix is grounded in real mechanisms, not invented
security theater.

The hypothetical subject: a signed object announcing `{account identity,
device identity, capability, issuance epoch, optional
revocation/supersession ref}` — read as "peer_capability advertisement, but
scoped to work across accounts/conversations that don't yet share a
conversation", since that is the only existing FedOS shape close to it.

---

## 0. Precedent grounding — exact mechanisms, exact strings

### 0.1 `fedos_ratchet_peer_capability_acceptance_policy.ts` — how it rejects today

`evaluateFedosRatchetPeerCapabilityAcceptance()`
(`src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_acceptance_policy.ts:78-97`)
is a pure function, checked in this **exact, short-circuiting order**:

1. `peerDeviceTrustState === "revoked"` → `"revoked-device"` (line 81)
2. `peerDeviceTrustState !== "trusted"` → `"untrusted-device"` (line 82) — this
   single check catches **both** `"unknown"` (no local Device Registry
   binding at all) and `"pending"` alike; there is no separate rejection
   string for "never seen this device" vs "seen but not yet trusted".
3. `now > expiresAt` → `"expired"` (line 83)
4. `conflictingDuplicateAtSameRevision` → `"conflicting"` (line 84)
5. `priorAccepted !== null && revision <= priorAccepted.revision` →
   `"stale"` (line 85) — this is the ONE rollback check this file performs,
   and it is purely numeric (monotonic revision), not time-based.
6. (advertisements only) prior claim included the live ratchet route but
   the current claim dropped it → `"downgrade-detected"`
   (`isRouteDowngrade()`, lines 62-69, invoked at line 88) — the ONLY
   downgrade shape this Arc can detect from capability claims alone.
7. no shared `ratchet-suite` entry → `"unsupported"` (line 92)
8. no shared `private-message-route` entry → `"peer-incompatible"` (line 93)
9. otherwise → `"accepted"` (line 96)

The exact rejection reason string for an untrusted-device advertisement is
literally `"untrusted-device"` — a closed union member of
`FedosRatchetPeerCapabilityAcceptanceOutcome`
(`fedos_ratchet_peer_capability_acceptance_outcome.ts:12-25`), never a
boolean (the file's own explicit, commented requirement, lines 7 and 9-11:
"No outcome here may cause an already-active STRONGER route to be silently
weakened — `downgrade-detected` is a terminal, non-accepting outcome
specifically so a caller can never mistake it for acceptance").

Evidence level (Device-signature strength) is explicitly **never a gate** —
line 76: "Evidence level never gates acceptance on its own... it is
recorded, never enforced here." This is a deliberate, disclosed design
choice worth carrying forward or explicitly revisiting for the new protocol,
not silently inheriting.

### 0.2 `fedos_ratchet_peer_capability_nonce.ts` — replay bound

`generateFedosRatchetPeerCapabilityNonce()` (lines 12-14) produces 16
raw bytes (128 bits) of CSPRNG, hex-encoded (32 lowercase hex chars,
`FEDOS_RATCHET_PEER_CAPABILITY_NONCE_HEX_PATTERN`, line 16). There is **no
time-window replay bound anywhere in this file or the acceptance policy** —
replay defense is not a sliding window; it is exact-nonce-dedup performed by
the Inbound Coordinator's own observation-store lookup
(`#existingObservationForSource()`,
`fedos_ratchet_peer_capability_inbound_coordinator.ts:146-154`): an exact
repeat of an already-recorded `sourceId` (the nonce) is always `"duplicate"`,
checked BEFORE revision ordering/conflict detection (comment, lines
134-144). A DIFFERENT nonce claiming the same revision is a "genuinely new"
fact evaluated on its own merits and typically lands on `"conflicting"` via
the acceptance policy (§0.1 step 4). The nonce is also domain-separated per
record kind (advertisement vs lifecycle notification each embed their own
kind string in signed content), so a nonce collision across record types
cannot be confused for a replay of the other (nonce file header, lines 6-8).

### 0.3 `fedos_identity_transition_fact_conflict_detection.ts` — rollback precedent

`determineFedosIdentityTransitionFactWriteOutcome()` (lines 37-81) is the
rollback-detection precedent, over a lineage keyed by
`fedosIdentityTransitionLineageKey()` (all facts sharing the same OLD
account identity). Checked in order:

- Same `transitionId` already on file → `"already-present"` (identical
  content) or `"conflict"` (different content) — line 41-44.
- `revision === 0` re-claimed for a lineage that already has a revision-0
  fact → `"conflict"` (line 51) — this is "two competing replacement
  transitions" for the SAME old identity.
- Broken predecessor chain (missing/misordered `previousTransitionId`) →
  `"broken-predecessor"` (lines 50, 55-58).
- **The rollback check itself**, line 61: `candidate.revision <=
  maxRevisionSoFar` (the lineage's own running maximum) →
  `"rollback-detected"`. Purely numeric, exactly mirroring the
  peer_capability `"stale"` check in shape (§0.1 step 5) but with its own
  distinct terminal name.
- Two different transitionIds extending the SAME predecessor (competing
  siblings) → `"conflict"` (lines 63-66).
- Cycle in the predecessor chain (walking backward from the candidate,
  re-encountering an already-visited id) → `"cycle-detected"` (lines
  68-79) — this is a check the peer_capability domain has NO equivalent
  of today (advertisements have no chain, only a flat revision counter).
- Otherwise → `"inserted"`.

**VALID CURRENT vs SUPERSEDED** is never a stored flag — it's derived at
read time by `isFedosIdentityTransitionFactSuperseded()` (lines 90-95):
`true` iff some OTHER fact in the same lineage has a strictly higher
revision. The file's own header (lines 83-89) is explicit this is
deliberate: "this Arc never rewrites an already-inserted fact... 'Is this
fact superseded?' is instead DERIVED at read time." This precedent —
never mutate history, always re-derive current-vs-superseded from the
full fact set — is the correct pattern for a future peer-device
announcement's own "which of this peer's several devices/epochs is
current" question.

### 0.4 `fedos_identity_transition_evidence_evaluation.ts` — priority order

`evaluateFedosIdentityTransitionEvidence()` (lines 109-154) checks
history-derived facts (from §0.3) FIRST, before even timestamp validity or
cryptographic proof:

```
historyOutcome === "rollback-detected" → "rollback-detected"   (line 115)
historyOutcome === "conflicting"       → "conflicting"          (line 116)
historyOutcome === "superseded"        → "superseded"           (line 117)
historyOutcome === "stale"             → "stale"                (line 118)
```

only THEN timestamp skew/expiry (120-121), only THEN new-key proof
validity (123), only THEN the continuity/Device-corroboration/manual-review
combination. Two Absolute Prohibitions this file enforces (header, lines
16-28) are directly relevant precedent for "no silent downgrade" (§3
below): (1) a cryptographically-valid proof alone, under a compromise
reason, never reaches `"locally-acceptable"`; (2) under a compromise
reason, old-key continuity evidence alone caps at
`"manual-verification-required"` — Device corroboration or an explicit
manual-verification fact is required to go further. Concretely: **being
cryptographically correct is not sufficient to earn a "good" outcome when
the reason category itself signals compromise** — a lesson a peer-device
discovery protocol's own "device added because of suspected compromise of
the old device" case must mirror.

### 0.5 `fedos_identity_transition_safe_status.ts` — closed-vocabulary discipline to mirror

`FedosIdentityTransitionSafeStatusV1` (lines 18-28) is the DTO precedent:
closed, pre-computed status strings only (`evidenceOutcome`,
`acceptanceState`), `revision`, `previousTransitionId`, `superseded` (a
derived boolean, not a raw stored one) — explicitly **no private keys, no
raw signature bytes, no filesystem paths, no Ratchet secrets** (line 12).
It deliberately does NOT collapse `evidenceOutcome`+`acceptanceState` into
one summary flag (header, lines 8-9, citing its own "Phase B mandate"),
mirroring `fedos_ratchet_peer_capability_safe_status.ts`'s own discipline
(header, lines 2-9) where `"trusted"` is **deliberately never a value** —
"Phase O's own requirement that self-advertisement alone never displays as
trust; the closest available value is `"compatible"`" (lines 7-9,
14-23). This is the exact precedent a future peer-device-discovery safe
status must mirror: an announcement being well-formed, signed, and
non-stale must never render as "trusted"/"verified" — only as
"compatible"/"observed"/whatever the closest honest closed value is.

### 0.6 Existing adversarial tests — concrete precedent for how this codebase writes them

- `test/secure_runtime_alpha_5721_5800_capability_and_lifecycle_unit.test.ts:224-268`
  — direct truth-table tests over `evaluateFedosRatchetPeerCapabilityAcceptance()`:
  `"revoked device takes priority over everything else"` (224-226),
  `"unknown/pending device is untrusted"` (228-230, both map to
  `"untrusted-device"`), `"expired is rejected even when trusted"`
  (233-235), `"conflicting duplicate at same revision is rejected"`
  (237-238), `"a stale/rollback revision (<= prior accepted) is rejected"`
  (241-243), `"a ratchet-capable peer later advertising static-only is a
  downgrade, not an acceptance"` (246-252).
- Same file, `:452-506` — real end-to-end signature adversarial tests:
  forged account signature (a completely different signer signs the SAME
  canonical content) → `"bad-account-signature"` (line 469); wrong
  recipient device, **checked BEFORE any signature verification even
  runs** (comment, line 471) → `"wrong-recipient-device"` (line 473);
  unknown sender Device on a fresh registry → `outcome: "recorded",
  acceptanceOutcome: "untrusted-device"` (lines 476-490, the fact is
  still durably recorded as evidence, never hard-rejected at the wire
  layer — comment lines 487-489); revoked sender Device → `"recorded"`
  + `"revoked-device"` (lines 493-505).
- Same file, `:508-538` — `"replayed nonce (exact duplicate) is idempotent;
  a conflicting duplicate at the same revision is rejected"`: first import
  → `"recorded"` (519); exact byte-identical resubmission →
  `"duplicate"` (521); a SECOND, genuinely new advertisement claiming the
  SAME revision (different nonce) → still `"recorded"` at the wire/storage
  layer (a legitimately new fact) but the Phase J policy marks its
  `acceptanceOutcome` as `"conflicting"` (537) — "never silently accepted
  alongside the first" (comment, 532-536).
- `test/secure_runtime_alpha_5801_5880_identity_transition_persistence.test.ts:78-93`
  — `"detects a revision rollback (new transitionId claims a revision <=
  the lineage's max)"` → `"rollback-detected"` (81); `"detects two
  competing siblings extending the SAME predecessor"` → `"rollback-detected"`
  (92, not `"conflict"`, because the sibling REUSES a revision number
  already claimed, not merely a different predecessor pointer).
- `test/fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts:235-257`
  — `"rejects when the sending Device is unknown, revoked, or merely
  pending/untrusted"` → `"rejected-device-untrusted"` (244), and
  `":305-340"` — `"replay protection: an identical repeat of an
  already-recorded nonce is idempotent; a DIFFERENT attempt reusing the
  same nonce is rejected"` → `"accepted-idempotent-repeat"` (331) vs
  `"rejected-replayed"` (339). This is the SAME two-outcome shape
  (idempotent-exact-repeat vs rejected-conflicting-reuse) independently
  implemented in a sibling domain (Session Reset) — strong convergent
  precedent that any new protocol's replay handling should keep this exact
  two-outcome split, never collapse "identical redelivery" and "same-nonce,
  different-content" into one rejection.

### 0.7 `05_SECURITY_CLAIM_BOUNDARIES.md` — forbidden-claim discipline (reuse verbatim)

Already exists at
`docs/reviews/fedos-verified-secure-session-ui-current-readiness/05_SECURITY_CLAIM_BOUNDARIES.md`.
**Forbidden strings** (never write, §7 of that arc's own mandate): "Fully
secure", "End-to-end verified", "Identity verified", "All devices
verified", "Forward secrecy active" (as an unqualified claim), "No one can
intercept", "Anonymous", "Safe" (as a standalone claim). **Standing limits
shown always**: "FedOS has no safety number. There is no code you and your
contact can compare." and "This app does not know about, list, or verify
all of a contact's devices — only devices it has directly observed." Both
of these standing limits apply with FULL force to a cross-account
discovery protocol and should be reused verbatim, not re-derived — a
discovery protocol makes "devices it has directly observed" even more
load-bearing, since discovery is explicitly about observing devices
outside an existing conversation.

### 0.8 A genuine existing gap this precedent already has — must not be silently repeated

`FedosRatchetPeerCapabilityAdvertisementSignableContentV1`
(`fedos_ratchet_peer_capability_advertisement.ts:49-60`) includes
`conversationId` as a signed field (line 54, embedded in canonical
serialization at line 94) — so a receiver COULD detect a cross-conversation
replay. But:

- `FedosRatchetPeerCapabilityInboundCoordinator.importRumorContent()`
  (`fedos_ratchet_peer_capability_inbound_coordinator.ts:312-323`) takes
  **no conversationId parameter at all**, and `#importAdvertisement()`
  (156-225) never reads or checks `record.conversationId` against
  anything — it is accepted into signed content and then never enforced.
- `FedosRatchetPeerCapabilityObservationV1`
  (`fedos_ratchet_peer_capability_observation.ts:51-70`) has **no
  `conversationId` field**. Its own key functions,
  `fedosRatchetPeerCapabilityObservationKey()` (73-83) and
  `fedosRatchetPeerCapabilityObservationSubjectKey()` (86-92), key
  exclusively on `(localDeviceRef, peerAccountRef, peerDeviceRef,
  sourceKind, sourceId)` — replay/revision/conflict state for a given
  peer Device is a single GLOBAL counter across every conversation that
  peer Device is ever seen in, not scoped per conversation.

This is independently confirmed as a systemic pattern (not a one-off) by
`docs/reviews/fedos-verified-secure-session-ui-current-readiness/07_TEST_MATRIX.md`,
Part 3 "T1 — Wrong conversation, same peer" (lines 563-582) and its own
Summary point 4 (lines 706-713): "identity-transition peer-observation
state is NOT keyed by `conversationId` today — only `(accountRef,
deviceRef, transitionId)`. Conversation-scoping must be derived via
membership resolution... never assumed to be intrinsic to the transition
record itself." Two independent domains (Ratchet peer_capability AND
Identity Transition) built the exact same "global per (account,device),
not per-conversation" state shape.

**Implication for the new protocol**: a cross-account peer-Device
DISCOVERY protocol is explicitly MORE cross-conversation than either
existing precedent (its entire purpose is announcing a device across
contexts that don't yet share a conversation) — so it is at even higher
risk of inheriting this gap, and the consequence is worse: an advertisement
accepted/rejected/rolled-back for peer-Device X in one context could
silently gate or pollute the state read for the SAME peer-Device X in an
unrelated context. The new protocol's test matrix MUST include an explicit
cross-context isolation test (§4.3 below) — this is not optional
boilerplate, it is closing a proven, twice-repeated real gap.

---

## 1. Attack list

For each attack: mechanism, the testable outcome that MUST hold, and the
grounding precedent (existing pattern to mirror, or explicit note that no
precedent exists and one must be newly designed).

| # | Attack | Mechanism | Required testable outcome | Precedent |
|---|---|---|---|---|
| 1 | Wrong-account impersonation | Attacker signs a well-formed announcement under an account key that is NOT the claimed account identity (i.e., claims to be Alice's account but the verified `event.pubkey` differs from the claimed `senderAccountRef.publicIdentifier`) | Reject with a distinct, closed outcome (mirror `"bad-account-signature"`, `fedos_ratchet_peer_capability_authentication.ts:109-121`, verification checks `verification.accountPublicKeyHex !== record.senderAccountRef.publicIdentifier`, inbound_coordinator.ts:162); zero state mutation | `verifyFedosRatchetPeerCapabilityAccountAuthorization()` + inbound_coordinator.ts:161-164; test `:452-469` |
| 2 | Wrong-device substitution | A validly-signed-by-the-real-account announcement claims a DIFFERENT device identity than the one that actually produced any device-level signature, or than the device the local Device Registry has on file for that slot | Device-level evidence must fail closed to a REDUCED evidence level, never silently upgrade (mirror `evaluateFedosRatchetPeerCapabilityEvidence()`, authentication.ts:173-181, and the explicit "a bad signature is a hard rejection, never one of these three evidence levels" comment lines 152-154) | `authentication.ts:138-181`; reused pattern from `fedos_direct_ratchet_session_reset_authority.ts`'s `"rejected-signature"` |
| 3 | Malformed signature | Truncated/non-hex/wrong-length signature bytes | Structural codec rejects BEFORE any crypto call, fails closed, never throws (mirror `isWellFormedFedosRatchetPeerCapabilityAdvertisementV1`, advertisement.ts:186-200, `DEVICE_SIGNATURE_HEX_PATTERN` line 183) | advertisement.ts:196-198 |
| 4 | Tampered payload (any single field) | Flip one byte of `generation`/`revision`/`nonce`/`conversationId`/capability list post-signing | Signature verification fails for EVERY individually-tampered field, not just some (mirror session-reset test `"rejects a signature when ANY signed field is tampered"`, `fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts:177-194`) | same test file, lines 177-194 |
| 5 | Exact replay | Attacker (or a malicious/compromised relay) redelivers the byte-identical announcement | Idempotent no-op — `"duplicate"`/`"already-present"`, zero NEW state, zero re-evaluation against `priorAccepted` (mirror `#existingObservationForSource()` check BEFORE revision ordering, inbound_coordinator.ts:134-154, and `"accepted-idempotent-repeat"`, session-reset test :305-331) | inbound_coordinator.ts:179-181; test :508-521 |
| 6 | Stale/superseded replay after newer state exists | A genuinely differently-signed OLD announcement (lower revision, or referencing a device/epoch already superseded) is delivered AFTER a newer one was already accepted | `"stale"` (acceptance_policy.ts:85) or `"rollback-detected"` (fact_conflict_detection.ts:61) — MUST be purely revision/epoch-numeric, never inferred from arrival order alone (a genuinely-out-of-order-but-forward-progressing announcement must still be accepted, per §3 "reordering" analysis) | acceptance_policy.ts:85; fact_conflict_detection.ts:61; test :241-243, :78-93 |
| 7 | Cross-conversation substitution | An announcement legitimately signed for context A (conversation/relationship A) is replayed/reinterpreted in context B for the same peer account+device | **This is the one attack the existing precedent does NOT defend against today** (§0.8) — MUST be a first-class, explicitly-tested requirement for the new protocol: the receiver must scope acceptance/replay/rollback state per binding context, not globally per (account,device) | GAP — no positive precedent; negative precedent is §0.8 + 07_TEST_MATRIX.md T1 |
| 8 | Relay reorder | Relay delivers announcement N+2 before N+1 | Both are eventually accepted correctly once each arrives, in EITHER order, because acceptance is revision-numeric not arrival-order-based (grounded: acceptance_policy.ts never reads a delivery-order signal, only `revision`/`priorAccepted.revision`) — MUST be an explicit test, since this is currently only true by absence of a counter-example, not by an explicit test | acceptance_policy.ts:85 (numeric-only check) |
| 9 | Relay duplicate | Same relay (or multiple relays) redeliver identical content multiple times | Same as attack 5 — idempotent, zero side effects beyond the first | inbound_coordinator.ts:179-181 |
| 10 | Relay delay | Announcement delivered long after `expiresAt` | `"expired"` (acceptance_policy.ts:83), distinguished from "never arrived" per 07_TEST_MATRIX.md scenario 15's own "an omission is itself a false green" principle (lines 510-515) — the rejection must be a visible, attributable fact, not silently swallowed | acceptance_policy.ts:83; test :233-235; 07_TEST_MATRIX.md:502-522 |
| 11 | Relay injection (attacker-controlled relay fabricates a NEW announcement) | Only possible if the attacker can also forge a valid signature — otherwise reduces to attack 1/3 | Same rejection path as attack 1 | — |
| 12 | Unknown-peer handling | Announcement from an account/device never seen before, no Device Registry binding | `peerDeviceTrustState: "unknown"` → `"untrusted-device"` — the SAME outcome as a known-but-`pending` device (deliberately not distinguished, acceptance_policy.ts:82) — the fact is still durably RECORDED as evidence, never hard-rejected at the wire layer (comment, inbound_coordinator.ts header lines 9-16; test :476-490) | acceptance_policy.ts:82; test :228-230, :476-490 |
| 13 | Multiple-devices-per-account ambiguity | Same account has 2+ devices; an announcement about device B must never be attributed to, or gate state for, device A | Binding key MUST always be the `(accountRef, deviceRef)` PAIR, never `accountRef` alone (mirror `fedosRatchetPeerCapabilityObservationSubjectKey()`, observation.ts:86-92, which already includes `peerDeviceRef`; and 07_TEST_MATRIX.md "T4 — Wrong device (multi-device peer)", lines 603-612) | observation.ts:86-92; 07_TEST_MATRIX.md T4 |
| 14 | Identity-replacement stale-device-carryover | Account X completes an identity replacement (new account key) but a device previously trusted under the OLD account identity keeps announcing/being treated as trusted under the NEW identity without a fresh, independently-evaluated announcement | Must NOT auto-inherit — mirror `recommendFedosRatchetPeerSessionAction()`'s `"device-replaced"` case explicitly returning `"manual-review-required"`, never an automatic session/trust copy (`fedos_ratchet_peer_capability_session_action_recommendation.ts:47-50`, comment: "A brand-new Device identity per the Foundation Arc's own register-then-revoke discipline — never an automatic session copy/inherit"); also mirror 07_TEST_MATRIX.md "T6 — Wrong key-history (rollback/superseded confusion)" (lines 629-642) | session_action_recommendation.ts:47-50; 07_TEST_MATRIX.md T6 |

---

## 2. Privacy analysis

### 2.1 What a real announcement protocol unavoidably exposes

- **To the relay operator** (assuming, per this codebase's own established
  pattern, announcements travel as NIP-59 gift-wrapped Rumors — the Inbound
  Coordinator's own header explicitly receives "an already-unwrapped
  Rumor's own `content: string`", `fedos_ratchet_peer_capability_inbound_coordinator.ts:2-3`,
  implying unwrap happens above this layer): the SAME irreducible metadata
  every other NIP-17-shaped FedOS traffic already exposes — that *some*
  gift-wrapped traffic occurred, its rough timing, and the ephemeral
  gift-wrap pubkey. This is exactly the existing, already-disclosed
  `METADATA_EXPOSURE: not-protected` claim (`05_SECURITY_CLAIM_BOUNDARIES.md`
  line 46-47: "Relays can see that this conversation is happening.
  Encryption does not hide that.") — reuse this line verbatim for the new
  protocol rather than re-deriving a fresh claim; do not claim the
  discovery protocol is "more private" than existing Direct Ratchet
  traffic without new grounding.
- **To the counterparty** (the receiver of an accepted announcement):
  necessarily the announcing account's public identity, the specific
  device identity string, the claimed capability set, and the issuance
  epoch — this is the protocol's entire purpose and cannot be reduced
  further without breaking the feature.
- **To any observer who later obtains a copy of an accepted announcement**
  (e.g., a compromised receiving device, or if `claimedRoutes`-style summary
  fields are persisted, mirroring `FedosRatchetPeerCapabilityObservationV1.claimedRoutes`,
  observation.ts:67): the same account/device/capability/epoch tuple,
  durably, for as long as local persistence retains it. The observation
  record's own existing discipline — "Records ONLY safe, non-secret facts
  ... NO raw payload plaintext beyond these fields, no signatures, no
  keys" (observation.ts header, lines 12-17) — is the correct precedent
  to mirror for whatever the new protocol's own durable record shape is.

### 2.2 What must be avoidable (the mandate's privacy bound) — and what to actively test for

- **No global enumeration**: nothing about the protocol's wire shape may
  let an unrelated third party list "every device account X has ever
  announced" without already being an authorized recipient of at least one
  announcement. The existing advertisement precedent is bilateral by
  construction (`recipientAccountRef`/`recipientDeviceRef` are signed,
  checked-first fields, `advertisement.ts:52-53`,
  `inbound_coordinator.ts:157-158`) — this bilateral-addressing property
  MUST be preserved, not relaxed, by a cross-account variant. A test
  should explicitly assert an announcement addressed to recipient A is
  structurally meaningless (rejected, never merely "not relevant") when
  received by recipient B.
- **No stable tracking ID beyond what's cryptographically necessary**:
  the existing nonce (`generateFedosRatchetPeerCapabilityNonce()`,
  16 random bytes per announcement, §0.2) is already single-use and
  unlinkable across announcements by design — reuse this exact generation
  pattern (16-byte CSPRNG) rather than inventing a new nonce scheme. The
  new risk is the `deviceRef` field itself: today it is a free-form,
  bounded-length string (`isSafeIdField()`, advertisement.ts:117-121, max
  512 chars, NO format constraint) that is, by convention in existing
  tests, an opaque label like `"alice-desktop"` — but nothing in the
  codec ENFORCES opacity. This is a genuine, currently-unenforced gap
  (§2.3 below) a new protocol must close structurally, not by convention.
- **No device model / hostname / OS username / hardware fingerprint / IP
  / location**: none of these fields exist anywhere in the current
  `FedosRatchetPeerCapabilityEntry` closed vocabulary
  (`fedos_ratchet_peer_capability_vocabulary.ts:101-104`: only
  `private-message-route`, `ratchet-suite`, `lifecycle-capability` — all
  three are enum-shaped, not free text) or in
  `FedosRatchetPeerCapabilityAdvertisementSignableContentV1` (advertisement.ts:49-60).
  This closed-vocabulary discipline is exactly right and must be
  preserved verbatim by the new protocol's own capability field — never
  add a free-text "device description"/"platform" field.

### 2.3 What the EXISTING peer_capability precedent already leaks today (flag so it isn't silently repeated)

1. **Unconstrained `deviceRef`/`senderDeviceRef`/`recipientDeviceRef`
   format** (`advertisement.ts:117-121`, `MAX_ID_FIELD_LENGTH = 512`, only
   a non-empty/length check via `isSafeIdField()`) — nothing prevents a
   caller from putting a hostname, a hardware serial, or any other
   fingerprint-shaped string into this field. It is opaque only by
   convention in existing tests/call sites, never by codec enforcement.
   **A new cross-account discovery protocol MUST NOT inherit this as-is**
   — the device identifier field should be format-constrained (e.g. fixed
   length, fixed charset, ideally itself a derived/random value with no
   human-meaningful structure) so the codec itself, not caller discipline,
   prevents fingerprint leakage.
2. **§0.8's cross-conversation scoping gap** is also a privacy-relevant
   gap, not merely a correctness one: because observation state is keyed
   globally per `(localDeviceRef, peerAccountRef, peerDeviceRef)`
   (observation.ts:73-83) and not per-conversation, a local device's own
   internal state ends up correlating a peer's activity across every
   conversation that peer participates in, even though nothing in the
   *wire protocol* discloses that correlation to a third party. This is a
   local-data-model correlation risk, not a network leak — worth noting
   for whatever "unlink across conversations" property the future
   protocol's mandate expects.
3. **The raw Nostr `event.tags`** in `FedosRatchetPeerCapabilityAccountAuthorizationV1`
   carries a fixed, publicly-known marker tag,
   `FEDOS_RATCHET_PEER_CAPABILITY_NOSTR_TAG = ["t", "fedos-ratchet-peer-capability-v1"]`
   (authentication.ts:52) — if this tag is ever visible to a relay
   (i.e., if it is NOT itself inside a gift-wrap seal), it discloses "this
   client speaks the FedOS peer-capability protocol" independent of
   content. Given the file's own docstring frames this as
   "non-authenticating" and the Inbound Coordinator only ever sees
   already-unwrapped content, this is presumed wrapped — but this
   presumption should be an EXPLICIT, tested fact for the new protocol
   (a wire/transport test asserting the announcement's own domain tag
   never appears on an outer, unwrapped relay-visible event), not
   silently assumed.

---

## 3. "No silent downgrade" analysis — withhold/replay-only attacker

Attacker constraint: cannot forge a valid signature over any new content.
Can only withhold delivery of real, validly-signed data, or replay/reorder/
duplicate/delay data that was legitimately produced at some point.

| Attacker action | What it could try to make the UI show | Truthful degraded state that MUST appear instead | Grounding |
|---|---|---|---|
| Withhold the LATEST announcement entirely (never deliver a device-added/capability-upgrade) | Nothing — the receiver simply never learns the peer has a new capability. Not a downgrade of an existing claim, but a silent NON-upgrade that could be indistinguishable from "peer doesn't support X" | Must be represented as staleness-qualified, not absence-qualified: whatever "as of" timestamp is attached to the LAST accepted state must visibly age, per the `asOf`/`source: "cached"` vs `"live"` precedent design (`07_TEST_MATRIX.md` scenarios 12/13, lines 441-477) — an unqualified, timeless "compatible"/"good" is the forbidden false-green here | 07_TEST_MATRIX.md scenario 11 "last known as of `<timestamp>`" (lines 424-439) |
| Withhold a REVOCATION or downgrade-lifecycle notification while continuing to relay routine/unrelated traffic | The sharpest risk: make revocation invisible while everything else "looks normal", so DEVICE_KNOWLEDGE/EVIDENCE_INTEGRITY keep reading as current | The UI must never read as "current" beyond the timestamp of the last EVIDENCE actually observed for that specific fact category — routine traffic continuing must NOT refresh the "as of" timestamp for an unrelated fact (revocation-knowledge staleness and general-traffic-liveness must be tracked as genuinely separate signals, not one shared "connection is up" flag) | Same asOf/source precedent, applied per-fact rather than per-connection; grounded in `recommendFedosRatchetPeerSessionAction()`'s own "revoked-device outranks accepted-only mapping" priority (session_action_recommendation.ts:284-289 test) — the point generalizes: a revocation fact, once known, must dominate; the NEW risk is it never becoming known at all |
| Replay a stale/old announcement after a newer one WAS already locally accepted | Try to make the acceptance policy re-process it as if new | Must hit `"stale"`/`"rollback-detected"` deterministically (acceptance_policy.ts:85; fact_conflict_detection.ts:61) — already a solid precedent, MUST be preserved by the new protocol's own numeric epoch/revision field | §0.1 step 5, §0.3 |
| Replay a stale announcement when the newer one was ALSO withheld (combined withhold+replay) | Make the peer look exactly as it did before any change ever happened | Correct behavior IS "accepted"/no change — this is not a flaw, since from the receiver's perspective nothing newer genuinely exists yet. The truthful requirement is narrower: the resulting state must still carry an honest "as of" bound tied to the last announcement ACTUALLY received, never phrased as "no changes have ever occurred" (an absolute claim the receiver cannot actually know) | Same asOf precedent |
| Reorder delivery (deliver revision N+2 before N+1) | Attempt to make the earlier one, arriving second, look like a legitimate "current" update | Must hit `"stale"` when N+1 arrives after N+2 was already accepted (numeric revision check, not arrival-order) — N+2 itself, arriving first, is correctly accepted (no prior exists yet to compare against) | acceptance_policy.ts:85 is revision-numeric only, never reads arrival order — must be an EXPLICIT test for the new protocol, since today's precedent proves this only by absence of an order-sensitive branch, not by a dedicated test |
| Duplicate delivery (same announcement N times) | Try to trigger repeated side effects or re-evaluation drift | Idempotent, `"duplicate"`, zero incremental state change on 2nd..Nth delivery | inbound_coordinator.ts:179-181; test :508-521 |
| Delay delivery past `expiresAt` | Try to get a now-irrelevant claim accepted as current | `"expired"`, and this rejection itself must be a VISIBLE fact (07_TEST_MATRIX.md's own "an omission is itself a false green" principle, lines 510-515) rather than silently indistinguishable from "nothing was ever sent" | acceptance_policy.ts:83; test :233-235 |
| Withhold ONLY the follow-up "device-replaced"/identity-transition notification after a real identity replacement, while old-device traffic continues | Make the OLD device continue to look currently trusted under conditions where it should already require manual review | `"device-replaced"` must map to `"manual-review-required"`, never silent auto-continuation (session_action_recommendation.ts:47-50) — but note the attacker's real leverage here is WITHHOLDING that very notification, meaning the receiver may never learn to ask the question. Same asOf-staleness answer applies: the old device's trust state must visibly age from the last time ITS OWN specific fact was confirmed, not from general connectivity | session_action_recommendation.ts:47-50; 07_TEST_MATRIX.md T6 |

**General principle distilled from the precedent**: every one of the above
degraded states resolves the same way — the codebase's existing answer to
"attacker can only withhold/replay" is never a special-cased detection
rule per attack, it is a general discipline of (a) numeric/monotonic state
checks that are replay- and reorder-safe by construction, plus (b) an
explicit `asOf`/`source` (live vs cached) qualifier attached to every
displayed fact so that "I haven't heard anything new" is always rendered
as visible staleness, never silently coerced into an unqualified "good"
value. The new protocol's test matrix should treat "does withholding-only
ever produce an unqualified GOOD/compatible state with no staleness
qualifier" as a single, repeatable meta-test applied across every fact
category, not one bespoke test per attack row.

---

## 4. Proposed test-matrix shape (categories + concrete scenarios, no code)

### 4.1 Structural/codec validation
- Well-formed announcement round-trips encode→decode.
- Exact closed field set enforced both directions (extra field rejected,
  missing field rejected) — mirror `advertisement.ts:154-161`,
  `:186-200`.
- Oversized capability/entry list rejected at the bound (mirror
  `FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES = 16`, vocabulary.ts:107).
- Unknown capability/entry kind rejected (closed discriminated union,
  vocabulary.ts:116-134).
- Malformed device-identifier field (wrong length/charset once a format
  constraint is defined per §2.3 item 1) rejected.
- Malformed nonce (not exactly the defined byte length/hex pattern)
  rejected — mirror nonce.ts:16-20.
- `expiresAt <= issuedAt` rejected (mirror advertisement.ts:148).

### 4.2 Signature/authentication adversarial
- Forged account signature (different real signer, same claimed content)
  → rejected, distinct outcome, `accountPublicKeyHex` never populated on
  a non-`"valid"` outcome (mirror authentication.ts:88-92, 109-121).
- Signature verified against the WRONG public key → rejected.
- Every individually-tampered signed field (account ref, device ref,
  epoch/revision, capability list, nonce, expiry) independently breaks
  signature verification — one scenario per field, not a single combined
  scenario (mirror the session-reset per-field tamper test,
  `fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts:177-194`).
- Device-level signature (if the new protocol keeps an optional
  device-level proof, mirroring `deviceSignatureHex`) verified ONLY when a
  device public key is on file; supplied-but-unverifiable when no key is
  on file is harmlessly accepted at a REDUCED evidence level, never
  silently promoted (mirror authentication.ts:173-181, three distinct
  evidence-level test in `:270-303`).
- Domain-separation check: a signature produced for one record kind/domain
  string never verifies against a differently-domained digest (mirror
  advertisement.ts header lines 19-24, and the "distinct preimage
  prefixes" smoke test at `:196-205`).

### 4.3 Identity/context binding correctness
- Wrong-account impersonation (claimed identity != cryptographically
  verified signer) → rejected before any other check runs.
- Wrong-recipient account/device → rejected BEFORE signature verification
  (mirror the ordering at inbound_coordinator.ts:157-158, proven by test
  `:471-473`).
- **Cross-conversation/cross-context substitution** (§0.8 gap,
  §1 attack 7): an announcement legitimately valid in context A, replayed
  verbatim into context B for the same peer account+device — MUST be
  rejected or at minimum MUST NOT silently gate/pollute context B's own
  independent state. This is the highest-priority NEW test category; no
  existing precedent test covers it (07_TEST_MATRIX.md T1 documents the
  identical gap in the sibling identity-transition domain as
  unaddressed).
- Multi-device-per-account ambiguity: two devices sharing one account,
  a fact about device B must never surface when querying device A (mirror
  07_TEST_MATRIX.md T4).
- Multi-account-per-local-device (if the new protocol must support
  several local accounts): state for remote peer Z recorded under local
  account 0 must not leak into local account 1's own query (mirror
  07_TEST_MATRIX.md T3).
- Wrong-membership / never-a-relationship: an announcement about an
  account/device the local side has literally no relationship with yet
  must resolve via `"unknown"`/`"untrusted-device"`, never silently
  attributed to an unrelated existing relationship (mirror
  07_TEST_MATRIX.md T5's membership-first discipline).

### 4.4 Ordering / replay / rollback state machine
- Exact byte-identical replay → idempotent no-op (`"duplicate"`).
- Different nonce/content, same epoch/revision → `"conflicting"`, not
  silently accepted alongside the first.
- Strictly lower epoch/revision after a higher one was already accepted →
  `"stale"`/`"rollback-detected"`.
- Reordered-but-forward-progressing delivery (N+2 before N+1) → both
  eventually correct once each arrives, independent of order.
- Delayed delivery past expiry → `"expired"`, visibly distinct from
  "never sent".
- Two competing announcements at the SAME starting epoch/revision for the
  same subject (mirror fact_conflict_detection.ts:51's revision-0
  competing-transition case) → `"conflict"`.
- Broken predecessor/supersession chain reference (if the new protocol
  adopts a chained epoch/supersession-ref model like Identity Transition's
  `previousTransitionId`) → rejected, mirror
  fact_conflict_detection.ts:50/55-58.
- Cycle in the supersession chain (if chained) → rejected, mirror
  fact_conflict_detection.ts:68-79 (a check the flat-revision
  peer_capability model has no equivalent of and the new protocol should
  explicitly decide whether it needs).

### 4.5 Trust-state gating
- Unknown peer device (no local binding) → `"untrusted-device"`, fact
  still durably recorded as evidence, never hard-rejected at the wire
  layer.
- Pending (known but not yet trusted) peer device → identical outcome to
  unknown (deliberately not distinguished, mirror acceptance_policy.ts:82).
- Revoked peer device → `"revoked-device"`, and this outrank every other
  simultaneously-true condition (mirror the evaluation order at
  acceptance_policy.ts:81 being checked FIRST).
- A revocation notification racing a fresh, otherwise-valid announcement
  from the same device → revocation must win regardless of arrival order
  once both are known (mirror `revoked-device` priority test,
  session_action_recommendation test lines 284-289).

### 4.6 Downgrade detection
- Previously-claimed stronger route/capability silently dropped in a
  later announcement → `"downgrade-detected"`, terminal/non-accepting
  (mirror `isRouteDowngrade()`, acceptance_policy.ts:62-69, test
  `:246-252`).
- Every withhold/replay/reorder/duplicate/delay scenario from §3 above,
  applied systematically, must never produce an unqualified
  good/compatible/current state without an accompanying `asOf`/staleness
  qualifier — this is the single cross-cutting meta-test from §3's closing
  paragraph, applied once per fact category the new protocol introduces.

### 4.7 Cross-domain isolation (identity-replacement carryover)
- A device trusted under an account's OLD identity must not be silently
  treated as trusted post-replacement without its own fresh,
  independently-evaluated announcement (mirror
  session_action_recommendation.ts:47-50 "device-replaced" →
  "manual-review-required").
- Rollback/supersession confusion across an identity-replacement boundary:
  the evaluator must reflect the CURRENT identity's own state only, never
  resurface a stale ATTENTION tied to the superseded identity (mirror
  07_TEST_MATRIX.md T6, and `isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity()`'s
  "never fires once superseded" proof).

### 4.8 Privacy/metadata bound
- Bilateral addressing preserved: an announcement addressed to recipient A
  is structurally meaningless when processed as if received by recipient
  B (no accidental "close enough" acceptance).
- No wire field accepts free-text device description/platform/hostname —
  every capability/entry remains a closed enum (mirror
  vocabulary.ts:101-104).
- Device-identifier field format-constrained (fixed length/charset,
  ideally random) — a dedicated test asserting the codec REJECTS a
  hostname-shaped or otherwise human-meaningful string once that
  constraint is defined (closing §2.3 item 1).
- Domain/marker tag (if any, mirroring `FEDOS_RATCHET_PEER_CAPABILITY_NOSTR_TAG`)
  never appears on an outer, relay-visible unwrapped event — an explicit
  wire/transport-boundary test, not an assumption.
- No API/query path exists that lists all devices/announcements for an
  account without the caller already holding at least one valid,
  addressed-to-them announcement (an enumeration-prevention test, not
  merely a "field doesn't exist" check).

### 4.9 Safe-status / UI truthfulness
- Closed-vocabulary safe status only — no forbidden string from
  `05_SECURITY_CLAIM_BOUNDARIES.md` (§0.7) appears in any rendered copy;
  grep-style structural test mirroring that document's own Part 4 audit.
- `"trusted"`/`"verified"` never appears as a value for a mere
  well-formed, non-stale, non-conflicting announcement — closest honest
  value is a `"compatible"`/`"observed"`-shaped term (mirror
  `fedos_ratchet_peer_capability_safe_status.ts:7-9`).
- Every displayed fact carries an explicit `asOf`/`source: "live" |
  "cached" | "unavailable"` qualifier; a rejected/replayed event is itself
  a visible fact, never silently swallowed into a generic "unknown".
- The two existing standing-limit sentences (§0.7) are shown unconditionally
  wherever the new protocol's own discovery UI surfaces peer-device state.

### 4.10 Restart/offline durability
- A record written before a simulated process restart is still correctly
  read by a brand-new instance over the same durable store (mirror
  the append-only vs in-memory `describe.each` dual-backend pattern used
  throughout, e.g. `secure_runtime_alpha_5801_5880_identity_transition_persistence.test.ts:36-38`).
- Post-restart, every axis reads with `source: "cached"`, never `"live"`,
  until a fresh live round-trip has actually occurred (mirror
  07_TEST_MATRIX.md scenario 12).
- Offline (no active relay subscription): same cached qualifier, plus an
  explicit "cannot currently receive new events" distinct fact from
  "restart" (mirror 07_TEST_MATRIX.md scenario 13).

---

## Summary for the Coordinator

The existing FedOS codebase already has two independently-converged,
mature precedent patterns directly applicable to a peer-Device discovery
protocol: `peer_capability`'s pure acceptance policy (revoked > untrusted >
expired > conflicting > stale > downgrade > unsupported/incompatible >
accepted, never a boolean, never silently upgraded) and `identity_transition`'s
history-derived, never-mutated, read-time-superseded rollback model. Both
share one real, twice-repeated architectural gap — replay/rollback/conflict
state keyed globally per (account, device), never per-conversation/context
(§0.8) — which is exactly the dimension a cross-account discovery protocol
stresses hardest, so it MUST be a first-class, explicitly-tested
requirement (§1 attack 7, §4.3), not inherited silently. The "no silent
downgrade" analysis (§3) reduces to one general, reusable meta-test rather
than many bespoke ones: no withhold/replay/reorder/duplicate/delay
combination may ever produce an unqualified good/compatible state without
an accompanying `asOf`/staleness qualifier, mirroring the existing
`asOf`/`source` design already documented in the sibling
`fedos-verified-secure-session-ui-current-readiness` arc's own test-matrix
draft. Privacy-wise, the existing precedent is close to the mandate's bound
but has one currently-unenforced gap worth closing structurally rather
than by convention: the device-identifier field accepts arbitrary strings
up to 512 characters with no format constraint (§2.3 item 1).
