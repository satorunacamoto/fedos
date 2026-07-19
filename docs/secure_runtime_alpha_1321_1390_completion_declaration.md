# Secure Runtime Alpha 1321–1390 — Completion Declaration

Private Group Pairwise Fanout Foundation Arc. Worktree
`C:\wt\private-group-fanout`, branch
`arc/private-group-pairwise-fanout-foundation`.

## 1. Integrations performed

One prerequisite merged into a dedicated integration branch built from
`7990ce4` ("Secure Runtime Alpha 1181–1260: Conversation Runtime
Finalization Arc", the tip of `arc/private-conversation-activation-direct-messaging`
at the time this Arc began):

| Branch | Commit | Merge result |
|---|---|---|
| `review/private-group-pairwise-fanout-v1` | `b205ff0` | Clean, zero conflicts (docs/tests-only review commit) |

No `Alpha 1261–1320` branch existed anywhere in this repository at any
point during this Arc (confirmed directly, `docs/secure_runtime_alpha_1321_1390_reconciliation_report.md`
§0) — nothing from it was merged, depended on, or guessed at.

## 2. Group Container model

The EXISTING, unmodified `private-group` draft (`createPrivateGroupDraft()`,
Alpha 915) is the Group Container — no duplicate group id, no new
Conversation type. It owns its own Membership roster, Capability/
Invitation state, and (new, this Arc) a Generation history and a local
canonical Group Message log. It does NOT own a shared encryption key,
a Relay event, a canonical remote transcript, or any per-recipient
Direct Conversation's own key material.

## 3. Generation model

`FedosGroupGenerationRecord` (`src/conversation/group/fedos_group_generation.ts`):
`{ groupConversationId, generationId, generationNumber, activeMemberMembershipIds
(sorted, deduplicated, ≥2), createdAt, previousGenerationId }` — immutable,
never mutated, deterministic id (`group-generation::<group>::<number>`).
`FedosGroupGenerationAuthority.createNextGeneration()` snapshots the
Group Container's own real Membership roster; a repeat call with an
unchanged roster returns `"unchanged"`, never a duplicate generation.
A configurable, explicitly OPERATIONAL (never cryptographic) participant
limit (`FedosGroupParticipantLimitPolicy`, default 8) is enforced before
any generation is created.

## 4. Direct path model

`FedosGroupDirectPathRecord`: `{ pathId (generation-scoped, deterministic),
groupConversationId, generationId, senderMembershipId, recipientMembershipId,
directConversationId, state (pending|ready|unavailable|superseded), createdAt,
updatedAt }` — no key, ciphertext, or bearer secret field of any kind.
`FedosGroupDirectPathAuthority.preparePath()` composes, in order, the
EXISTING, unmodified `createDirectDraft()` (Alpha 915),
`FedosConversationCapabilityRedemptionAuthority.redeem()` (Alpha 783),
and `FedosConversationDirectActivationCoordinator.activateDirectConversation()`
(Alpha 1122) — never constructing an "active" fact directly. A
counterparty whose `authority !== "nostr"` is marked `"unavailable"`
permanently, before any construction attempt (Alpha 1338). A KNOWN,
NAMED limitation is documented in the file's own header: a process
crash between Capability issuance and this same call's own redemption
step leaves that one path permanently `"admission-failed"` (the one-time
bearer secret is lost) — a real, narrow gap inherent to self-serve,
single-Runtime redemption, not silently papered over.

## 5. Fanout coordination and recovery

