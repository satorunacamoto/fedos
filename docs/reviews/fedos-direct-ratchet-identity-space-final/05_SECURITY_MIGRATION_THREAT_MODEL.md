# Direct Ratchet Identity-Space Unification — Security & Migration Threat Model

**Status**: Adversarial read-only review (Agent D). No source file was modified to produce this document.
**Scope**: Threat-models the three competing designs recorded in
`docs/reviews/fedos-peer-device-discovery-current/11_DIRECT_RATCHET_IDENTITY_SPACE_DESIGN_NEXT.md` (Options
A/B/C) against 14 concrete attack scenarios, using the current security invariants recorded in
`01_CURRENT_DEVICE_AUTHORITY.md` and `06_PROTOCOL_CONTRACT_FREEZE.md` (same directory) as the floor no option
may weaken. Written against `arc/fedos-installed-startup-root-cause` @ `83dca4ee`.

**Verdict key** (per attack, per option):
- **SAFE-BY-CONSTRUCTION** — the existing mechanism this option reuses already forecloses the attack; no new
  discipline is required to keep it closed.
- **SAFE-WITH-EXPLICIT-CHECK** — closed only if a named, specific check is present; the option does not make the
  check automatic, but the check is simple, local, and testable.
- **VULNERABLE-IF-CARELESS** — a real way to get this wrong exists in this option's own shape, avoidable only by
  a named implementation discipline (not just "be careful" — a specific rule).
- **GENUINELY-VULNERABLE** — a structural gap that discipline alone cannot close; should be rare.

---

## 0. Grounding facts used throughout

- The Device Registry (`FedosDeviceRegistryPersistence` / `PersistedFedosDeviceTrustAuthority`) is a single,
  shared, string-keyed store with **no space tag on the key** — both Space A (`localDeviceId`) and Space B
  (`deviceId`) writers share the same instance (`fedos_desktop_runtime.ts`: one `deviceRegistryPersistence!`).
  Its **"one account per device id"** conflict rule (`persisted_fedos_device_trust_authority.ts:93-100`,
  `01_CURRENT_DEVICE_AUTHORITY.md` §1.5/§2) and its closed trust-state gate
  (`isFedosDeviceBindingRevoked`/`isFedosDeviceBindingTrusted`, consumed by
  `resolveFedosDirectRatchetDevicePair()`, `fedos_direct_ratchet_device_pair_resolver.ts:164-172`) are
  **space-agnostic** — they operate on whatever string is handed to them, regardless of which subsystem
  generated it. This is the load-bearing fact behind most of the "SAFE-BY-CONSTRUCTION, independent of the
  option chosen" verdicts below.
- Cross-account Peer Device Discovery acceptance (`evaluateFedosPeerDeviceAnnouncementAcceptance()`,
  `06_PROTOCOL_CONTRACT_FREEZE.md` §4) is a closed, short-circuiting, pure function: malformed → wrong-recipient
  → bad-account-signature → bad-device-signature → duplicate(exact-nonce) → conflicting(same epoch, different
  content) → stale(epoch regression) → accepted. `recipientAccountRef` is checked **before any signature
  verification** (§4 step 2, mirrors `inbound_coordinator.ts:157-158`).
- The Session Reset Authority (`fedos_direct_ratchet_session_reset_authority.ts`) enforces **generation
  integrity independent of arrival order**: a reset's `previousGeneration` must equal `generation - 1` AND must
  equal `locallyKnownPreviousGeneration` (the *local* ground truth, never re-derived from the incoming payload);
  a fresh establishment must be `generation === 0` with no local record. Replay of an identical
  `(generation, previousGeneration, nonce)` tuple is idempotent-safe (`"rejected-replayed"` only if content
  differs under the same nonce, never silently overwritten). This logic operates entirely on already-resolved
  `localDeviceRef`/`remoteDeviceRef` strings — **it is symmetric across whichever space is canonical, and does
  not itself need to change under any of the three options.**
- `FedosDirectRatchetSessionResetSignableContent` includes `conversationId` as a signed field
  (`fedos_direct_ratchet_session_reset_authentication.ts:65`, part of the canonical tuple serialization at
  lines 70-88) — a reset payload is cryptographically bound to one conversation and cannot be replayed into
  another without invalidating its own signature.
- The sealing context (`fedosDirectRatchetSealingDeviceContext()`, `fedos_direct_ratchet_session_binding.ts`)
  folds `accountRef.authority::accountRef.publicIdentifier::deviceRef` into the HKDF context for
  `seal_direct_ratchet_secret`/`restore_direct_ratchet_secret` — "wrong account, same Device string" is already
  a genuine cryptographic-binding failure today, not merely a Runtime-level check.
- `fedos_conversation_security_state.ts` (`deriveConversationSecurityState()`) is a **pure function over
  pre-gathered facts** — Axis 3 (FORWARD_SECRECY) is deliberately separate from Axis 2 (ENCRYPTION): "an active
  Ratchet session does NOT mean messages use it." Every branch is exhaustive; there is no "default to good"
  fallthrough anywhere in the file. This means the pure evaluator itself cannot silently downgrade — **the only
  place a silent downgrade could be introduced is the fact-gathering adapter** (`...security_state_controller.ts`)
  that feeds it, which is exactly where Option B's translation layer would need to plug in (see attack 12).
- Identity Transition: `evaluateFedosIdentityTransitionEvidence()`'s device corroboration
  (`fedos_identity_transition_device_corroboration.ts:94-121`) requires the corroborating binding's
  `accountRef` to equal the transition's own **old** account identity and to be `"trusted"` — device trust is
  already `accountRef`-scoped at the data-model level, independent of which identifier space names the device.
  `peer_capability`'s own `"device-replaced"` outcome maps to `"manual-review-required"`, never an automatic
  session copy (`fedos_ratchet_peer_capability_session_action_recommendation.ts:47-50`), and
  `06_PROTOCOL_CONTRACT_FREEZE.md` §8 states explicitly that a `"trusted"` peer-device binding under account X
  does **not** auto-carry to a later Identity Replacement identity Y.

