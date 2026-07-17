# Review 01 — Current Source Alignment

Direct inspection of this worktree's own checked-out `src/` tree at
`d8bbfae`, area by area. "Real" means shipped, tested, exercised code
with no placeholder gate blocking it. "Review-only" means the concept
exists only in `docs/reviews/*` prose, not in `src/`. "Gated closed"
means real code exists but is structurally prevented from doing
anything, by design, today.

## Conversation identity and record — REAL, but public-mode-only by construction

- `src/conversation/fedos_conversation_id.ts` — `FedosConversationId`,
  `toFedosConversationId(boardId, threadId)`. Real, pure, deterministic.
  Hard-coded to a `(FedosBoardId, FedosThreadId)` pair — there is no
  second constructor for an id not anchored to a Board thread.
- `src/conversation/fedos_conversation_record.ts` — `FedosConversationRecord`
  (`id`, `mode`, `boardId`, `rootThreadId`, `rootPostId`,
  `policyReference`, `createdAt`). `mode: FedosConversationMode` admits
  `"private-group"`/`"direct"` at the TYPE level.
- `src/conversation/fedos_conversation_record_validator.ts` —
  `validateFedosConversationRecord()`. Line `if (input.mode !== "public")
  return null;` — the ONLY constructor of a `FedosConversationRecord`
  fails closed for any mode other than `"public"`. **No code path in
  this checked-out tree can produce a `private-group`/`direct`
  `FedosConversationRecord` today**, independent of anything else in
  this review.
- `src/conversation/persistence/fedos_conversation_persistence.ts` /
  `in_memory_fedos_conversation_persistence.ts` /
  `append_only_fedos_conversation_persistence.ts` — REAL, working,
  mode-agnostic persistence port with two implementations. Neither
  implementation reads `record.mode` at all — the persistence layer
  itself has no opinion; the gate is entirely in the validator above.

## Conversation Policy — REAL, but public-mode-only by construction

- `src/board/runtime/policy/fedos_conversation_mode.ts` —
  `FedosConversationMode = "public" | "private-group" | "direct"`.
  `FEDOS_CONVERSATION_MODE_V1_SUPPORTED = "public"`.
- `src/board/runtime/policy/fedos_conversation_policy.ts` —
  `FedosConversationPolicy` (six independent axes: `mode`,
  `discoverability`, `readAccess`, `writeAccess`, `inviteAuthority`,
  `federationEligibility`). `validateFedosConversationPolicy()` rejects
  `mode !== "public"` AND separately rejects `writeAccess ===
  "restricted"` ("Alpha 653: no membership authority exists to honor
  this yet" — no longer true as of Alpha 761–790/821–850, but the
  validator was never revisited to reflect that).
- `src/board/runtime/policy/fedos_conversation_policy_authority.ts` —
  `StaticFedosConversationPolicyAuthority`, the one production
  implementation, resolves the fixed `FEDOS_CONVERSATION_POLICY_PUBLIC_V1`
  value for every input, unconditionally. No per-conversation policy
  authority exists.

## Membership — REAL and mode-agnostic

- `src/conversation/membership/fedos_conversation_membership.ts`,
  `fedos_conversation_role.ts` (`"member" | "moderator" | "owner"`),
  `fedos_conversation_membership_state.ts` (`"active" | "revoked" |
  "left"`), `fedos_conversation_membership_transition.ts`,
  `fedos_conversation_membership_authority.ts`,
  `in_memory_fedos_conversation_membership_authority.ts`,
  `persistence/persisted_fedos_conversation_membership_authority.ts` —
  all real, tested, and confirmed by direct reading to accept ANY
  `FedosConversationId` string with no mode check anywhere. `admit()`
  does not consult `FedosConversationPersistence`, does not check that
  the `conversationId` it is given corresponds to an existing
  `FedosConversationRecord`, and has no way to learn the record's
  `mode` even if it wanted to (the interface never receives one). This
  is a real, independently-usable domain — but nothing wires it to
  Conversation construction.

