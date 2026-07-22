# Secure Runtime Alpha 5641–5720 — Reconciliation Report

**FedOS Signed Recipient Deletion Request Types, Validation, and Durable
State Foundation Arc — Phase A**

Written before any production edit in this Arc's own worktree
(`C:\wt\signed-deletion-request-foundation`, branch
`arc/signed-recipient-deletion-request-state-foundation`). No `src/`,
`packages/`, `package.json`, `package-lock.json`, `Cargo.toml`, `p2p/`, or
`.tmp_gen/` change is made by this document.

## 0. Base selection and Alpha range

**Selected base: `arc/local-deletion-capability-state-foundation @ b3b3a6d`**
(one commit ahead of `master @ 3eb9ead`) — the only commit in this
repository that carries both `src/conversation/deletion/` AND every real
Conversation/account-signing foundation `master` itself already carries.
`master`'s own tip is unchanged (`3eb9ead`) at this Arc's own start.

**Alpha range**: full-history scan of every `arc/`/`worktree-` branch's
own commit messages finds the highest genuinely-used range is
**5481–5560** ("Direct Double Ratchet Cryptographic Core," per this
Arc's own coordination note — confirmed present:
`arc/direct-double-ratchet-cryptographic-core`). The historical
**5401–5480 collision** between `be1bc0d` (Direct Ratchet State and
Sealed Persistence Foundation) and `b3b3a6d` (this Arc's own direct
dependency, Local Deletion Capability and Deletion-State Foundation) is
explicitly recorded here and not repaired — neither commit is rewritten.

Per this Arc's own coordination note, the parallel Ratchet Conversation
Runtime/NIP-17 Integration Arc receives the earliest free range
(**5561–5640**); this Arc receives the immediately following range,
**5641–5720**. No branch anywhere in this repository currently claims
either range (verified by the same full-history scan). If the Ratchet
Arc's own session ultimately claims a different range, this Arc's own
5641–5720 choice remains internally consistent regardless — Alpha labels
are documentation labels, not ancestry proof, restated per this Arc's own
instruction.

## 1. Request review decisions (`860a58e`, `review/fedos-signed-recipient-deletion-request-v1`)

Read via `git show 860a58e:docs/reviews/fedos_signed_recipient_deletion_request_v1/*.md`.
Every decision below is this Arc's OWN binding floor, not re-litigated:

- **Target**: exactly one Direct-conversation message per request (Doc 03).
- **Scope**: `requestedOperation` fixed to `"logical-delete"` in V1 (Doc 07) — this Arc's own `FedosDeletionRequestScope` narrows this further into `local-history`/`local-history-and-index`, matching `b3b3a6d`'s own two-step payload-deletion plan exactly (§5 below).
- **Authorization**: original sender only (Doc 04).
- **Device scope**: one account-level request; `requesterDeviceRef`/`recipientDeviceRef` are OPAQUE, advisory labels — no real per-Device signing key exists (Doc 05/08).
- **Request identity**: client-generated 256-bit random `requestId`, fixed for a logical request's lifetime (Doc 06).
- **Signature**: account-level, via the existing real `FedosNostrSigningAuthority` (Doc 08).
- **Transport**: inside the existing private route — explicitly **NOT built by this Arc** (Doc 09; this Arc's own Absolute Prohibitions).
- **Expiry/retry defaults**: 14-day max lifetime, 8 max attempts, 1h–24h exponential backoff, ±5min clock skew, 32/512 pending-request caps (Doc 10) — PROPOSED by the review, adopted verbatim here.
- **Recipient policy**: fourteen-phase pipeline, target-existence-oracle avoidance via a combined authorization+resolution check (Doc 11).
- **Acknowledgement**: closed outcome vocabulary normalized against `b3b3a6d` (Doc 12).
- **Archive/backup**: never touched; wire schema structurally cannot express it (Doc 15).
- **Group/attachment**: excluded entirely from V1 (Docs 14/16).
- **First implementation Arc scope** (Doc 19, this Arc): "closed schemas/codecs, canonical signed-bytes definition, real signature verification function, `requestId`-keyed append-only durable request/acknowledgement persistence — no live Relay delivery, no live Wire Adapter/Outbox integration, no live recipient-policy bridge to a production entry point." This Arc's own Mission restates this identically.

## 2. Local deletion foundation (`b3b3a6d`)

Present in THIS worktree's own checkout (not merely inspected via
`git show`), since this Arc branches directly from it: full
`src/conversation/deletion/` module — `FedosDeletionTarget`/`Operation`/
`Evidence`/`Status` vocabularies, `FedosDeletionCapabilityDescriptor`,
read-only assessment, pure plan builders, the four-entry-point execution
coordinator, `FedosPersistedDeletionExecutionRecordV1` + in-memory/
append-only persistence, Archive-file authority, non-guarantees, and the
user-safe summary DTO. This Arc's own recipient-evaluation state (Phase
J) and acknowledgement outcome vocabulary (Phase K) are normalized
against these REAL types directly — imported, never re-declared.

## 3. Account signing authority — real, and its real limits

`FedosNostrSigningAuthority` (`src/nostr/sign/fedos_nostr_signing_authority.ts`,
Alpha 442/445): `signEvent(request: FedosNostrUnsignedEventRequest):
Promise<FedosNostrWireEvent | null>`, `kind` fixed to `1`,
`accountIndex`/`createdAt`/`tags`/`content` only, structurally validated
by `isWellFormedFedosNostrUnsignedEventRequest`. The ONE real
implementation, `FedosWasmNostrSigningAuthority`, requires a live Master
Seed and the compiled WASM artifact — **absent in this worktree** (no
`pkg/`, confirmed, matching this worktree's own established environmental
gap). `publicIdentityForAccount(accountIndex)` derives a public key
WITHOUT signing.