---

## 1. Per-attack analysis

### Attack 1 — Wrong-account mapping (attacker's own device accepted as belonging to a different account)

The relevant gate is `accountRefsEqual(payload.senderAccountRef, remoteAccountRef)` in
`#receiveSessionInit()` (`fedos_direct_ratchet_inbound_integration.ts`), where `remoteAccountRef` is **not**
taken from the payload's self-report — it is resolved from the conversation's own route binding /
membership (`counterpartyMembership.participant`), which is itself anchored to the NIP-17 rumor's
cryptographically-verified sender pubkey. For Peer Device Discovery, `evaluateFedosPeerDeviceAnnouncementAcceptance()`
step 3 independently re-derives `senderAccountRef.publicIdentifier` from the **verified** `event.pubkey`, never
a caller-supplied value (`01_CURRENT_DEVICE_AUTHORITY.md` §3 point 3 — this discipline is repeated verbatim in
every account-authorization verifier in the codebase).

- **Option A**: SAFE-BY-CONSTRUCTION. Making Space B canonical does not touch the account-authentication layer
  at all — the account check happens one layer above device-space resolution, unchanged.
- **Option B**: SAFE-BY-CONSTRUCTION, with one caveat: the translation layer must key any Space A↔B link by
  `accountRef` too (not just by device string) — a link table keyed *only* by device value with no account
  scoping would let a same-string Space A/B collision (see attack 9) leak across accounts. Since the doc's own
  invariant (§2) restricts links to "a device this node can already prove is itself," this is naturally
  account-scoped for the local-device link and does not arise for peer-side links at all in the described
  design (peer links are explicitly out of scope / future work).
- **Option C**: SAFE-BY-CONSTRUCTION for the same reason as A/B — it inherits whichever of A/B carries it.

### Attack 2 — Wrong-device mapping (Ratchet session bound to a device the attacker doesn't control)

This decomposes into "does the receiver's registry lookup key match the device the signature actually came
from." Device proof-of-possession is optional/best-effort for cross-account announcements (§3 of the frozen
contract), so the actual bar today is account-signature alone plus the Registry's role as a append-only,
first-writer-wins-under-conflict-rule ledger.

- **Option A**: SAFE-WITH-EXPLICIT-CHECK — the check is: the local self-binding registration (new, additive,
  per the design doc §1) must itself go through the *same* dual-signature discipline
  `FedosDeviceBindingRegistrationAuthority` already enforces for same-account pairing, not a shortcut "just
  write a binding" path. If a new code path is added that registers this node's own Space B identity into the
  registry WITHOUT proof-of-possession, that's still consistent with today's peer_capability bar (account-sig
  alone), but it must not be *weaker* than today's bar for **local self-registration** specifically (today's
  local self is trusted implicitly by being local; the new write must not accidentally become forgeable by a
  remote party).
- **Option B**: VULNERABLE-IF-CARELESS. The translation layer's own invariant (§2 of the design doc) names this
  precisely: a link must never be inferred/guessed. The discipline that avoids the vulnerability: the link table
  writer must be restricted to a single, narrow, non-reusable code path (this node linking its own two already-
  durable identities at startup) and must **never** accept a peer-supplied pair as input, even indirectly (e.g.
  via a future "peer told us these are the same device" extension) without a proof requirement equivalent to
  proof-of-possession.
- **Option C**: inherits A or B's own verdict; the added risk unique to C is generating one canonical keypair
  shared by both subsystems — if the *migration* that unifies the keypair reuses the same public key across two
  differently-scoped signature domains without correct domain separation (RESET_SIGNATURE_PREIMAGE_PREFIX-style
  prefixing already exists and must be preserved), a signature meant for one purpose could be replayed as proof
  for another. VULNERABLE-IF-CARELESS — discipline: never let the unified keypair's signatures cross a domain
  boundary without the existing fixed preimage-prefix pattern (already used 3x in this codebase:
  `fedos-device-binding-proof-of-possession-v1:`, `fedos-peer-device-announcement-proof-of-possession-v1:`,
  `fedos-direct-ratchet-session-reset-v1:`).

### Attack 3 — Cross-conversation substitution (binding/session-init payload from conversation X replayed into Y)

`FedosDirectRatchetSessionInitPayloadV1` and `FedosDirectRatchetSessionResetSignableContent` both carry
`conversationId` as a **signed** field, and `#receiveSessionInit()` resolves `conversationId` directly from the
caller's own `resolveFedosDirectConversationByRouteBinding()` call (not from a trust-the-payload-blindly path,
per the "Alpha 7401-7480" comment in the inbound integration file). Peer Device Discovery deliberately has **no**
`conversationId` field at all (§10 of the frozen contract) — device identity is asserted account-scoped, not
conversation-scoped, by design, so there is no conversation claim to substitute in the first place for that
protocol.

- **Option A**: SAFE-BY-CONSTRUCTION. The conversationId binding lives in the session-init/reset signed content,
  unrelated to which space `senderDeviceRef`/`recipientDeviceRef` are drawn from.
- **Option B**: SAFE-BY-CONSTRUCTION for the same reason — the translation layer only touches the
  `senderDeviceRef`/`recipientDeviceRef` fields at the wire boundary, never `conversationId`.
- **Option C**: SAFE-BY-CONSTRUCTION, same reasoning; not affected by which keypair is canonical.

### Attack 4 — Profile crossing (multi-profile-on-one-machine leak/confusion)

`fedos_local_profile_paths.ts`'s own stated rule: "Independent profiles isolated: two different roots share no
subpath," "no path traversal... no caller string is ever interpolated into a subpath." Both the Space B identity
file (`peerDeviceAnnouncementIdentityLogFile`) and the Device Registry log (`deviceRegistryLogFile`) are
deterministic subpaths under one profile's own root — confirmed by direct read of
`fedos_local_profile_paths.ts:91,201` and the module's own header. This isolation is a path-planning property,
orthogonal to which identity space is canonical.

