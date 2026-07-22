# Secure Runtime Alpha 5641–5720 — Completion Declaration

**FedOS Signed Recipient Deletion Request Types, Validation, and Durable
State Foundation Arc**

## Declared: full completion

- [x] Strict request and acknowledgement types —
      `isWellFormedFedosDeletionRequestRecordV1`/
      `isWellFormedFedosDeletionAcknowledgementRecordV1`, exact
      property-count checks, unknown fields fail closed, bounded
      identifier lengths, no raw path, no plaintext, no secret.
- [x] Canonical signing bytes — fixed-field-order string construction,
      never `JSON.stringify` on the whole object; test vectors and a
      one-byte-mutation-changes-the-string test both pass.
- [x] Real signature verification — `verifyFedosSignedDeletionRequestV1`/
      `verifyFedosSignedDeletionAcknowledgementV1` compose the EXISTING,
      real, pure-TypeScript `validateInboundNostrEvent` chain plus a
      content-binding check; exercised against GENUINE BIP-340
      signatures produced by `FedosNobleTestNostrSigningAuthority`
      (real `@noble/curves` crypto, no WASM needed, no stub).
- [x] Authorship/recipient authorization assessment — real Conversation/
      Membership/Envelope resolution, target-existence-oracle prevention
      via a combined lookup, Device mismatch honestly advisory-only.
- [x] Durable request/recipient/acknowledgement state — three
      independent domains, both in-memory and real append-only NDJSON
      backends, monotonic-transition enforcement shared between backends
      via one function each.
- [x] Restart/idempotency/corruption behavior — verified against the
      REAL append-only backend: fresh instance over the same log file
      converges identically; matching duplicate is a no-op; conflicting
      duplicate and invalid transitions are rejected; a corrupt or
      truncated log line throws on the next read.
- [x] No live transport — zero import of `FedosPrivateTransport`, no
      Relay/NIP-17/new-Nostr-kind reference anywhere in this Arc's own
      module (verified structurally, comment-stripped source scan).
- [x] No automatic deletion — zero import of `b3b3a6d`'s own execution
      coordinator or Archive-file authority anywhere in this Arc's own
      module; the ONLY way a `"policy-pending"` request advances further
      is a caller explicitly supplying an already-produced outcome.
- [x] No remote-erasure claim — the acknowledgement vocabulary has no
      "physical erasure" evidence level and no "account-wide"/
      "deleted-everywhere" outcome value; `isFedosDeletionAcknowledgementRecordHonest`
      structurally prevents an applied-outcome overclaim.

## Local-only, non-live-delivery V1 — explicit scope statement

This Arc implements the **protocol/state foundation only**. The
following remain deliberately unbuilt, exactly as instructed:

- No wire event, no Relay publication, no subscription.
- No `sendDirectMessage`/Conversation-delivery-hook change.
- No recipient deletion execution triggered by request receipt — a
  request reaches `"policy-pending"` and stops; only an external caller
  supplying an already-produced `b3b3a6d` outcome can record
  `"locally-applied"`/`"partially-applied"`/`"failed"`.
- No acknowledgement transmission of any kind.
- No Group or attachment support — neither has a field in either closed
  schema.
- No physical-erasure guarantee, no account-wide claim from one Device's
  acknowledgement.

## Verification run (this worktree, `C:\wt\signed-deletion-request-foundation`)

1. `npm run typecheck` — clean except one PRE-EXISTING, unrelated
   failure (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`,
   untouched by this Arc).
2. This Arc's own 9 new test files: **132/132 passed**, including a
   comprehensive Phase O vertical slice (real Conversation, real
   Alice/Bob accounts, real signing, real restart across all three
   durable domains, real `b3b3a6d` execution, real acknowledgement
   correlation, real duplicate/conflict rejection, real durable-file
   plaintext/key/path absence check).
3. `b3b3a6d`'s own Local Deletion Foundation test suite (7 files, 82
   tests): **82/82 passed**, unchanged.
4. Membership (`secure_runtime_alpha_764_768/769_771/825_832`),
   Retention (`secure_runtime_alpha_795/796/799`), and account-signing/
   verification (`secure_runtime_alpha_442/445/684/245`) regression
   suites: **all passed**, zero regression.
5. `npm test` (full suite): 195 files fail, **none a regression this Arc
   caused** — the same three pre-existing categories the prior Arc
   (`b3b3a6d`) already documented: Rust/WASM/Cargo-dependency-count
   tests failing on this worktree's own absent `pkg/`/root `Cargo.toml`;
   `test/reviews/**` boundary self-checks that shell out to `git status`
   and spuriously fail while this Arc's own legitimate `src/` changes
   sit uncommitted (resolved the moment this commit lands); and a small
   number of CRLF/LF line-ending artifacts in hand-written regex checks
   against files this Arc never touched (`fedos_board_persistence`-family
   files, confirmed by direct inspection). None of Membership, Retention,
   Envelope, account-signing, or this Arc's own `deletion_request/` files
   appear anywhere in the failure list.
6. No file under `p2p/` or `.tmp_gen/` was read, written, or referenced.

## Files changed

Thirty new files under `src/conversation/deletion_request/`; nine new
test files (132 tests); three new docs (this one, the execution spec,
and the schema document); no other `src/`/`packages/`/`package.json`/
`package-lock.json`/`Cargo.toml` change.

## Next Arc

**FedOS Signed Recipient Deletion Request Private Transport and Local
Policy Integration Arc** — carries this Arc's own request/acknowledgement
canonical bytes inside a real `FedosConversationMessageEnvelope` over the
real `FedosPrivateTransport` (review Doc 09's own chosen boundary — no
NIP-17, no new Relay event), wires `evaluateFedosDeletionRequestForRecipient`
to a real inbound handler, and — as its own separate, explicit,
non-bypassable local-policy decision point (Phase G step 9, `"policy-pending"` →
a REAL decision) — connects `markFedosDeletionRecipientLocalPlanReady`/
`recordSuppliedFedosDeletionRecipientLocalOutcome` to `b3b3a6d`'s own real
plan/execute pipeline for the first time.