## Capability — REAL and mode-agnostic

- `src/conversation/capability/fedos_conversation_capability_descriptor.ts`,
  `fedos_conversation_capability_bearer_secret.ts`,
  `fedos_conversation_capability_issuer_authority.ts`,
  `fedos_conversation_capability_redemption_authority.ts`,
  `persistence/persisted_fedos_conversation_capability_authority.ts`,
  `coordination/fedos_conversation_durable_redemption_coordinator.ts` —
  all real. `FedosConversationCapabilityIssuerAuthority.issueJoinCapability()`
  takes an injected `FedosConversationExistenceCheck` — the ONE place
  in this whole domain that even asks whether a Conversation exists —
  and this Arc's own header states plainly: "this file makes NO claim
  that real, production private-invite authorization exists." The
  Durable Redemption Coordinator (`fedos_conversation_durable_redemption_coordinator.ts`)
  is a genuinely sophisticated, crash-recoverable, exactly-once-within-one-backend-set
  coordinator — the strongest persistence-coordination precedent this
  review found anywhere in the codebase (used directly in
  `10_persistence_coordination.md`).

## Retention and Payload Storage — REAL and mode-agnostic

- `src/conversation/payload_storage/fedos_conversation_payload_storage.ts`,
  `fedos_conversation_payload_descriptor.ts`,
  `in_memory_fedos_conversation_payload_storage.ts`,
  `append_only_fedos_conversation_payload_storage.ts` — real, keyed
  only by `FedosConversationPayloadId`/`FedosConversationId`, no mode
  check, `mediaType` fixed to the single value
  `"application/octet-stream"` (no ciphertext/plaintext claim of any
  kind).
- `src/conversation/retention/fedos_payload_retention_authority.ts`
  and siblings — real, working tombstone/removal state machine with an
  honestly-scoped security claim (see this file's own header: "MUST
  NOT claim secure physical overwrite... the byte-carrying JSON line
  remains on disk").

## `src/storage/*` — a DIFFERENT, unrelated boundary, not part of this domain

`src/storage/types.ts`, `policy.ts`, `noop_storage.ts`,
`encrypted_payload.ts` are a separate, older, generic "pluggable
storage backend" seam (Google Drive / Nostr relay / SQLite / mesh /
IPFS placeholders, buyer/payment/entitlement exclusions) with no
`FedosConversationId` reference anywhere and no import relationship to
`src/conversation/`. This review confirms they are NOT the Private
Conversation Payload Storage system and are out of scope for
construction — `02_readiness_axes.md`'s "payload storage ready" axis
means `src/conversation/payload_storage/`, never `src/storage/`.

## Encryption/crypto authority — REAL primitives, GATED CLOSED end-to-end

- `src/crypto/types.ts`/`noop_crypto.ts` — fully placeholder, unchanged
  since the prior review's own §01 finding: `NoopCryptoProvider` denies
  every operation, advertises zero capabilities.
- `src/runtime/fedos_runtime_crypto_provider.ts` — `FedosRuntimeCryptoProvider`:
  `encrypt()`/`decrypt()` ALWAYS resolve `"Unsupported"`.
  `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED = false`, a fixed constant whose
  own header states it "Reads NO `process.env`, accepts NO parameter
  or override anywhere in this module or any importer," confirmed by
  direct reading. `fedosProviderImplementationStage()`
  returns the fixed value `"RustInvocationAdapterReady"` — six of
  seven internal milestones complete, `"RustReady"` (the seventh,
  meaning a real Rust connection) permanently unreached in this tree.