**Real, independent, pure-TypeScript verification already exists** and
needs NO WASM: `verifyNostrEventId` + `verifyNostrEventSignature`
(`src/desktop/nostr_event_id_verifier.ts` / `nostr_signature_verifier.ts`,
Alpha 243/244) — the SECOND recompute the NIP-01 canonical pre-image
(`[0,pubkey,created_at,kind,tags,content]`, six-character escape rule)
and check a BIP-340 Schnorr signature via `@noble/curves/secp256k1.js`'s
`schnorr.verify` (an already-declared dependency, zero new one).
`validateInboundNostrEvent` (`combined_inbound_event_validator.ts`)
composes both. **This Arc reuses these three functions verbatim for its
own real signature verification** — no reimplementation.

**No real per-Device signing key exists anywhere in this codebase**
(confirmed independently here, matching Doc 08's own finding):
`FedosSyncDeviceBinding` carries no key material. This Arc represents
`requesterDeviceRef`/`recipientDeviceRef` as opaque, non-cryptographically-bound
labels — never a fabricated signature.

**Test-authority isolation** (Phase F's own requirement): since the real
`FedosWasmNostrSigningAuthority` needs an absent WASM artifact, this
Arc's own tests use a dedicated, pure-TypeScript `FedosNostrSigningAuthority`-conforming
test double built directly on `@noble/curves`' `schnorr.sign`/
`schnorr.getPublicKey` (the SAME primitive `NobleSignatureVerifier`/
`verifyNostrEventSignature` already use for verification, an
already-declared dependency — not a new crypto primitive). It
independently reimplements the SAME six-character NIP-01 canonical
pre-image/id computation `verifyNostrEventId`'s own module-private
`serializeNostrEventCanonical` uses — this is this codebase's OWN
established precedent (Alpha 243's own header explicitly notes it
deliberately duplicates this exact tiny, closed, stable algorithm rather
than share code across boundaries); this Arc's own test authority
produces **genuinely real, independently-verifiable Schnorr signatures**,
not a mocked pass-through — `validateInboundNostrEvent` (real,
production code) accepts its output without any special-casing.

## 4. Conversation / Membership identity — real

`FedosConversationMessageEnvelope` (`senderMembershipId`, `payloadId`,
`conversationId`) + `FedosConversationMembershipAuthority`
(`findMembership`/`admit`/`revoke`, `FedosConversationParticipantReference`
= `{ authority, publicIdentifier, identityId }`) are the real source of
truth this Arc's own authorization assessment (Phase H) resolves a
request's own claimed `requesterAccountRef`/target authorship against —
reused verbatim, never re-implemented.

## 5. Durable replay / Outbox / codec / clock precedents — all real

- **Append-only, corruption-fails-closed persistence**: `b3b3a6d`'s own
  `AppendOnlyFedosDeletionExecutionPersistence` (mirrors
  `AppendOnlyFedosPayloadRetentionPersistence` itself) is the exact
  precedent this Arc's own three new persistence domains (Phase I/J/K)
  mirror: one independent NDJSON log per domain, insert-only, a
  conflicting duplicate for the same key throws on read, no
  compaction/delete/rewrite.
- **Idempotency-first execution**: `b3b3a6d`'s own
  `persistence.getRecord(planId)`-first discipline in
  `fedos_deletion_execution_coordinator.ts` is the precedent this Arc's
  own request-processing entry points mirror.
- **Strict, closed, unknown-field-rejecting codecs**:
  `validateFedosConversationMessageEnvelope`,
  `isWellFormedFedosNostrUnsignedEventRequest` (exact property-count
  check, `keys.length !== N` rejection) — this Arc's own request/
  acknowledgement validators use the identical discipline.
- **Caller-supplied clock**: `clock?: () => number` (Unix seconds)
  throughout `b3b3a6d` and Retention — reused identically; no
  `Date.now()` call inside any pure function this Arc adds.
- **Outbox/retry precedent**: `src/board/outbox/`
  (`FedosPublishScheduler`, `createFedosMaxAttemptsAbandonmentPolicy`) —
  no built-in default retry count exists anywhere in this codebase; the
  review's own Doc 10 defaults (adopted in §1 above) are this Arc's own
  concrete numbers, not a reused constant.

## 6. Current absence of a wire protocol — reconfirmed

No file anywhere in `src/` (this worktree, branched from `b3b3a6d`)
matches `DeletionRequest` (re-run of the review's own source-alignment
check, `git grep -l -i DeletionRequest -- src` → no match before this
Arc's own production edits). `FedosPrivateTransport`
(`src/conversation/transport/`) is untouched by this Arc — this Arc adds
no import from it, no reference to it, no dependency on it (Phase N).

## 7. What this confirms about scope

Every real dependency this Arc needs — Conversation/Membership identity,
account signing (production interface) + real pure-TS verification, the
full `b3b3a6d` local deletion vocabulary/execution surface, and the
append-only persistence convention — already exists on this Arc's own
selected base. The ONLY genuinely new work is the protocol/state domain
itself (Phases B–M): closed vocabularies, the request/acknowledgement
record shapes, canonical serialization, the request-id scheme, three new
durable persistence domains, a pure expiry/retry planner, and safe
status/aggregation DTOs — never a wire, never a Relay, never an automatic
local deletion trigger.
