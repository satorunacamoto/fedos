# Agent H — Historical "Verified Secure Session UI" 7-Axis Mapping

Phase A, read-only archaeology. Repo root for this investigation:
`C:\wt\fedos-installed-startup-root-cause`, branch
`arc/fedos-installed-startup-root-cause`, HEAD `a9f0a7bb`. No file in this
worktree was edited. All historical content below was read via `git show
<sha>:<path>` against commits that are NOT part of this branch's own
history (confirmed below) — they were located across other refs sharing
the same object store.

---

## 0. Where it is, and where it is not

**Found.** The feature is real, was fully built, shipped with tests and a
design doc, and even received a documented post-hoc Red Team fix. It lives
entirely on branch `feature/fedos-verified-secure-session-ui` (tip
`d2f06f48`) and was later merged into the RC1/closed-pilot release
lineage. It does **not** exist anywhere on `arc/fedos-installed-startup-root-cause`
(current HEAD) or on `origin/main`.

Commit chain (chronological):

| Commit | Branch(es) it lives on | What it did |
|---|---|---|
| `7738e69b` "Make the per-Conversation security state visible in the product UI" | `feature/fedos-verified-secure-session-ui` | First cut: domain module, Shell composition, IPC channel, badge + panel in the real renderer. 43 tests. |
| `ceae531a` "Merge branch 'master' into feature/fedos-verified-secure-session-ui" | same | Pulled in the OSS-publication merge base `c59c2614`. |
| `198ec920` "Complete FedOS Verified Secure Session: seven honest axes per conversation" | same | The commit that actually names and finalizes **seven axes**: `identity · encryption · forward-secrecy · device · archive · deletion · relay-metadata`. 61 tests (39 domain, 22 structural). |
| `60d76fff` "Add FedOS Verified Session Design" | same | `docs/FEDOS_VERIFIED_SESSION_DESIGN.md`, 307 lines, the full design rationale (quoted extensively below). |
| `712684d0` "RC1 Phase B: integrate Security Hardening with Verified Secure Session" | merges the feature branch into RC1 | Resolved a conflict in the `fedos-app:*` IPC registration block; the new `conversation-security-state` channel was kept and rewired onto the `registerAppCommand` seam. |
| `21308063`, `8e6b39fc`, `82402cb0` | RC1 lineage | Further RC1 documentation/integration passes referencing "Verified Secure Session" by name. |
| `d2f06f48` "Red Team: surface silently auto-accepted identity replacements" | `feature/fedos-verified-secure-session-ui`, and both `release/fedos-closed-pilot-rc-final` and `release/fedos-public-beta-rc1` | **Final state of the domain module.** A HIGH finding fix: the identity axis now separately reports identity replacements that were *silently accepted* (not merely pending), ranked above pending because nobody will ever be prompted about it. |

**Provenance check (read-only, no checkout/merge/reset performed):**

```
git merge-base d2f06f48 HEAD(a9f0a7bb)        -> c59c2614   (OSS publication commit)
git merge-base --is-ancestor d2f06f48 HEAD    -> NO
git merge-base --is-ancestor HEAD d2f06f48    -> NO
git merge-base --is-ancestor 198ec920 origin/main -> NO
git merge-base HEAD origin/main               -> 4e2825cb   (i.e. HEAD IS on origin/main's lineage)
git merge-base HEAD release/fedos-closed-pilot-rc-final -> 4b808995
git branch --all --contains 82402cb0          -> hardening/rc1-security-phase2,
                                                   release/fedos-closed-pilot-rc-final,
                                                   release/fedos-public-beta-rc1
                                                   (NOT arc/fedos-installed-startup-root-cause,
                                                    NOT origin/main)
```

This is fully consistent with — and sharpens — the standing memory note
"origin/main and a ~300-branch RC1/Commerce epic diverged" and "HIGH
old-key auto-accept fix landed ONLY on RC1/closed-pilot lineage, never
merged to origin/main": the Verified Secure Session UI (and its Red Team
fix `d2f06f48`) is a **second, independent example of the exact same
divergence pattern**, at merge-base `c59c2614`/`4b808995` rather than the
`4b808995` figure alone. The current worktree's own history never saw any
of this work.