- **Option A**: SAFE-BY-CONSTRUCTION — the new local self-binding write still targets the *same* profile-scoped
  Registry log; no new cross-profile surface is introduced.
- **Option B**: SAFE-BY-CONSTRUCTION for the same reason, **with one explicit check needed**: the new link-table
  persistence type must itself be added as a subpath under the SAME profile root planner (`fedos_local_profile_paths.ts`),
  not as a new hand-built path elsewhere — this is a discipline requirement (use the existing planner, don't
  invent a second path-construction mechanism), not a structural risk, since the planner's own rules make
  bypassing it require a deliberate deviation, not an accident.
- **Option C**: same as A/B, no unique risk.

### Attack 5 — Stale mapping replay (Option B specific: old Space A↔B link replayed after a legitimate re-key)

This is Option B's most option-specific risk. The link table records `(localDeviceId, peerDeviceAnnouncementDeviceId)`
pairs. If this node itself ever re-keys/rotates either identity (e.g. a future device-recovery flow that
regenerates the Space B identity file, or Device Pairing issuing a new `localDeviceId`), an old cached link
entry pointing to the superseded value could get "replayed" — i.e. consulted after it should have been
superseded.

- **Option A**: N/A — no link table exists, nothing to go stale in this shape. SAFE-BY-CONSTRUCTION (not
  applicable).
- **Option B**: SAFE-WITH-EXPLICIT-CHECK. The check: link resolution must always re-derive from the
  **current** contents of both durable identity files at read time (or be invalidated the instant either file's
  own writer detects a change), never cache a link value across a restart independent of its sources. Since
  today's Space A `localDeviceId` is set once at profile-create time and never rotates (no rotation code path
  exists for it currently), and Space B's identity file is explicitly "never silently regenerate over a corrupt
  file... which would silently change this device's own identity out from under every peer" — both sources are
  currently append-once/immutable in practice, so the realistic exposure today is low, but the invariant must
  still be stated explicitly since nothing in Option B's own design doc names a link-invalidation rule for a
  future rotation.
- **Option C**: N/A for the same reason as A once the keypairs are actually unified; until unification is
  complete it inherits B's caveat if implemented via a temporary link.

### Attack 6 — Old session rollback (attacker replays an old session-init/reset to roll back to a prior possibly-compromised ratchet state)

Already closed today, independent of the identity-space question: `FedosDirectRatchetSessionResetAuthority.evaluate()`
requires `previousGeneration === generation - 1` AND `=== locallyKnownPreviousGeneration` (the receiver's own
ground truth, not payload-supplied), and identical-nonce replay is idempotent-safe while different-content-under-
the-same-nonce is a hard reject. A rollback attempt (replaying an old, lower-`generation` payload) fails the
generation-integrity check because the local side's own recorded generation has already advanced past it.

- **Option A**: SAFE-BY-CONSTRUCTION — this logic is entirely downstream of device-pair *resolution*, not
  device-space *choice*; unaffected by which space `localDeviceRef`/`remoteDeviceRef` are drawn from.
- **Option B**: SAFE-BY-CONSTRUCTION for the same reason, **provided** the translation layer is applied
  consistently on both the outbound-construction and inbound-consumption sides so `locallyKnownPreviousGeneration`
  is always looked up under the SAME space the session record was persisted in (the design doc's own
  recommendation: persist bindings in Space A, translate only at the wire boundary — this must be applied
  symmetrically or the local lookup itself could silently miss the prior record and misclassify a rollback as a
  fresh establishment). This is the one place Option B needs a named discipline: **translation must happen
  before generation-integrity lookup, not after**, on every inbound path.
- **Option C**: inherits A or B's own verdict.

### Attack 7 — Identity replacement interaction (peer's ACCOUNT identity changes — must invalidate old device trust, not carry it over)

`06_PROTOCOL_CONTRACT_FREEZE.md` §8 states this explicitly for Peer Device Discovery: a trusted binding under
account X does not auto-carry to a later-completed Identity Replacement identity Y; a fresh announcement under Y
is required. This is enforced structurally because Device Registry bindings are keyed with an `accountRef`
component and the "one account per device id" conflict rule means a `deviceId` already trusted under X cannot
silently become associated with Y without going through `registerDevice()`'s own conflict path (which would
require Y to independently announce/register the SAME `deviceId` — itself blocked unless X's binding is first
revoked, since `registerDevice()` for an already-`"trusted"`-under-a-different-account `deviceId` returns
`"conflict"` without mutating anything, per `01_CURRENT_DEVICE_AUTHORITY.md` §1.5).

- **Option A**: SAFE-WITH-EXPLICIT-CHECK. The check: whichever code path drives the IDENTITY_CONTINUITY axis's
  "old identity's device trust must not silently carry to the new identity" rule must apply equally when Space B
  is canonical — i.e. `resolveFedosDirectRatchetDevicePair()`'s account-scoping (it takes `remoteAccountRef`
  independently of `remoteDeviceRef`) must continue to gate on the CURRENT `remoteAccountRef` for this
  conversation, not a cached one. This is unaffected by which space `remoteDeviceRef` itself is drawn from, so
  the check is really "don't regress `06_PROTOCOL_CONTRACT_FREEZE.md` §8," not something Option A must newly
  invent.
