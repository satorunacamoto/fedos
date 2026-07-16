# Review 1 — Decision Reconciliation

Sources cited: **AAR** = Application API review (`review/board-runtime-api`
@ `d6dd7dc`); **SEC** = Security review
(`worktree-private-conversation-security-review` @ `b56cfde`); **POL** =
Policy Arc (`arc/public-identity-conversation-policy` @ `f90ad71`,
unmerged, shipped code); **MASTER** = current integrated `master`
(`9c1f52c`).

Status vocabulary: **frozen** (design and implementation agree, safe to
build on without re-deciding), **provisional** (design agreed, but the
real implementation is a fixed/degenerate placeholder that will need to
change shape later), **blocked** (cannot proceed until a named
prerequisite lands), **out of V1** (deliberately not attempted by this
spec).

| Topic | Status | Basis |
|---|---|---|
| Conversation mode | **frozen** | AAR §04 and POL's `fedos_conversation_mode.ts` define the byte-for-byte identical union: `"public" \| "private-group" \| "direct"`. POL additionally freezes `FEDOS_CONVERSATION_MODE_V1_SUPPORTED = "public"`. No contradiction. |
| Conversation ID | **provisional — contradiction found** | AAR §04/§15 and SEC §03 both independently call for a distinct, Authority-derived `FedosConversationId`, never reusing `FedosBoardId`/`FedosThreadId` (SEC §03: *"Do NOT define DM as 'a Board with 2 members'"*). POL shipped a real `FedosConversationPolicy` and `FedosConversationPolicyAuthority` but **never introduced a Conversation ID at all** — `FedosConversationPolicyResolutionInput` is keyed directly by `{ boardId, threadId }`. Both design reviews call for an identity concept that the only real implementation quietly skipped. See `03_conversation_identity.md` for the resolution. |
| Policy ownership | **provisional** | AAR §02 recommended a new `FedosBoardRuntime`-adjacent owner (not `FedosDesktopHost`); POL's `FedosConversationPolicyAuthority` interface + `StaticFedosConversationPolicyAuthority` matches that shape exactly. Provisional because the one shipped implementation returns the **same fixed policy value for every input**, never a real per-Board/Thread persisted fact. |
| Author authority | **provisional / blocked (protocol-dependent)** | MASTER's `resolvePublicAuthorReference()` always falls back to anonymous-local (no default identity source wired). POL's `FedosPublicAuthorAuthority` vocabulary (`resolved \| anonymous-local \| unavailable \| conflict`) is strictly richer and matches AAR §03's "Authority-derived, never caller-supplied" requirement. POL's own `FedosOutboundEligibilityEvaluator` reports every real Nostr target as `"identity-not-controlled"` today — blocked on the in-progress Nostr Identity Binding Arc (see `07_private_readiness_gate.md`). |
| Participant identity | **out of V1** | AAR §06's 5-variant `FedosConversationParticipantRef` union, extended by SEC §04 with a 6th `"device"` variant — the two do not conflict, SEC only adds a variant. Not implemented in POL or MASTER. Not needed until membership exists. |
| Membership | **blocked, and the blocker is already visible in shipped code** | AAR §06 and SEC §04 both specify `FedosConversationMembership`. POL's real `validateFedosConversationPolicy()` **actively rejects** `writeAccess: "restricted"` specifically because no membership authority exists to honor it — the shipped implementation itself confirms the blocker rather than merely being silent about it. |
| Message model | **out of V1** | AAR §09 compares 4 options and recommends B (dedicated Private Conversation Record) with D's storage separation. SEC §02 arrives at the same recommendation independently, with a concrete illustrative shape (`FedosConversationMessage` carrying `ciphertext`/`keyEpoch`). No implementation anywhere. |
| Ciphertext storage | **out of V1** | AAR §09 and SEC §07 agree: a boundary separate from `FedosBoardPersistence`. SEC §07 adds the concrete reason — every existing durable backend leaks sender/timestamp/reply-graph in plaintext even if `body` were hypothetically ciphertext. Not implemented. |
| Invitation capability | **out of V1 — contradiction found** | AAR §08 and SEC §09 both specify a rich capability shape (SEC adds `intendedRecipient`/`keyEpochReference`/`redemptionAuthority`). POL's shipped `FedosConversationInviteAuthority` type has exactly **one** legal value, `"none"` — the current type system does not yet even have a second value to widen into, which is a stricter starting point than either review assumed it would find. |
| Deletion | **provisional** | AAR §02 (foundation pass) specifies exactly two Conversation lifecycle states, `"active" \| "closed"`, no `"deleted"`. SEC §08 supplies a disjoint, complementary framework: 8 distinct meanings of "delete" at the **message/ciphertext** level, not the Conversation level. The two are not in conflict — one is about Conversation lifecycle, the other about content erasure — but nothing in `master` or POL implements either. `fedos_board_moderation.ts` independently confirms: types-only, zero enforcement, no `deleted` boolean anywhere, matching both reviews' own discipline. |
| Outbound eligibility | **frozen for public / blocked for private** | MASTER's `isEligibleForPublicOutboundTarget()` and POL's `evaluateFedosOutboundEligibility()` both already implement the "runs before any Outbox intent, fail-closed" chain AAR §10 required. SEC §11 extends the SAME chain with one new required step for private modes (encryption/envelope readiness) — an extension, not a contradiction. Private-mode eligibility cannot be exercised until that step's prerequisite (`07_private_readiness_gate.md`) exists. |
| Pseudonym | **out of V1** | AAR §07 recommends random assignment over deterministic derivation (SPOF risk). SEC §13 independently strengthens the same conclusion using the real Master-Seed/HKDF hierarchy: a naive deterministic scheme keyed off the Master Seed would let one leak deanonymize every pseudonym in every conversation at once. Full agreement, no contradiction. Not implementable until `FedosConversationMembership` exists to hold it. |
| Protocol mapping | **provisional / blocked** | AAR §13 gives a high-level per-protocol table; SEC §18 supplies the source-grounded detail (e.g. Session has no DM-vs-group distinction modeled anywhere in its own adapter, not even as a comment) and names six items requiring official protocol-spec research. SEC refines AAR; neither contradicts the other. |

## Contradictions requiring an explicit V1 decision

1. **Conversation ID exists in two independent design docs and zero
   implementations.** POL shipped policy resolution keyed by raw
   `(boardId, threadId)` instead of introducing the identity both prior
   reviews called for. This spec resolves it in `03_conversation_identity.md`:
   introduce `FedosConversationId` now, deterministically wrapping
   `(boardId, threadId)` for the only mode V1 can construct, rather than
   leaving policy resolution keyed by a raw tuple indefinitely.
2. **Invitation vocabulary is narrower today than either review assumed.**
   `FedosConversationInviteAuthority` having exactly one legal value
   means invitation is not merely unimplemented — the type system
   itself currently forbids representing a second value. Any future
   invitation work must widen this enum before it can do anything else,
   and that widening must not happen before `10_membership_boundary.md`'s
   prerequisites are real (see `12_invitation_capability.md`).
3. **No open contradiction on cryptography.** AAR treated the encryption
   scheme as "an open, undecided question." SEC found the opposite kind
   of gap: a real, correct, vector-verified AEAD/HKDF/conversation-key
   pipeline already exists in `packages/fedos-core-rust/`, but is
   `pub(crate)`-only and has no compiled WASM artifact in this tree.
   This is not a contradiction between the two reviews (AAR simply
   hadn't looked at the Rust core); it changes the private-readiness
   picture from "invent a scheme" to "export and wire an existing one"
   (`07_private_readiness_gate.md`).