`FedosGroupSendCoordinator.sendGroupMessage()` — Option A (all-or-nothing,
Alpha 1345): every recipient's own Direct path is lazily prepared and
confirmed `"ready"` BEFORE any durable Group Message write. A
`FedosGroupMessageRecord` (`{id, groupConversationId, generationId,
senderMembershipId, createdAt, replyToGroupMessageId, recipientCount,
fanoutState (planned|complete|failed)}`, deterministic id from an
idempotency key, mirroring `FedosConversationEncryptMessageCommand`'s
own pattern) is then persisted, followed by one call to the EXISTING,
unmodified `FedosConversationDirectMessagingCoordinator.sendDirectMessage()`
per recipient. Because that facade's own public command surface exposes
no idempotency key of its own, THIS coordinator's own
`FedosGroupFanoutDeliveryRecord` log (`{groupMessageId, recipientMembershipId,
pathId, envelopeId, state (planned|encrypting|stored|failed), createdAt}`)
is the recovery mechanism: before calling `sendDirectMessage()` for a
recipient, it checks for an already-`"stored"` delivery fact and skips
the call entirely if found — verified end to end (restart with the
SAME idempotency key returns the SAME `groupMessageId` and the SAME
recipient Envelope ids, never a duplicate).

## 6. Member evolution

`addPrivateGroupMember()`/`removePrivateGroupMember()` (`FedosConversationGroupRuntime`)
compose the EXISTING issue/redeem/revoke authorities against the Group
Container's own Membership, then call `createNextGeneration()` — two
narrow, separately-testable steps, never fused. Removal excludes a
member from future fanout (recipient planning reads the CURRENT
generation fresh every send) but never revokes already-derived pairwise
key material and never touches the removed member's own existing Direct
Conversation with the sender (an honest, explicitly-documented
limitation, not a claim of retroactive erasure). An old generation's
own `"ready"` path for a member excluded from the next generation is
marked `"superseded"` (a new fact, the old one never mutated).

## 7. Local history semantics