**Correction to a related standing memory claim, found while cross-checking
axis 1 (identity) against the current tree — see §4 and §5 below**: the
memory note that the old-key auto-accept fix is "still live/unfixed on
mainline" is **now stale**. The current branch independently re-discovered
and fixed a functionally equivalent gap via a different code path
(`fedos_identity_transition_silent_acceptance_detection.ts`, commit
`78327e01`, "Wave A (Agent S) Task 1"), wired into the real Safety Center
and Identity Transition screen. Full detail in §5.

---

## 1. The domain module, in full

`src/conversation/security_state/fedos_conversation_security_state.ts` at
`d2f06f48` (562 lines; final state — untouched between `198ec920` and
`d2f06f48` except for the identity axis). Its own header states the
design intent precisely:

> "Seven independent axes, each reporting its own honest state for ONE
> conversation... This is deliberately NOT a single trust indicator. A
> padlock, or a safety number, collapses everything into one bit and
> cannot express 'your messages are encrypted, but they are not
> forward-secret, and relays still see who you talk to' — which is
> FedOS's actual position today."

Hard guardrails stated in the same header (verbatim):

> "NO new cryptography and NO new protocol... NO free-form text... NO raw
> counters, key material, or device public keys leave this module...
> NEVER claim a capability FedOS does not have. 'Verified' is reserved for
> a recorded human attestation and is never inferred from device trust
> state. An axis that cannot be determined reports `unknown`, never
> `protected`."

Companion design doc: `docs/FEDOS_VERIFIED_SESSION_DESIGN.md` (`60d76fff`,
307 lines) — the full rationale, "Deliberately not done" list, and a
"Next" roadmap are quoted in §6 below.

---

## 2. The seven axes, one by one

Each entry: (1) exact original name/definition, (2) UI copy, (3) actual
runtime facts, (4) current-codebase equivalence check, (5) classification
+ justification.

### 2.1 `identity`

**1. Definition** (source comment, `fedos_conversation_security_state.ts`):
> "FedOS has NO safety number and NO peer-verification ceremony. This
> axis can therefore never report `protected`, and pretending otherwise
> would be the single most damaging thing this screen could do."

