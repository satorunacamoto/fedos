# Review 04 — Private Group Construction Command

## Caller-allowed input surface

Mirrors `CreatePublicThreadCommand`'s own established discipline
(`src/board/runtime/fedos_board_runtime_command_types.ts`, confirmed by
`test/reviews/conversation_foundation_v1/source_alignment.test.ts` item
2: "carry no Authority-derived field... on the caller-facing surface")
— a construction command names WHAT the caller wants, never WHO they
are or WHAT the system decides.

```ts
export interface CreatePrivateGroupConversationCommand {
  readonly boardId: string | null;      // null is legal — see below
  readonly discoverability: "unlisted"; // private-group is never "listed" (07)
  readonly federationEligibility: "local-only" | "allowed";
  readonly initialCapability?: {
    readonly maxUses: number;
    readonly expiresAt: number | null;
  }; // presence/absence only decides WHETHER one is issued (11) — never its id/secret
}
```

## Caller must NOT be able to supply (enforced, not merely undocumented)

- **Creator Membership state** — no `role`, `state`, `joinedAt` field.
  Creator Membership is always `role: "owner"`, `state: "active"`,
  constructed by the command handler alone (`06`), the same way
  `FedosBoardRuntime` never accepts a caller-supplied `author` on
  `CreatePublicThreadCommand` (source-alignment test item 2).
- **Author/creator identity** — no `creatorId`/`identityId`/`participant`
  field. The command handler resolves the creator via the injected
  identity-readiness axis (`02` axis 2), exactly as
  `FedosBoardRuntime.createPublicThread()` resolves `author` via
  `#authorAuthority.resolvePublicAuthor()` rather than accepting one on
  the command.
- **Raw key / key epoch** — no field of any kind related to encryption
  material. `08` names encryption readiness as a gate the command
  handler CONSULTS; a command that could carry key material would
  contradict every "opaque handle, never raw bytes" guardrail already
  established across `src/crypto/types.ts`, `src/vault/types.ts`, and
  `src/runtime/master_seed/fedos_master_seed_authority.ts` (all
  confirmed in `01`).
- **Capability use count** — `initialCapability.maxUses` is a caller
  PREFERENCE (how many uses the issued Capability should permit), not
  a caller-supplied CURRENT use count. `currentUses` on the resulting
  `FedosPersistedConversationCapabilityRecordV1` is reconstructed
  server-side from redemption events
  (`reconstructFedosConversationCapabilityRecord()`,
  `src/conversation/capability/persistence/append_only_fedos_conversation_capability_persistence.ts`)
  and can never be caller-supplied for a brand-new Capability, matching
  the existing `FedosConversationCapabilityIssueRequest` shape
  (`src/conversation/capability/fedos_conversation_capability_issuer_authority.ts`),
  which also carries no `currentUses` field.
- **Persistence state** — no `"inserted"`/`"already-present"` field of
  any kind; that is the WRITE RESULT (`10`), never an input.
- **Encryption result** — no ciphertext, key handle, or epoch reference
  field; construction's own relationship to encryption is gate-only
  (`08`), never payload-carrying.
- **Arbitrary policy bag** — no free-form `policy` object. Every
  policy axis the caller may influence is named explicitly and
  independently on the command (`discoverability`,
  `federationEligibility` above); `readAccess`/`writeAccess`/`inviteAuthority`/`mode`
  are NEVER caller-supplied — construction fixes them per `07`'s own
  private-group defaults, the identical reasoning
  `validateFedosConversationPolicy()` already applies today by
  rejecting `writeAccess === "restricted"` from ANY caller input,
  accepted or not.

## Why `boardId` is nullable

`FedosConversationId` today is deterministically derived from
`(FedosBoardId, FedosThreadId)` (`01`) — a scheme built for a Board
thread, not a standalone private space. This review does NOT resolve
that mismatch (a Conversation Record/Id redesign is a production
source change, out of this review's own scope) but names it plainly:
a private-group Conversation command's `boardId` field is written here
as nullable specifically to keep the command's own shape from
presupposing the answer. `10`/`20` return to this as the single
largest open structural question the next Arc must resolve before any
`private-group`/`direct` record can be constructed at all.

## Result vocabulary

```ts
export type CreatePrivateGroupConversationResult =
  | { readonly outcome: "created"; readonly conversation: FedosConversationRecord; readonly ownerMembership: FedosConversationMembership; readonly capability?: { readonly descriptor: FedosConversationCapabilityDescriptor; readonly bearerSecret: FedosConversationCapabilityBearerSecret } }
  | { readonly outcome: "already-present"; readonly conversation: FedosConversationRecord }
  | { readonly outcome: "conflict" }
  | FedosConversationConstructionReadiness; // any non-"ready" readiness outcome from 03, surfaced verbatim
```

No new result vocabulary invented beyond `03`'s readiness outcomes plus
the same `"created"`/`"already-present"`/`"conflict"` triad
`FedosConversationPersistenceWriteResult` already uses — mirrors
`FedosBoardRuntime`'s own precedent of reusing an existing write-result
vocabulary rather than minting parallel tokens.