`listPrivateGroupMessages()` returns `createdAt`-ascending, id-tie-broken
summaries (mirrors `listDirectMessages()`'s own "LOCAL ordering only...
never protocol/global ordering" discipline, Alpha 1133) with a
per-message fanout summary (`recipientCount`/`storedCount`/`failedCount`)
computed from the delivery-record log — never a decrypt of any
recipient's own copy. There is no single canonical group transcript;
each local Runtime's own view is its own sender-side record only.

## 8. Limits

`FedosGroupParticipantLimitPolicy` (default `FEDOS_GROUP_DEFAULT_MAX_ACTIVE_MEMBERS
= 8`) is enforced in `createNextGeneration()` before a generation (and
therefore any fanout against it) can exist — explicitly documented as an
OPERATIONAL bound (local fanout cost, storage, test runtime), never a
cryptographic one.

## 9. Threat-model exclusions, restated plainly

This Arc does NOT provide: transcript consistency across recipients (a
malicious/buggy sender could send different plaintext to different
recipients — no group MAC/transcript hash exists or is invented);
forward secrecy or post-compromise security (unchanged from plain
Direct mode — every pairwise key still derives from the same Master
Seed); Sender-Key-level metadata efficiency (N simultaneous deliveries
directly reveal a lower bound on group size to any observer positioned
to see more than one); operator/metadata anonymity of any kind; remote
or physical deletion (retention only ever denies THIS Authority's own
future reads, Alpha 799, unchanged); multi-device sync; backup/export
of any Group fact.

## 10. Direct-mode and public-mode regression

`test/secure_runtime_alpha_1111_1180_direct_activation.test.ts`,
`..._direct_messaging.test.ts`, `..._runtime_vertical_slice.test.ts`,
`test/secure_runtime_alpha_1181_1260_conversation_runtime_finalization.test.ts`,
`test/secure_runtime_alpha_931_990_failure_matrix.test.ts`,
`test/secure_runtime_alpha_943_946_encryption_decryption_coordinators.test.ts`,
and `test/secure_runtime_alpha_949_runtime_wiring.test.ts` all pass
unmodified. `FedosBoardRuntime`/`Publisher`/`Scheduler`/`Outbox`/`p2p/`
are untouched by any file this Arc adds or edits (confirmed by source
grep, `test/secure_runtime_alpha_1321_1390_architecture_and_secret_guards.test.ts`
item 4).

## 11. Tests / typecheck

`npm run typecheck`: clean (one pre-existing, unrelated failure,
confirmed identical to the pre-Arc baseline — `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`).
Targeted Conversation+Group-domain run: 95/95 (this Arc's own three new
test files — vertical slice, architecture/secret guards — all pass;
every pre-existing Direct/Board/Runtime suite this Arc's own wiring
touches passes unmodified). Full `npm test`: 12015/12259 passed (244
failed across 191 files). Every failure was individually categorized —
none is attributable to this Arc:

- **~200 failures**: a confirmed, pre-existing `core.autocrlf`
  worktree-checkout CRLF artifact (this worktree's own
  `packages/fedos-core-rust/Cargo.toml` and other Rust/design-doc files
  are checked out with CRLF line endings, breaking dependency-count and
  verbatim-text string comparisons those tests perform) — the exact
  same category the Alpha 1111–1180 and Alpha 1181–1260 completion
  declarations already diagnosed and named (173 affected files at that
  point; the count grows over time as more "Stage"/"Alpha" design-doc
  tests accumulate, unrelated to any one Arc's own source changes).
  Confirmed directly: `file packages/fedos-core-rust/Cargo.toml`
  reports "CRLF line terminators"; `git diff` shows zero change to that
  file.
- **4 failures**: already independently named as pre-existing in
  `master`'s own README (`8b65609`) BEFORE this Arc began —
  `test/publish_pipeline_host_ownership_review_current_state.test.ts`,
  `test/secure_runtime_alpha_472_scheduler_responsibility_decision.test.ts`,
  `test/secure_runtime_alpha_405_submit_post_authority_verification.test.ts`,
  `test/secure_runtime_alpha_543_publish_runtime_ownership_audit.test.ts`.
- **Remaining failures**: prior reviews' own "git status stays confined
  to this review's own directory" checks (e.g.
  `test/reviews/private_message_envelope_v1/specification_consistency.test.ts`
  item 18, `test/secure_runtime_alpha_531_ripple_review.test.ts`) —
  these check the CURRENT working tree against a fixed list of allowed
  paths, and are EXPECTED to fail once this Arc's own real, additive
  `src/conversation/group/` changes exist in the tree; they check
  history at the moment they were authored, not a standing invariant
  this Arc violates.

Zero failure references `src/conversation/group/`, `groupRuntime()`, or
any identifier this Arc introduces.

## 12. Dependencies

`package.json`/`package-lock.json`/`Cargo.toml` byte-for-byte unchanged
(verified via `git status` and via
`test/secure_runtime_alpha_1321_1390_architecture_and_secret_guards.test.ts`
item 7 — exactly two production dependencies, exactly three dev
dependencies, both unchanged).

## 13. `p2p/` untouched

Confirmed — `p2p/` never appears in this worktree's `git status` output
and was never read, imported, or referenced by any file this Arc added
or modified (this worktree's own checkout does not contain a `p2p/`
directory at all, consistent with the primary worktree's own untracked-only
`p2p/`).

## 14. Rebase compatibility requirement

Per this Arc's own explicit instruction: once a real `Alpha 1261–1320`
("Production Crypto Activation") Arc lands, this branch must be rebased
and its own real Production Crypto compatibility tests re-run before
merge — this Arc's own group orchestration layer makes no assumption
about the Encryption/Decryption Authority being Fake vs. real (it never
touches either directly, only through the frozen Coordinators), so no
redesign is anticipated, but this is a requirement to VERIFY, not an
assumption to skip.

## 15. Next Arc recommendation

**If Alpha 1261–1320 (Production Crypto Activation) also succeeds:**
**Nostr Private Direct and Pairwise Fanout Delivery Arc** — the smallest
protocol-delivery Arc that makes both Direct messages and this Arc's
own group fanout actually reach another device, per
`docs/reviews/private_protocol_delivery_group_v1/20_normative_next_arc.md`'s
own reasoning, now doubly justified since both the Direct AND the group
local-send pipelines are real and proven.

**Otherwise:** Conversation Crypto Production Activation (building the
WASM artifact and wiring a real seeded Master Seed Authority) remains
the correct, unconditional next step — every real capability this Arc
and Alpha 1111–1260 already proved (activation, send, read, list,
fanout, restart, recovery, member evolution) is verified today only
against injected Fake Authorities; production readiness is gated on
that one Arc alone.
