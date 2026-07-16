# Review 7 — Private Foundation Readiness Gate

## Exact prerequisites, each checked against real source

| Prerequisite | Current state | Source |
|---|---|---|
| **Identity** | `FedosPublicAuthorAuthority` vocabulary exists (Policy Arc) and is richer than `master`'s fallback-only version, but `FedosOutboundEligibilityEvaluator`'s own final per-protocol check resolves Nostr to `"identity-not-controlled"` **unconditionally** — no signing-authority-to-identity binding exists anywhere in the codebase yet. This is the exact gap the in-progress, unmerged `arc/nostr-identity-binding` Arc targets. | `f90ad71:src/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.ts`; `arc/nostr-identity-binding` (in progress, outcome unknown to this review) |
| **Membership authority** | Does not exist. `writeAccess: "restricted"` is syntactically representable but actively rejected by the real validator for exactly this reason. | `f90ad71:src/board/runtime/policy/fedos_conversation_policy.ts` |
| **Message envelope** | Does not exist. `FedosBoardPost` is the only post shape in `src/board/`, unconditionally public/plaintext. | `src/board/fedos_board_post.ts` (this worktree) |
| **Encryption authority** | A real, vector-verified AEAD/HKDF/conversation-key derivation pipeline exists in `packages/fedos-core-rust/`, but (a) the conversation-key function is `pub(crate)`-only, never exposed via `#[wasm_bindgen]`; (b) no compiled WASM artifact (`packages/fedos-core-rust/pkg/`) exists in this checked-out tree, so every TS-side runtime crypto call resolves `null`/denies unconditionally regardless of `NODE_ENV`; (c) no decision exists for whether/how this gets enabled in a production build at all. This is a materially better starting point than "no crypto exists" — it is an export-and-wire task, not a from-scratch cryptography problem — but it is still blocked today. | SEC §01, §20 (BLOCK-1/2/3) |
| **Key distribution** | The real ECDH conversation-key primitive above degenerates cleanly to a single pairwise channel for `direct` mode with no new key-distribution logic required once exported — but exporting it is itself blocked (see Encryption authority row). Group-mode Sender-Key/MLS-style distribution is explicitly out of scope for any near-term Arc (SEC §05: *"should not be hand-designed... requires adopting an existing, formally-specified scheme"*). | SEC §05 |
| **Private storage** | No backend exists. Both existing durable backends
(`AppendOnlyFedosBoardPersistence`/`AppendOnlyFedosBoardOutboxPersistence`)
are confirmed plaintext-only with no delete/truncate/compaction method — reusing either for private content is rejected by SEC §07. | `src/board/persistence/fedos_board_persistence.ts` (this worktree, confirmed: no `delete` method, header states so explicitly); SEC §07 |
| **Retention/deletion** | No product decision exists for which of SEC §08's eight meanings of "delete" a future private-mode delete action performs. Cannot be resolved by an engineering Arc alone — requires an explicit product choice. | SEC §08 |
| **Outbound eligibility (private)** | The gate chain shape is known (`13_outbound_eligibility.md`), but cannot be exercised end-to-end until Encryption authority above is real — there is no ciphertext to gate delivery of. | SEC §11 |

## The gate, defined conceptually (not implemented)

A future Arc may find it useful to encode the above as a single,
machine-checkable readiness report — conceptually:

```ts
interface FedosPrivateConversationReadiness {
  readonly identityBindingResolved: boolean;
  readonly membershipAuthorityWired: boolean;
  readonly messageEnvelopeExists: boolean;
  readonly encryptionAuthorityExported: boolean;
  readonly keyDistributionChosen: boolean;
  readonly privateStorageBackendExists: boolean;
  readonly retentionPolicyDecided: boolean;
  readonly privateOutboundEligibilityWired: boolean;
}
```

Every field above is `false` today. This spec does not implement this
interface, a function that produces it, or any stub/default value for
it — it exists here only as a description of what "private-group/direct
becomes constructible" would mean in machine-checkable terms, for a
future Arc to actually build. `test/reviews/conversation_foundation_v1/boundary_invariants.test.ts`
encodes the *current, all-false* state as a set of source-inspecting
assertions (each prerequisite's absence, not the interface itself).
