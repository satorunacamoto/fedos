# 09 — Invitation as Capability

## Baseline, re-confirmed this pass

Direct source search (repeated, unchanged since the prior review's own
§08 finding): no invite token, link, generation, redemption, or
join-request/approval flow exists anywhere in `src/`.
`MembershipPolicy: "invite_only"` (`src/community/types.ts:23`,
re-verified unmodified) remains an unenforced label only. This section
extends the prior review's own §08 Capability shape with the two
Private-Conversation-specific fields this review's own instruction adds
(`intendedRecipient`, `key epoch reference`) that public-mode
invitation never needed.

## Required fields (design-level only, not implemented by this review)

```ts
// Design shape only. Not implemented by this review.
interface FedosConversationInvitationCapability {
  readonly capabilityId: FedosConversationCapabilityId;   // §03
  readonly conversationId: FedosConversationId;             // §03
  readonly allowedAction: "join-as-member" | "join-and-write"; // small, closed set -- unchanged from prior review's own §08
  readonly issuer: FedosConversationParticipantRef;          // WHO issued it -- an authority fact, not a display name
  readonly maxUses: number;
  readonly expiresAt: number | null;
  /**
   * `null` for a general (any redeemer) capability; a specific
   * participant reference for a capability intended for ONE person.
   * NEW this review, relative to the prior review's own §08 shape --
   * required specifically for Private Conversation, where an
   * un-targeted capability leaking to the wrong person is a real
   * confidentiality failure, not merely an unwanted-guest annoyance
   * (the public-mode-only prior review never needed this field).
   */
  readonly intendedRecipient: FedosConversationParticipantRef | null;
  /**
   * NEW this review: which key epoch (§06) a successful redemption
   * should grant access FROM. Does not itself deliver the key --
   * see §06's own "key delivery must happen strictly after membership
   * is durably recorded" ordering requirement.
   */
  readonly keyEpochReference: FedosConversationKeyEpoch;
  /**
   * NEW this review: WHO/WHAT has authority to approve a redemption
   * attempt, if redemption requires anything beyond presenting the
   * capability itself (e.g. a conversation policy requiring an
   * existing member's explicit approval even for a valid, unexpired
   * capability. Distinct from `issuer` -- the issuer creates the
   * capability; redemption authority approves its USE, which may be a
   * different actor or even a different rule (e.g. "any current
   * member may approve") than whoever originally issued it.
   */
  readonly redemptionAuthority: FedosConversationParticipantRef | "any-current-member" | null;
}
```

## Prohibited shapes, restated and extended

Unchanged from the prior review's own §08, all reconfirmed still
correctly forbidden:

- **The URL string itself must never be the record of authority** — the
  server-side Capability record above is the source of truth; a URL
  (or QR code) carries only `capabilityId` plus enough entropy to make
  guessing infeasible.
- **A secret capability token must never be embedded inside a public
  post.** Doubly true for Private Conversation specifically — §07/§11
  already establish that Private content must never reach a public
  Outbound Publisher; embedding a capability secret in ANY content that
  could transit that path (even a public Board post referencing "join
  my private chat") would leak the secret through exactly the channel
  §11's Outbound Eligibility gate exists to prevent leaking THROUGH.
- **Issuer display name must never be treated as authority.** The
  `issuer` field above is a `FedosConversationParticipantRef` (an
  Authority-derived identity reference, §04), never a display string —
  mirrors §13's own "pseudonym is never used for authorization"
  requirement, extended to invitation issuance specifically: a
  moderator revoking a capability acts on `issuer`'s own
  `participantRef`, never on whatever pseudonym that issuer happened to
  display in the conversation at issuance time.
- **`capabilitySecret` (the actual bearer-token bytes, distinct from
  `capabilityId`) must never be stored inside `FedosConversationMessage`
  or any Board-domain record** — it is Capability-domain data,
  persisted (if at all) in the SAME Private Storage boundary §07
  recommends for message ciphertext, never comingled with message
  content itself.

## Invitation URL is a transport representation, never the primary record

Restated for Private Conversation specifically: an invitation URL
should encode, at minimum, `capabilityId` plus a bearer secret
sufficient to prove possession — but the SERVER-SIDE (or, in a
peer-to-peer deployment, whichever node holds redemption authority)
`FedosConversationInvitationCapability` record above remains the
canonical fact of what the capability actually grants. A URL that
independently encoded `allowedAction`/`maxUses`/`expiresAt` itself
(rather than merely a pointer + secret) would make those terms
unenforceable the moment the URL is copied/forwarded outside its
intended distribution channel — the record, not the URL, must be
consulted at redemption time, every time.

## See also

- `docs/reviews/private_conversation_security/06_key_epochs.md`
- `docs/reviews/private_conversation_security/10_one_time_redemption.md`
- `docs/reviews/board_runtime_application_api_08_invitation_capability_model.md`