Summary codes: `identity-no-verification-mechanism` /
`identity-replacement-pending-account-wide` /
`identity-replacement-accepted-without-asking` (added by the Red Team fix,
ranked **above** pending — "the accepted case is worse: nobody will ever
be prompted about it").

**2. UI copy** (`fedos_electron_beta_renderer.ts` at `d2f06f48`):
- `identity-no-verification-mechanism`: *"FedOS cannot verify who you are
  talking to. There is no mechanism for it."*
- `identity-replacement-accepted-without-asking`: *"A contact's identity
  was replaced and FedOS accepted it automatically, without asking you.
  Confirm with them out of band that they really did change identity."*
- Standing limits shown in every state: *"FedOS has no safety number.
  There is no code you and your contact can compare."* / *"Device pairing
  links devices to one account only. There is no way to verify another
  person's device."* / *"By default FedOS accepts an identity replacement
  signed with the contact's previous key without asking you. Anyone
  holding that old key can become that contact."*

**3. Runtime facts it was derived from**: `identityTransitionList()`
(existence + pending/accepted state), account-wide
`accountPendingIdentityReplacementCount` and
`accountAcceptedIdentityReplacementCount` (both **not** attributable to a
specific conversation — the inbox record carries no peer account
reference, stated explicitly as a limitation:
`identity-replacement-not-attributable-to-conversation`).

**4. Current-codebase equivalence**: **YES, and further evolved.** The
current branch (`arc/fedos-installed-startup-root-cause`) independently
built the near-identical concept via a different code path:
`src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_silent_acceptance_detection.ts`
(`isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity()`,
commit `78327e01`, "Wave A (Agent S) Task 1: old-key continuity
auto-accept VISIBILITY recovery"). It is wired all the way to a real UI:
`fedos_safety_center_controller.ts:147`
(`accountSilentlyAcceptedIdentityReplacementCount`), the Identity
Transition screen model
(`silentlyAutoAcceptedWithoutAsking: boolean`), and the renderer
(`fedos_electron_beta_renderer.ts:3911-3925,3981-4005`, glyph `"⚠✓"` plus
the sentence *"FedOS accepted this identity replacement automatically
because it was signed with your contact's previous key — nobody was asked
to confirm it first. Consider confirming with this contact through
another channel that they really did replace their identity."*). It is
**account-wide, not per-conversation** — same non-attributability
limitation as the historical axis, for the same underlying reason (no
peer account ref on the record).

**5. Classification: PRESERVE (concept), REIMPLEMENT (surface).** The
underlying honest-disclosure concept is exactly right and has already
been independently validated as worth having (a second team found the
same gap and fixed it the same way). A rebuilt per-conversation axis
should **call the current `isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity`
path** rather than reinvent detection logic — only the per-conversation
filtering/attribution and the UI card shape need building, since the
domain-level accepted/pending facts and their non-attributability already
exist and are wired.

---

### 2.2 `encryption`

**1. Definition**: whether a Double Ratchet session exists and is usable,
read from `getDirectRatchetStatus()`'s 8-value closed vocabulary
(`active`, `pending`, `initialization-required`, `reset-required`,
`peer-incompatible`, `revoked`, `unsupported`, `unavailable`), gated on
`ratchetRuntimeConfigured && conversationActive && peerDevices.length > 0`
("claims are gated on the RESOLVED preconditions, never on raw device
facts").

**2. UI copy**: `"A Double Ratchet session is active for this
conversation."` (protected) down through `"The Double Ratchet is not
configured in this build."` (unknown) and `"No device is known for this
contact yet."` (not-protected).

**3. Runtime facts**: `getDirectRatchetStatus()`, `productionCryptoStatus()`
(boolean), `peerCapabilityStatus()` (10-value vocabulary, folded into
`details` not `state`), conversation-active flag.

**4. Current equivalence**: **YES.** `getDirectRatchetStatus`-equivalent
machinery is alive and well under the renamed path:
`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_conversation_runtime.ts`,
`fedos_direct_ratchet_readiness.ts`, `fedos_direct_ratchet_session_lifecycle.ts`.
Peer capability: `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_safe_status.ts`
and `fedos_ratchet_peer_capability_runtime.ts`, both still referenced live
from `fedos_desktop_application_shell.ts` and `fedos_safety_center_controller.ts`.

**5. Classification: PRESERVE.** No conceptual objection; the fact source
is present, current, and already Shell-exposed. The only work is a fresh
UI card wired to it — the underlying gating discipline (never emit a
claim off a raw device fact) is worth carrying forward verbatim, not just
the vocabulary.

---

### 2.3 `forward-secrecy`

**1. Definition**: **the sharpest decision in the whole design.** Kept
deliberately separate from `encryption` because "an active Ratchet
session does NOT mean messages use it" — `ratchetMessageRouteConfigured`
(from `FedosConversationRuntime.directRatchetMessageRouteConfigured()`) is
a distinct boolean from session-active, because in the default packaged
build `ratchetDelivery` is only constructed when
`FEDOS_BETA_DIRECT_RATCHET_MESSAGE_DELIVERY_REMOTE_DEVICE_REF` is set —
unset in an ordinary launch, so messages take the plain NIP-17 route with
**no forward secrecy** while the session itself can still read `active`.

**2. UI copy**: `"Messages are sent through the Ratchet, so a compromised
key does not expose past messages."` (protected) vs. `"A session exists,
but this build does not send messages through it. Your messages have NO
forward secrecy."` (attention — capitalized "NO" in the shipped string).

**3. Runtime facts**: `anyActiveSession` (derived, gated) AND
`facts.ratchetMessageRouteConfigured` (a pure configuration read).

**4. Current equivalence**: **PARTIAL / DEGRADED — this is the single most
important finding for this axis.** Standing memory ("Product
differentiation + layered Gift-Wrap review") already independently
confirmed: *"Double Ratchet is NOT on the default send path"* — the same
underlying fact this axis was built to surface still holds today. I could
not find, in a targeted search, a currently-live equivalent of
`directRatchetMessageRouteConfigured()` as a named boolean read exposed
through the current Shell (`fedos_desktop_application_shell.ts`) — the
concept the historical commit added specifically because Runtime queries
alone did not distinguish "session active" from "messages ratchet-routed"
may need to be re-derived or re-verified present under the renamed
`src/os/messenger/conversations/ratchet/` tree; a full re-audit of that
distinction was outside this task's time budget and should be Agent C's
(or a dedicated) job, not assumed here.

**5. Classification: PRESERVE the axis split; NEEDS REDESIGN on the
current fact source.** The core insight (never let "session active" imply
"forward secret") is provably still true and still unaddressed in the
product — do not lose this axis in any rebuild. But do not assume the
exact `directRatchetMessageRouteConfigured()` read still exists unchanged;
verify against the current ratchet-runtime tree before wiring a UI to it.

---

### 2.4 `device`

**1. Definition**: aggregate of peer `FedosDeviceBindingV1.trustState`
(4-value: `trusted`, `pending`, `revoked`, `unavailable`) across all peer
devices in the conversation — "most-degraded-first" reasoning (revoked
beats untrusted beats all-trusted).

**2. UI copy**: `"Every known device of this contact is trusted."`
(protected) / `"At least one device of this contact is not trusted."`
(partial) / `"A device in this conversation has been revoked."`
(attention) / `"No device is known for this contact yet."` (unknown).

**3. Runtime facts**: `devicesList()` filtered to peer bindings of active
conversation members; `trustState` field directly.

**4. Current equivalence**: **YES.** `FedosDeviceTrustState`-shaped data
is alive: `src/os/messenger/device/fedos_device_binding.ts`,
`persistence/persisted_fedos_device_trust_authority.ts`,
`fedos_device_lifecycle.ts`, and surfaced today in
`fedos_device_management_screen_model.ts` /
`fedos_device_management_renderer.ts` and the Safety Center controller.

**5. Classification: PRESERVE.** Straightforward re-derivation from
current, live device-trust data; no conceptual or evidentiary gap found.

---

### 2.5 `archive`

**1. Definition**: per-conversation message retention aggregated from
`FedosMessageRetentionStateView` (4-value:
active/tombstoned/payload-removed, and total-message-count), reporting
`unknown` "when unreadable rather than optimistically 'all present'."

**2. UI copy**: `"Every message in this conversation still has its
content stored locally."` (protected) / `"Some message content in this
conversation has been removed or tombstoned."` (partial) / `"FedOS could
not read the stored state of this conversation."` (unknown). Standing
limit shown always: `"This screen does not verify the integrity of an
archive export."`

**3. Runtime facts**: per-message retention view, aggregated to
`totalMessages / activeCount / tombstonedCount / payloadRemovedCount`.

**4. Current equivalence**: **YES.** `src/os/messenger/conversations/retention/`
(`fedos_payload_retention_state.ts`, `fedos_payload_retention_authority.ts`,
`fedos_archive_suppression_local_bridge.ts`) is live and is the same
concept the standing memory's "Archive envelope retention parity" and
"Delivery Observation subject index" arcs already hardened.

**5. Classification: PRESERVE.** Directly re-buildable; note the memory
finding "only ciphertext is retention-gated; all metadata survives export
+ restore unconditionally" (Archive/Retention/Deletion audit) as a
pre-existing limitation to state honestly in any rebuilt axis, not a
reason to withhold the axis.

---

### 2.6 `deletion`

**1. Definition**: "Unlike identity replacement, `FedosDeletionRequestInboxSummaryV1`
carries `conversationId`, so this one IS attributable and is filtered
rather than reported account-wide." Genuinely, permanently
`not-protected` (never `protected`) because "signed deletion is a
REQUEST; it can never reach a device or relay the local user does not
control."

**2. UI copy**: `"No deletion request has been received for this
conversation."` / `"A deletion request is waiting for your decision."`
(attention) / `"Deletion requests for this conversation have been
decided."` — all `not-protected` or `attention`, **never** `protected`.
Standing limit: `"Deletion is a request. It cannot remove anything from a
device or relay you do not control."`

**3. Runtime facts**: `deletionRequestListReceived()` filtered to this
conversation's `conversationId`; `decisionState`.

**4. Current equivalence**: **YES.** `src/os/messenger/conversations/deletion_request/`
(`fedos_deletion_request_inbox_summary.ts`,
`fedos_deletion_request_inbound_coordinator.ts`) is live, and the Safety
Center controller already reads `deletionRequestListReceived()` and
`decisionState === "policy-pending"` today (`fedos_safety_center_controller.ts`
line ~149-150).

**5. Classification: PRESERVE.** The attributability property that makes
this axis stronger than `identity` still holds in current code — build it
first among the seven if resuming this work incrementally, since the
supporting query already carries `conversationId` and the Safety Center
already consumes an account-wide version of the same fact.

---

### 2.7 `relay-metadata`

**1. Definition**: **permanently `not-protected`.** "FedOS provides no
anonymity, no onion routing, and no metadata protection beyond what
NIP-17 gives. This axis exists precisely so that fact is visible in every
conversation, always."

**2. UI copy**: `"Relays can see that this conversation is happening."` /
`"No relay is currently connected. When one is, it can see that this
conversation is happening."` — both `not-protected`; there is no
`protected` reading defined at all. Standing limits: `"Relays can see who
is communicating and when. Encryption does not hide that."` / `"FedOS
uses one relay set for everything; relays are not chosen per
conversation."`

**3. Runtime facts**: live relay connection list `{configuredCount,
connectedCount}`, "supplied by the Electron main process, which owns the
live relay list."

**4. Current equivalence**: **NOT FOUND / UNCLEAR.** A targeted grep for
`relayConnection`/`connectedRelay`/`RelayConnectionStatus` inside the
current Shell (`fedos_desktop_application_shell.ts`) returned no matches,
and a grep of the current `fedos_electron_beta_main.cts` for the same
terms hit a binary-file warning (encoding artifact) rather than a clean
text match, so this specific check is **inconclusive, not negative** —
Agent C or a follow-up pass should re-verify with a tool that handles that
file's encoding before concluding the fact is genuinely gone. Standing
memory ("Product differentiation + layered Gift-Wrap review") does record
that "onion corpus is 6,050 lines of zero code" and relay-level metadata
exposure is unaddressed architecturally, consistent with this axis's
permanent `not-protected` reading remaining true regardless of exact
wiring.

**5. Classification: PRESERVE (the honest-disclosure content), NEEDS
REDESIGN (the wiring).** The claim itself ("relays see everything, always,
no exceptions") is almost certainly still 100% true today and cheap to
re-assert even with zero live relay-count data (it does not need
`connectedCount` to be honest — the historical `unknown` reading already
covered the "can't read relay status" case). Do not block resuming this
axis on finding the exact old main-process relay list; the safe minimum
viable version needs no live count at all.

---

## 3. Overclaiming audit

The mandate for this task specifically calls out that a claim must never
exceed what the runtime genuinely proves. I read every summary/detail/
limit string in the closed vocabularies (`AXIS_SUMMARY_LABEL`,
`AXIS_DETAIL_LABEL`, `AXIS_LIMIT_LABEL`, `SECURITY_LEVEL_LABEL`) against
the domain module's actual gating logic. **I found no case of the shipped
UI copy claiming more than the domain model computed.** If anything the
opposite bias is visible throughout — the design is unusually
conservative:

- The word **"Verified"** never appears as a claim about any live state in
  this feature at all. It is reserved, per the module's own header
  guardrail, "for a recorded human attestation and is never inferred from
  device trust state" — and no such attestation flow exists in this
  feature, so the word simply never fires. The feature's own *name*
  ("Verified Secure Session UI") is more assertive than anything the UI
  itself ever displays to a user — worth flagging as a naming risk for
  the rebuild's own external+internal communication, even though the
  shipped strings themselves stayed honest.
- `encryption-ratchet-session-active`'s copy — *"A Double Ratchet session
  is active for this conversation"* — is gated behind
  `sessionClaimsPermitted = ratchetRuntimeConfigured && conversationActive
  && devices.length > 0`, exactly matching the commit message's own
  claim that a test "caught the first draft emitting an encryption claim
  while the Ratchet Runtime was not even configured." This is the
  opposite of overclaiming: a defect that *would* have overclaimed was
  caught and fixed pre-ship.
- The forward-secrecy split (§2.3) is the whole feature's textbook
  anti-overclaiming move: it exists specifically so "session active"
  (encryption axis) is never allowed to imply "forward secret" on its
  own.
- Every `protected` reading I traced back to its precondition chain
  requires either a closed-vocabulary value the Runtime returned directly
  (`ratchetStatus === "active"`, `trustState === "trusted"` for every
  peer device) or a strictly-computed aggregate (retention counts) — none
  synthesize a `protected` reading from an `unknown` or partial input.
- The three constitutionally-`not-protected` axes are enforced by
  *structural tests* against the source itself (per the commit message:
  "structural tests enforce that none of them can ever return
  `protected`"), which is a stronger anti-overclaiming guarantee than a
  code review alone would give — I could not inspect the actual test file
  bodies in the time available (they live only on the non-current
  branches), so I record this as the commit's own claim, not
  independently re-verified test-by-test.

**One soft finding, not an overclaim but worth naming for a rebuild**: the
`identity` axis's standing limit text says *"By default FedOS accepts an
identity replacement signed with the contact's previous key without
asking you"* — this is presented as a *limitation*, in the neutral
"what FedOS cannot tell you" section, on every conversation, at all times,
even when nothing has happened. That is defensible (the policy is a
standing fact, not a per-conversation event) but a rebuild should
double-check this reads as "here is a standing fact about the software,"
not as "something is currently wrong with this specific conversation" —
the line between honest general disclosure and false specific alarm is
thin at that exact sentence.

**Conclusion: no instance of the historical seven axes claiming
"verified" or otherwise overclaiming beyond what the runtime proved was
found.** This is a notably disciplined precedent to build from, not a
liability to correct.

---

## 4. REAL/SHADOW identity, duress-mode, coercion-resistance, deniability

Explicitly checked as instructed. **None of this exists live, reachable,
or even referenced inside the Verified Secure Session UI feature itself**
— its design doc explicitly states FedOS "computes no safety number, no
fingerprint, and no key digest anywhere" and the seven axes contain no
duress/coercion concept whatsoever. Checked separately, more broadly,
across the whole repo:

- `src/os/core/vault/types.ts` (current HEAD, unmodified in this
  worktree's git status) defines `VaultCapability` including
  `"deniable_storage_placeholder"` — explicitly labeled in the file's own
  header: *"'Deniable'/shadow storage is RESEARCH only; the capability
  names below are placeholders and imply no shipped, safe feature."* Types
  only, zero implementation, zero callers of any kind found.
- `docs/anti_analysis_shadow_vault_risks.md` and
  `docs/deniable_storage_research.md` (both present on current HEAD, dated
  2026-07-02, commit `ea822cff`, predating this task) are **binding
  policy documents that explicitly forbid** branch-selected shadow
  vaults, anti-debug/anti-VM detection, self-destruct, and fake
  "shadow data" generators — by name, citing the exact `finger_id == 5`
  pattern as the forbidden example.
- A separate, already-completed audit exists on sibling branch
  `audit/fedos-prototype-security-intent-diff-2026-08-14` (commit
  `0dd111dc`, not part of this branch's history but readable via `git
  show`) that did a full comparison of the FedOS v8.6 Python prototype's
  REAL/SHADOW duress-vault design against current architecture. Its
  verdict (`06_REAL_SHADOW_PERSONA_ANALYSIS.md`,
  `10_DO_NOT_PORT.md` item 4): the prototype's HKDF domain-separation
  *technique* is "preserved and improved" via the current Rust core's
  real, tested `account_index`-keyed HKDF derivation tree — but the
  *duress application* of it (a magic branch revealing decoy vs. real
  data) is explicitly and independently re-confirmed forbidden, both by
  the pre-existing policy docs above and by this audit's own analysis
  ("discoverable, self-defeating, and coercion-fragile by construction").
  No "Persona" concept (real or shadow) exists anywhere in `src/` on that
  audit's checked branch; I independently confirmed no such concept is
  reachable from the Verified Secure Session UI feature either.

**Conclusion: confirmed design-only/unsupported, with no live or
reachable implementation anywhere I could find**, and this exact question
already has a dedicated, thorough, independent prior audit reaching the
same conclusion — cite `docs/reviews/fedos-prototype-security-intent-diff/`
(on branch `audit/fedos-prototype-security-intent-diff-2026-08-14`) rather
than re-deriving this from scratch in the current mega-arc.

---

## 5. What happened to the feature afterward, and the standing-memory correction

The Verified Secure Session UI itself was **never removed or superseded on
its own lineage** — it shipped as-is (with the Red Team fix) into both RC1
release branches (`release/fedos-closed-pilot-rc-final`,
`release/fedos-public-beta-rc1`) and was never touched again on that
lineage as far as this file's own git history shows. It simply **never
crossed back into origin/main**, because origin/main and the RC1/Commerce
epic diverged at `4b808995`/`c59c2614` and were never reconciled (per
standing memory, independently re-confirmed here).

What *did* happen on the current branch's own lineage, independently, is
narrower but real: **Wave A of the "Commerce Product-Media Sync + Truthful
Completion" mega-arc (commit `78327e01`) re-discovered the exact same
silent-auto-accept gap that the RC1 Red Team pass found, and fixed it a
different way** — not as an axis inside a seven-axis per-conversation
card, but as a boolean fact
(`silentlyAutoAcceptedWithoutAsking`) threaded through the existing
Identity Transition and Safety Center screens, with real UI (glyph +
warning text) shipped in `fedos_electron_beta_renderer.ts`. This is a
**correction to the standing memory entries** "FedOS Red Team + RC1" and
"FedOS Forgotten Work Audit v1," both of which currently state the
old-key auto-accept fix "landed ONLY on RC1/closed-pilot lineage, never
merged to origin/main (still live/unfixed on mainline)." That statement
is now **stale**: the underlying user-facing gap (silent acceptance of an
identity replacement signed only with the peer's old key) has an
independent fix on the current branch, even though the *code path* that
fixes it is unrelated to and structurally different from the RC1 one, and
even though the current branch's fix is account-wide rather than
per-conversation. The two fixes are not the same commit and were not
reconciled with each other — they are convergent, independent responses
to the same underlying policy default (`autoAcceptOldKeyContinuity: true`),
which itself remains **unchanged** in both lineages (both fixes are
visibility-only, exactly as their own commit messages state).

---

## 6. Design-doc "Deliberately not done" and "Next" sections (verbatim, for rebuild reference)

From `docs/FEDOS_VERIFIED_SESSION_DESIGN.md` §7-8 (`60d76fff`):

> "No safety number was invented... No new cryptography, protocol,
> persistence, or network message... No Signal-style verification
> ceremony. It cannot be built on same-account Device Pairing... No
> packaged Electron vertical slice... Labels are English-only and
> unreviewed by a writer or translator."

> "1. Wire the Ratchet message route by default... 2. Attribute identity
> replacements to conversations by recording the peer account reference on
> the inbox record... 3. Give the Safety Center the same treatment — an
> account-level view built from the same axis codes. 4. Add a 'why?'
> affordance per axis... 5. Only then consider a verification mechanism."

Item 3 of that "Next" list is notable in hindsight: the current branch's
Safety Center (§5 above) independently grew a piece of exactly that
account-level treatment for the identity axis specifically — unplanned,
via a different arc, but landing in the direction this design doc already
named as the intended next step.

---

## 7. What I searched and did not find further

- `git log --all --oneline | grep -iE "verified|secure session|security
  state|7-axis|seven axis|safety number"` across all refs — the primary
  discovery method for everything above.
- `docs/reviews/` on current HEAD: no existing review directory
  specifically named for this topic existed before this task (the
  `fedos-verified-secure-session-ui-current-readiness` directory this
  file lives in was created by this task).
- No second, different historical "7-axis" model was found — only the one
  described above, on the one branch lineage.
- No renderer/UI code for this feature was found anywhere on
  `origin/main` or `arc/fedos-installed-startup-root-cause`'s own history
  — confirmed via direct grep for `FedosConversationSecurityState`,
  `buildFedosConversationSecurityState`, `ConversationSecurityAxis`,
  `chat-security-badge`, `conversationSecurityState`, and
  `conversation-security-state` across `src/` and `packages/` on the
  current worktree: zero matches for all of them.