- **Option B**: SAFE-WITH-EXPLICIT-CHECK, same check, **plus** one Option-B-specific addition: the link table's
  own local-self entry is account-agnostic by design (it links two of THIS node's own identities, and this
  node's own account doesn't change under a peer's Identity Replacement) — so it is not itself a vector for
  this attack. But the axis-computation adapter that must resolve "which device did the axis mean" via the link
  table (§ Security-UI implications in the design doc) must re-verify `remoteAccountRef` freshness on every read,
  not cache a stale account-to-device association across an Identity Replacement event.
- **Option C**: same as whichever of A/B it rides on; no unique risk for this attack.

### Attack 8 — Device replacement (peer gets a genuinely new device — must require fresh trust, no auto-inheritance)

Already covered by an existing, verified mechanism independent of the space question: `peer_capability`'s
`"device-replaced"` classification maps to `"manual-review-required"`, explicitly never an automatic session
copy/inherit (`fedos_ratchet_peer_capability_session_action_recommendation.ts:47-50`, comment: "A brand-new
Device identity per the Foundation Arc's own register-then-revoke discipline — never an automatic session
copy/inherit"). Peer Device Discovery's own acceptance policy additionally REJECTS silent re-keying under an
existing `deviceId` (§7 item 3 of the frozen contract: a changed key under the same `deviceId` is `"conflicting"`,
never silently overwritten) — a genuinely new physical device must arrive under a NEW `deviceId`.

- **Option A**: SAFE-BY-CONSTRUCTION — this classification logic operates on the Registry's own trust-state
  transitions, unaffected by which space populates `deviceId`.
- **Option B**: SAFE-BY-CONSTRUCTION, same reasoning.
- **Option C**: SAFE-BY-CONSTRUCTION, same reasoning.

### Attack 9 — Multi-device collision (two accounts end up with colliding device identifiers in the canonical space)

The "one account per device id" rule (`01_CURRENT_DEVICE_AUTHORITY.md` §1.5, enforced at
`persisted_fedos_device_trust_authority.ts:93-100`) is enforced by `registerDevice()` **regardless of which
space the `deviceId` string came from**, because it's the same shared Registry instance and the same conflict
check. This makes the rule SAFE-BY-CONSTRUCTION for steady-state operation under any of the three options.

- **Option A**: SAFE-WITH-EXPLICIT-CHECK for the migration moment specifically: before/during migration, if this
  node's own new Space B self-binding registration collides (identical `deviceId` string) with an
  already-registered Space A binding for a DIFFERENT account (astronomically unlikely given both are 128-bit-ish
  CSPRNG values, but the design doc doesn't rule it out structurally), `registerDevice()`'s own conflict rule
  will correctly refuse it — so the "check" is really just "let the existing conflict rule run, do not special-
  case a bypass to 'make migration succeed.'" The discipline: never wrap the new self-registration call in logic
  that overrides/ignores a `"conflict"` outcome to force success.
- **Option B**: SAFE-BY-CONSTRUCTION, same reasoning as steady-state, since B doesn't introduce a new canonical
  Registry write at all beyond what already exists (only the link table, which is a separate, additive store not
  subject to the same-Registry collision surface).
- **Option C**: inherits A's caveat once/if it converges on a shared keypair — a collision here would mean the
  SAME public key being asserted for two different `deviceId` values across the two subsystems, which the
  existing `devicePublicKeyRef` field comparison would surface as a data inconsistency, not a security bypass
  (the Registry's conflict rule keys on `deviceId`, not `devicePublicKeyRef`, so this needs an explicit design
  note if C is chosen: decide, and test, what happens when the SAME public key appears under two different
  `deviceId`s post-unification — today nothing prevents that combination from being technically valid, which
  is a new question C's own migration must answer, not left implicit).

### Attack 10 — Mapping/link poisoning (Option B specific: a compromised/buggy component writes a wrong Space A↔B link)

This is the risk Option B's own design doc names as "the most likely place for a new vulnerability class" (§2).

- **Option A**: N/A — no link exists to poison.
- **Option B**: VULNERABLE-IF-CARELESS. Discipline that avoids it, stated precisely: (1) the link-write code
  path must be a SINGLE, narrow function, never a general-purpose "record a link" API reachable from more than
  one call site; (2) it must only ever be invoked with values this node reads directly from its OWN two durable
  identity files at startup — never with a caller-supplied pair, and never with any value learned over the
  network (today's design doc scope is local-self-linking only, no peer-side linking, which is exactly why this
  stays SAFE if the discipline holds); (3) the link must be **read-only inference over already-verified facts,
  never a new trust decision** (design doc's own words) — meaning the link consumer must still separately query
  the Registry's own trust state for whichever space-B value it resolves to, not treat "a link exists" as itself
  sufficient for trust. If a future extension adds peer-side linking (explicitly out of today's scope), that
  extension would need its own proof requirement equivalent to device proof-of-possession — building it without
  that proof is exactly how this becomes GENUINELY-VULNERABLE rather than merely VULNERABLE-IF-CARELESS; today's
  scoped design (local-self only) does not create that exposure.
- **Option C**: N/A in the same sense as A, once unified.

### Attack 11 — Relay injection (malicious/compromised relay influences which device identity gets accepted)

The relay is explicitly untrusted transport in this architecture; every signed field (`senderAccountRef`,
`senderDeviceRef`, `recipientDeviceRef`, `devicePublicKeyHex`, `conversationId`, `generation`, nonces) lives
inside the NIP-59 Gift Wrap → Seal → Rumor pipe and is protected by the account's own Schnorr signature over the
canonical content plus (for Peer Device Discovery) domain-separated device proof-of-possession when present. A
relay can drop, delay, duplicate, or reorder messages, but cannot forge a signature or alter signed content
without detection (verified as the standing invariant this whole document's Attack-1 analysis and
`01_CURRENT_DEVICE_AUTHORITY.md` §3 both rely on).

- **Option A**: SAFE-BY-CONSTRUCTION — a relay has no way to influence which `deviceId` string a subsystem
  treats as canonical; that's a purely local process configuration choice, not something on the wire.
- **Option B**: SAFE-BY-CONSTRUCTION for the same reason, **with one caveat worth naming**: since the wire shape
  is unchanged (design doc's own claim — "wire/signable-content schema impact: none"), a relay replaying an
  OLD, pre-translation-layer-deployment payload during a rollout window is indistinguishable from a normal
  duplicate delivery and is handled by the SAME idempotent-replay logic that already exists (nonce/generation
  checks, attack 6) — this is not a new relay-specific risk, just a reminder that "wire schema unchanged" cuts
  both ways: it also means a relay cannot even tell a rollout happened.
- **Option C**: SAFE-BY-CONSTRUCTION, same reasoning; unifying which keypair is canonical is a local decision, not
  something exposed to or influenced by the relay.

### Attack 12 — Silent downgrade (could any option make it easier to fall back to a legacy/non-ratchet route while showing a truthful-looking Security UI state?)

`deriveConversationSecurityState()` is pure and exhaustive with **no default-to-good fallthrough** anywhere;
Axis 3 (FORWARD_SECRECY) is deliberately independent of Axis 2 (ENCRYPTION) specifically so "ratchet session
active" is never conflated with "this message actually routed through it." This guard lives entirely in the
pure evaluator, which none of the three options touch. The actual risk surface is the **adapter** that gathers
`FedosConversationSecurityStateFacts` before calling the pure function (the recon doc calls this out too, in
its Option B "Security-UI implications" section) — if that adapter resolves "which device" inconsistently
between what it feeds Axis 3's `forwardSecrecy`/`reason` fields and what it feeds Axis 4's
`observedPeerDeviceTrustStates`, the two axes could tell an internally-inconsistent story (though neither could
individually become falsely "good," because each axis's own facts come from its own real, live source).

- **Option A**: SAFE-BY-CONSTRUCTION — collapsing to one canonical space makes the adapter's own device
  selection provably coherent end-to-end (design doc's own claim, §1 "Security-UI implications": "that choice
  becomes fully coherent end-to-end... a strict improvement, not a new risk"). Independently verified true here:
  since Axis 3's route-selection function and Axis 4's device-observation function would now agree by
  construction on which identifier means "the device," there is no seam left for the adapter to mismatch.
- **Option B**: SAFE-WITH-EXPLICIT-CHECK. The check: the adapter must consult the SAME link-resolution result for
  every axis that needs to relate a Space B `chosenDevice.deviceId` to a Space A-keyed fact (e.g.
  `directRatchetStatus(conversationId, chosenDevice.deviceId)` today already receives a Space B value where
  `resolveFedosDirectRatchetDevicePair()` correctly expects a Space B `remoteDeviceRef` — the design doc
  confirms this specific call site is NOT part of the mismatch). Under Option B, if a *future* wiring change
  ever needed to resolve "this node's own local device" (not the peer's) via the link table for a UI fact, that
  resolution must go through one shared accessor, never two independently-written lookups that could drift.
  This is not automatic; it needs a named single-accessor discipline.
- **Option C**: inherits A's verdict once/if unified; SAFE-BY-CONSTRUCTION for the same underlying reason.

### Attack 13 — Migration corruption / partial migration (Option A specific: crash mid-migration leaves some state under old context, some under new)

Two independent pieces of state are affected by an Option A migration: (a) the local self-binding registration
(new Registry row, additive — either exists or doesn't, since `registerDevice()` is a single event-sourced
`putEvent()` call, not a multi-step transaction spanning files) and (b) the sealed-secret re-seal migration
(re-sealing `FedosSealedDirectRatchetSecretRecordV1` rows under the new `fedosDirectRatchetSealingDeviceContext()`
string, per §5 of the design doc).

- **(a) Self-binding registration**: FAIL-CLOSED by construction. A crash before the `putEvent()` write commits
  leaves the Registry exactly as it was pre-migration (no Space B self-binding yet) — the NEXT run's own
  migration-entry check (an idempotent "does a Space B self-binding already exist for this node" check) simply
  retries. There is no partial-write state possible for a single event-sourced append, so this half is
  SAFE-BY-CONSTRUCTION provided the migration code is written idempotently (check-then-write, safe to re-run).
- **(b) Sealed-secret re-seal**: this is the genuinely risky half. If re-sealing is done record-by-record (old
  context → decrypt → new context → re-encrypt → persist), a crash mid-batch leaves SOME
  `FedosSealedDirectRatchetSecretRecordV1` rows under the OLD context and some under the NEW one. **Failure
  mode**: `restore_direct_ratchet_secret` is called with whichever context the CURRENT runtime now considers
  canonical (post-migration, Space B). A row still sealed under the OLD (Space A) context will fail to decrypt
  under that call — this is FAIL-CLOSED at the cryptographic layer (Rust's AEAD open simply fails; there is no
  code path that falls back to treating a decrypt failure as "session doesn't exist, start fresh" without an
  explicit, separate decision to do so) **as long as the caller does not catch that failure and silently
  proceed as if no prior secret existed** (which — per §5's own note — is a real but currently-empty risk
  surface, since there is no real cross-account session data to migrate today).
- **Verdict — Option A**: SAFE-WITH-EXPLICIT-CHECK for both halves, but the check for (b) must be named
  precisely: **the re-seal migration must be all-or-nothing per (accountRef, deviceRef) tuple, tracked with its
  own idempotent completion marker** (e.g. a durable "re-seal migration completed for tuple T" record, checked
  before any session under T is allowed to reach `"active"` post-migration) — without this, a partial re-seal is
  indistinguishable from "no session ever existed," which is safe (fails closed, forces re-establishment) but
  is a silent DATA LOSS of ratchet state, not a security hole per se. This is VULNERABLE-IF-CARELESS only in the
  narrow sense of "silently masking a real decrypt-failure as an ordinary cold-start" — the discipline is: never
  swallow a decrypt failure during the migration window without logging/surfacing it distinctly from "genuinely
  no prior session."

### Attack 14 — Restart during migration (Option A specific, same as 13 but framed as an app-restart race)

Functionally the same failure mode as attack 13, framed as "does starting the migration twice, or interrupting
it via ordinary app restart (not just a crash), cause corruption." Given §5's confirmation that there is
currently **no real cross-account session in production data**, the practical blast radius today is zero, but
the design must still be evaluated as if it weren't.

- **Option A**: SAFE-WITH-EXPLICIT-CHECK, same check as attack 13(b) plus one addition specific to restart (as
  opposed to crash-mid-write, which cannot leave a torn single write): the migration driver itself must be
  **re-entrant/idempotent at the granularity of one (accountRef, deviceRef) tuple** — i.e. re-running the
  migration routine on a normal restart must (i) skip tuples already marked complete, (ii) safely re-attempt
  tuples left incomplete (which, by definition from attack 13's analysis, are still readable under the OLD
  context, since re-seal is all-or-nothing per tuple), and (iii) never re-run the self-binding registration in a
  way that could hit the Registry's own "conflict" path against itself (idempotent check-then-write, per attack
  13(a), already covers this). No component of this is automatic — it must be built as an explicit, testable
  migration-driver contract, which is exactly why this is SAFE-WITH-EXPLICIT-CHECK, not SAFE-BY-CONSTRUCTION.
- **Options B/C**: N/A — B has no live-data migration to interrupt (its link table is written fresh, once,
  locally, idempotently, with no re-seal step per its own design doc §"Migration considerations"); C inherits
  A's exposure only if/when it actually performs a live re-seal migration to unify keypairs, at which point it
  inherits attack 13/14's verdict verbatim.

---

## 2. Consolidated verdict table

| # | Attack | Option A | Option B | Option C |
|---|---|---|---|---|
| 1 | Wrong-account mapping | SAFE-BY-CONSTRUCTION | SAFE-BY-CONSTRUCTION | SAFE-BY-CONSTRUCTION |
| 2 | Wrong-device mapping | SAFE-WITH-EXPLICIT-CHECK | VULNERABLE-IF-CARELESS | VULNERABLE-IF-CARELESS |
| 3 | Cross-conversation substitution | SAFE-BY-CONSTRUCTION | SAFE-BY-CONSTRUCTION | SAFE-BY-CONSTRUCTION |
| 4 | Profile crossing | SAFE-BY-CONSTRUCTION | SAFE-BY-CONSTRUCTION (+discipline) | SAFE-BY-CONSTRUCTION |
| 5 | Stale mapping replay | N/A | SAFE-WITH-EXPLICIT-CHECK | N/A (post-unification) |
| 6 | Old session rollback | SAFE-BY-CONSTRUCTION | SAFE-BY-CONSTRUCTION (+ordering discipline) | SAFE-BY-CONSTRUCTION |
| 7 | Identity replacement interaction | SAFE-WITH-EXPLICIT-CHECK | SAFE-WITH-EXPLICIT-CHECK | SAFE-WITH-EXPLICIT-CHECK |
| 8 | Device replacement | SAFE-BY-CONSTRUCTION | SAFE-BY-CONSTRUCTION | SAFE-BY-CONSTRUCTION |
| 9 | Multi-device collision | SAFE-WITH-EXPLICIT-CHECK (migration moment) | SAFE-BY-CONSTRUCTION | SAFE-WITH-EXPLICIT-CHECK (unification design note) |
| 10 | Mapping/link poisoning | N/A | VULNERABLE-IF-CARELESS | N/A |
| 11 | Relay injection | SAFE-BY-CONSTRUCTION | SAFE-BY-CONSTRUCTION | SAFE-BY-CONSTRUCTION |
| 12 | Silent downgrade | SAFE-BY-CONSTRUCTION | SAFE-WITH-EXPLICIT-CHECK | SAFE-BY-CONSTRUCTION |
| 13 | Migration corruption | SAFE-WITH-EXPLICIT-CHECK | N/A | inherits A |
| 14 | Restart during migration | SAFE-WITH-EXPLICIT-CHECK | N/A | inherits A |

No **GENUINELY-VULNERABLE** verdict was assigned anywhere in this analysis. The worst verdicts are
**VULNERABLE-IF-CARELESS**, all three concentrated on Option B (attacks 2, 10) and Option C inheriting one of
them (attack 2, via a shared keypair crossing signature domains). Option A's worst verdicts are all
**SAFE-WITH-EXPLICIT-CHECK** and are concentrated entirely in its migration mechanics (attacks 9, 13, 14), which
are one-time, engineering-controllable, and — per §5 of the design doc — currently apply to zero real
production data.

---

## 3. Non-negotiable invariants (falsifiable, option-agnostic unless marked)

1. **INV-1 (Registry conflict rule)**: for any `deviceId` string in whichever space is canonical, at most one
   `accountRef` may ever hold a non-`"revoked"` binding for it at any point in time; a second `registerDevice()`
   call for the same `deviceId` under a different `accountRef` MUST return `"conflict"` and MUST NOT mutate
   existing state.
2. **INV-2 (Revoked-is-terminal)**: a `deviceId` once `"revoked"` MUST NEVER be reused by ANY subsequent
   `registerDevice()` call, regardless of which `accountRef` requests it.
3. **INV-3 (Account authentication is never payload-self-reported)**: every code path that establishes
   `remoteAccountRef`/`senderAccountRef` for a Ratchet session-init, session-reset, or peer-device-announcement
   decision MUST derive that value only from a cryptographically-verified `event.pubkey` (or a conversation
   membership already anchored to one), NEVER from a caller-supplied field inside the same payload being
   evaluated.
4. **INV-4 (Conversation binding)**: every session-init and session-reset signable content MUST continue to
   include `conversationId` as a signed field, and the receiver MUST resolve `conversationId` from its own
   route-binding/membership resolution, never from unauthenticated payload content alone.
5. **INV-5 (Rollback resistance)**: session generation acceptance MUST be evaluated against the RECEIVER's own
   locally-recorded `previousGeneration`/`priorRecord`, never against a value asserted by the incoming payload
   alone; a `generation` less-than-or-equal-to the locally-known current generation for the same tuple MUST be
   rejected.
6. **INV-6 (No silent re-key)**: a peer-device announcement or device-binding registration that changes the
   `devicePublicKeyRef` for an already-`"trusted"` `deviceId` MUST be classified as a conflict/rejection, never
   silently accepted as a routine update.
7. **INV-7 (No auto-inherit across identity replacement)**: a `"trusted"` device binding recorded under account
   identity X MUST NOT be treated as valid for a DIFFERENT, later account identity Y (post Identity Replacement)
   without a fresh, independently-verified announcement/registration under Y.
8. **INV-8 (No auto-inherit across device replacement)**: a peer's device-replacement event MUST route to
   `"manual-review-required"` (or equivalent explicit-decision state), never to an automatic session copy from
   the old device to the new one.
9. **INV-9 (Profile isolation)**: no durable identity, link, or Registry state written for one local profile
   root may ever be readable from, or interpolated into, another local profile root's subpath set.
10. **INV-10 (No silent downgrade)**: `deriveConversationSecurityState()`'s Axis 3 (FORWARD_SECRECY) MUST remain
    computed independently from Axis 2 (ENCRYPTION) — an `"active"` ratchet session status must never, by
    itself, cause Axis 3 to report `"good"` without confirming the message ROUTE actually used it.
11. **INV-11 (Sealing context binds account+device)**: the HKDF/sealing context string used by
    `seal_direct_ratchet_secret`/`restore_direct_ratchet_secret` MUST continue to fold in both the account
    reference and the device reference, so that a wrong-account, same-device-string secret can never be
    recovered.
12. **INV-12 [Option A only] (Migration is idempotent per tuple)**: the self-binding registration migration and
    the sealed-secret re-seal migration MUST both be safely re-runnable (check-then-act, per
    `(accountRef, deviceRef)` tuple) such that a crash or ordinary restart at any point leaves the system in a
    state where re-running the migration completes it correctly, without ever registering a self-binding twice
    in a way that trips INV-1 against itself, and without ever exposing a session as `"active"` while any part
    of its sealed secret is still only readable under the pre-migration context.
13. **INV-13 [Option A only] (Re-seal failure is distinguishable from cold-start)**: a decrypt failure on
    `restore_direct_ratchet_secret` occurring specifically because a record was never re-sealed (migration
    incomplete for that tuple) MUST be logged/surfaced distinctly from "no prior session ever existed" during
    the migration window — it MUST NOT be silently treated as the latter.
14. **INV-14 [Option B only] (Link table is proof-gated, not inferred)**: any write to the Space A↔B link table
    MUST originate only from this node's own two already-durable, already-verified local identity files (or, for
    any future peer-side extension, from an explicit cryptographic proof equivalent to device
    proof-of-possession) — never from an inference/heuristic ("same account therefore probably same device"),
    and never from a caller-supplied pair reachable from more than one call site.
15. **INV-15 [Option B only] (Link is read-only inference, not a trust decision)**: consulting the link table
    MUST NOT, by itself, be treated as sufficient to establish device trust — the consumer MUST still separately
    query the Registry's own current trust state for whichever resolved value it obtains.
16. **INV-16 [Option B only] (Translation precedes generation lookup)**: on every inbound path, Space A↔B
    translation MUST be applied BEFORE the generation-integrity lookup (`locallyKnownPreviousGeneration`), so the
    lookup always operates in the same space the session record was actually persisted in.

---

## 4. Negative-test matrix

Each row: invariant → concrete scenario → expected rejection/outcome. Written to be directly implementable as a
unit or integration test against the named function/module.

| Invariant | Test scenario (inputs) | Expected outcome |
|---|---|---|
| INV-1 | Call `PersistedFedosDeviceTrustAuthority.registerDevice({deviceId: D, accountRef: AcctX, ...})`, succeeds; then call `registerDevice({deviceId: D, accountRef: AcctY, ...})` with `AcctY !== AcctX`. | Second call returns `"conflict"`; `getBinding(D)` still reports `AcctX` afterward, unchanged. |
| INV-2 | `registerDevice({deviceId: D, accountRef: AcctX})` → `revokeDevice(D)` → `registerDevice({deviceId: D, accountRef: AcctX})` again (even the SAME account attempting to re-register the same id). | Third call is refused (not silently re-trusted); `getBinding(D).trustState` remains `"revoked"`. |
| INV-3 | Craft a `FedosDirectRatchetSessionInitPayloadV1` whose `senderAccountRef.publicIdentifier` names Account Z, but sign the outer NIP-17 envelope with Account W's real key (W ≠ Z). Feed through `#receiveSessionInit()`. | Rejected as `"wrong-recipient"`/account mismatch before any device-pair resolution is attempted; the session is never created. |
| INV-4 | Take a validly-signed session-reset payload for `conversationId = "conv-1"`; replay the identical bytes (including signature) as if delivered for `conversationId = "conv-2"` (i.e. feed it to the inbound handler for a different resolved conversation). | Signature verification over the canonical content (which embeds `conv-1`) fails to match the context of `conv-2`, or the resolver's own conversationId-from-route-binding never routes it there in the first place — either way, no session is created/mutated under `conv-2`. |
| INV-5 | Establish a session reaching `generation = 3`. Replay an old, previously-valid `generation = 1, previousGeneration = 0` session-init/reset payload (a real historical message, not fabricated). | `FedosDirectRatchetSessionResetAuthority.evaluate()` returns `"rejected-generation-mismatch"` (payload's claim disagrees with `locallyKnownPreviousGeneration = 3`); ratchet state remains at generation 3. |
| INV-6 | Send a peer-device announcement for `deviceId = D` with `devicePublicKeyHex = K1`, accepted and `"trusted"`. Send a second announcement for the SAME `deviceId = D` with a DIFFERENT `devicePublicKeyHex = K2`, higher epoch, valid account signature. | `evaluateFedosPeerDeviceAnnouncementAcceptance()` returns `"conflicting"`, not `"accepted-superseding"`; Registry binding for `D` still reports `K1`. |
| INV-7 | Establish a `"trusted"` peer-device binding for `deviceId = D` under account X. Complete an Identity Replacement for the peer's account from X to Y (a locally-recorded, accepted transition record). Attempt to use `D` as `remoteDeviceRef` for a NEW session under the conversation now associated with Y, without any fresh announcement from Y. | `resolveFedosDirectRatchetDevicePair()` (or the acceptance path gating it) does not resolve `D` as trusted for Y — either `"remote-device-not-trusted"`/`"remote-device-unknown"`, or the IDENTITY_CONTINUITY axis surfaces `"attention"`; the OLD binding under X is never silently reattributed to Y. |
| INV-8 | Peer sends a NEW peer-device announcement for a previously-unseen `deviceId = D2` from the SAME account that already has a `"trusted"` `deviceId = D1`. | `peer_capability`'s lifecycle classification reaches `"device-replaced"` (or the discovery-side equivalent) and the session-action recommendation returns `"manual-review-required"`, not an automatic session bootstrap reusing D1's established secret material for D2. |
| INV-9 | Create two local profile roots, `root1` and `root2`. Run `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()` against `root1`'s path, then independently against `root2`'s path. Inspect both resulting files and both profiles' Device Registry logs. | Two distinct `deviceId`/`devicePublicKeyHex` pairs; `root1`'s Registry log contains zero bindings originating from `root2`'s identity file and vice versa; no shared subpath exists between the two `FedosLocalProfilePaths` outputs. |
| INV-10 | Construct `FedosConversationSecurityStateFacts` where `encryption.ratchetStatus = "active"` but `forwardSecrecy.forwardSecrecy = false` (a real, reachable combination — e.g. a legacy-route message sent alongside an active-but-unused ratchet session). | `deriveConversationSecurityState()` returns Axis 2 = `"good"` AND Axis 3 = `"attention"` (`no-forward-secrecy-...`) simultaneously — never Axis 3 = `"good"` merely because Axis 2 is `"good"`. |
| INV-11 | Seal a secret under `fedosDirectRatchetSealingDeviceContext(AcctX, "dev-1")`. Attempt `restore_direct_ratchet_secret` using context `fedosDirectRatchetSealingDeviceContext(AcctY, "dev-1")` (same device string, different account). | Restore fails (AEAD open failure / no plaintext returned); the secret is not recoverable under the wrong account context even with an identical device-ref string. |
| INV-12 | Simulate an Option-A migration: run the self-binding-registration migration step, then re-run the ENTIRE migration routine again from scratch (simulating a restart) without any state cleared in between. | Second run detects the completed tuple and performs zero additional writes (no duplicate `registerDevice()` call, no `"conflict"` triggered against itself); final Registry state is identical to a single successful run. |
| INV-13 | Simulate a re-seal migration that completes for tuple T1 but crashes (process kill) before completing for tuple T2, leaving T2's sealed secret still under the OLD context. Attempt `restore_direct_ratchet_secret` for T2 using the NEW (post-migration) context. | The failure is logged/reported with a distinct reason (e.g. `"migration-incomplete-for-tuple"` or equivalent), not silently folded into the ordinary "no session record found, treat as cold start" path; a monitoring/test hook can assert the distinct code path was taken. |
| INV-14 | Attempt to call the link-table writer function directly with a caller-supplied `(spaceAValue, spaceBValue)` pair that does NOT match either value actually present in this node's own two durable identity files. | Call is rejected/impossible — the writer function's own signature/implementation only ever reads its inputs from the two identity files themselves, never accepts them as free-form parameters from an arbitrary caller. |
| INV-15 | Populate the link table with a valid local-self link. Independently mark the corresponding Registry binding as `"revoked"`. Query "is this device trusted" through the link-consuming code path. | Result is `"revoked"`/not-trusted — the mere existence of a link entry does not override or bypass the Registry's own current trust state. |
| INV-16 | Under Option B, construct an inbound session-reset payload whose `senderDeviceRef` (Space B) maps via the link table to a local Space A record with an existing session at `generation = 5`. Deliver the payload with `generation = 2` (stale) BEFORE the translation layer has been invoked in the receiving code path (simulate an ordering bug by intentionally calling generation-lookup pre-translation in a test harness). | If translation is correctly ordered before lookup, the stale `generation = 2` is correctly compared against `locallyKnownPreviousGeneration = 5` and rejected. The test should also include a NEGATIVE control demonstrating that if translation were skipped/reordered, the lookup would incorrectly resolve against the WRONG (untranslated) key and find no prior record, misclassifying the rollback attempt as a fresh establishment — proving the ordering discipline is load-bearing, not cosmetic. |

---

## 5. Summary for the record

Every one of the 14 attacks resolves to SAFE-BY-CONSTRUCTION or SAFE-WITH-EXPLICIT-CHECK for Option A; the two
places Option A needs real engineering discipline (migration idempotency, attacks 13/14) are self-contained,
one-time, and — per the design doc's own §5 — apply to zero real production data today, making them low-risk
in practice despite requiring explicit correctness work. Option B concentrates its risk in exactly the place its
own design doc already flagged (the link table, attacks 2/10), and while every named risk there is
VULNERABLE-IF-CARELESS rather than GENUINELY-VULNERABLE, it introduces a **standing, permanent** translation
layer that INV-14/15/16 must hold correctly forever, not just once during a migration window — a strictly larger
attack surface over the system's lifetime than Option A's one-time migration risk. Option C is not independent;
it inherits whichever of A/B carries out the actual unification, plus one additional narrow risk of its own
(cross-domain signature reuse if the unified keypair's signing preimages aren't kept domain-separated, attack 2)
and one open design question A/B don't have (what happens when one public key legitimately appears under two
different legacy `deviceId`s post-unification, attack 9).