- `src/runtime/fedos_wasm_artifact.ts` — `fedosWasmArtifactGenerated()`
  fixed `false`; `fedosArtifactGenerationObserved()` fixed `true`
  ("a real generation ATTEMPT... `cargo build` succeeded,
  `wasm-bindgen` failed — no `.wasm`/JS glue pair was produced").
  Confirms BLOCK-2 from the prior Security review still holds,
  unchanged, at this later commit.
- `src/runtime/master_seed/fedos_wasm_master_seed_authority.ts` — the
  one real `FedosMasterSeedAuthority` implementation, routes every
  method through `attemptDevOnlyMasterSeed*Call()` — gated to
  Development Runtime only by naming convention and, transitively, to
  the same unbuilt WASM artifact above (BLOCK-3 from the prior review,
  confirmed still present, unaddressed by anything in Alpha 761–850).
- `src/vault/types.ts` — `VaultBoundary`, still shapes-only, "NO key
  generation, NO key derivation, NO seed storage... here."

**Conclusion: every encryption-readiness axis this review needs
(`08_encryption_gate.md`) resolves to "unavailable" today, for every
implementation this checked-out tree actually ships** — not because
the underlying cryptography is fake (`packages/fedos-core-rust` is
real and vector-tested, per the prior Security review's own §01, which
this review does not re-derive), but because no TypeScript-reachable
path connects a Conversation construction call to it.

## Identity — REAL registry/service; no default resolvable "creator" identity for Board Runtime callers

- `src/identity/fedos_identity_service.ts`, `fedos_identity_record.ts`,
  `fedos_identity_registry.ts` — real, but purely a
  register/hold/describe layer with "no Registry LOOKUP" (the
  Service's own header). No "current identity" accessor exists here.
- `src/board/runtime/identity/fedos_public_author_authority.ts` /
  `fedos_desktop_public_author_authority.ts` — `FedosPublicAuthorAuthority.resolvePublicAuthor()`
  is the actual mechanism `FedosBoardRuntime` uses to learn "who is
  posting," and its own test-confirmed behavior
  (`test/reviews/conversation_foundation_v1/source_alignment.test.ts`
  item 8) is "ALWAYS falls back" to `"anonymous-local"` when no real
  identity source is configured — the default in this checked-out
  tree, unchanged since the prior review.

## Runtime ownership — no dedicated Conversation Application boundary exists

- `src/board/runtime/fedos_board_runtime.ts` — `FedosBoardRuntime` is
  the ONLY class in `src/` that constructs a `FedosConversationRecord`
  today, and it does so as a narrow side effect
  (`#recordConversationForRootPost()`, a PRIVATE method) of
  `createPublicThread()` — public-Board-post creation, not a dedicated
  "create a Conversation" command. There is no `FedosConversationRuntime`,
  no Conversation Application service, and no command type for
  constructing a `private-group`/`direct` Conversation anywhere in
  `src/`.
- `src/desktop/host/fedos_desktop_host.ts` — `FedosDesktopHost` owns
  process lifecycle (`start()`/`stop()`), Board hydration, and Query
  construction. It holds no reference to Membership, Capability,
  Retention, or Payload Storage — none of Alpha 761–850's domains are
  wired into Host startup/shutdown at all today.

## Summary table

| Prerequisite | Real code exists | Wired into construction | Gated closed |
|---|---|---|---|
| Conversation id/record (public) | yes | yes (`FedosBoardRuntime`) | no |
| Conversation id/record (private-group/direct) | type-level only | no | **yes — validator rejects** |
| Conversation Policy (public) | yes | yes | no |
| Conversation Policy (private-group/direct) | type-level only | no | **yes — validator rejects** |
| Membership | yes, mode-agnostic | **no** | no (but orphaned without a record) |
| Capability | yes, mode-agnostic | **no** | no (but orphaned without a record) |
| Retention / Payload Storage | yes, mode-agnostic | **no** | no (but orphaned without a record) |
| Encryption authority | real primitives, no TS path | **no** | **yes, end-to-end** |
| Master Seed Authority | real, dev-only gated | **no** | **yes** |
| Creator identity resolution | yes (generic) | falls back to anonymous-local | effectively yes for real identity |
| Dedicated Conversation runtime/service | **no** | — | — |
