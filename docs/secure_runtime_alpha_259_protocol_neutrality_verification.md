# Secure Runtime Alpha 259 — Protocol Neutrality and Bridge Verification

**Status: this Stage VERIFIES. It adds NO new `src/board/` production
file — it fixes the mapping policy for each of the four entry paths and
is backed by fixture tests (`test/secure_runtime_alpha_259_protocol_neutrality_verification.test.ts`)
that construct a `FedosBoardPost` from each, through the SAME
`validateFedosBoardPost` (Alpha 257), with no real network call.** Stage
9 of the Alpha 251–260 Canonical Board Model Foundation Arc.

## 1. Why now

Alpha 252–258 built the Canonical Board Model in isolation. This Stage
confirms — by actually constructing a fixture for each protocol, not by
assertion alone — that the model can honestly represent all four target
entry paths without any protocol-specific field or assumption leaking
in.

## 2. Method

For each protocol, a fixture object shaped like that protocol's own
native representation is mapped BY HAND, inside the test file only (this
is exactly the mapping step a future, out-of-scope Protocol Adapter would
perform), into a `FedosBoardPostInput` (Alpha 257), then passed to
`validateFedosBoardPost`. No adapter module is added to `src/board/` or
anywhere else — the mapping logic lives ONLY in the test file, confirming
feasibility without building the adapter this Arc explicitly excludes.

## 3. Nostr

- `source.reference` = the Nostr event id (hex), matching
  `FedosValidatedNostrEvent.id` (Alpha 242).
- `author.publicIdentifier` = the event's `pubkey` (hex), matching
  `FedosValidatedNostrEvent.pubkey`.
- `threadId`/`replyTo` = derived from NIP-10 `e`-tag root/reply markers —
  the SAME resolution rule `getRootTarget`/`getReplyTarget`
  (`src/thread/thread.ts`, Stage 2, unmodified) already implement; the
  fixture test performs the equivalent extraction inline rather than
  importing that Nostr-specific module, keeping `src/board/` free of any
  `src/thread/` or `src/nostr/` dependency.
- **Tags translated by adapter, never embedded** — confirmed: the fixture
  test's mapped `FedosBoardPostInput` carries no `tags` field at all
  (the type has none); only the two extracted values (`threadId`,
  `replyTo`) cross into the Canonical Board Model, never the raw tag
  array.
- Fixture used: a REPLY (`kind: 1`, one `root`-marked and one
  `reply`-marked `e` tag) — demonstrating the non-root path.

## 4. ActivityPub

- `source.reference` = the ActivityPub object's own URI (its `id`
  field in AS2 terms).
- `author.publicIdentifier` = the Actor URI (`attributedTo`).
- **`Create(Note)` wrapper not embedded** — confirmed: the fixture test
  maps directly from the inner `Note`-shaped object's own fields
  (`content`, `published`, `inReplyTo`) into `FedosBoardPostInput`; no
  `Activity`/`Create` envelope field of any kind appears on the mapped
  input or on the resulting `FedosBoardPost`.
- Fixture used: a ROOT post (`inReplyTo` absent) — demonstrating the
  root path; by convention (Alpha 256 §1) the mapping sets `threadId`
  equal to `id` (both derived from the same object URI).

## 5. AT Protocol

- **AT-URI/CID policy, explicitly decided:** `source.reference` =
  the record's AT URI (`at://did:.../collection/rkey`) ONLY. The
  record's CID (a content hash, used by AT Protocol for integrity/
  versioning) is deliberately NOT carried onto `FedosBoardSourceReference`
  this Arc — that type has exactly one `reference` string field (Alpha
  253 §4: "no generic metadata bag"), and the AT URI alone already
  uniquely and resolvably names the record within this Arc's scope. A
  future Stage MAY add a dedicated CID field to a future, versioned
  provenance type if content-addressed integrity verification becomes a
  real requirement — this Arc does not need it and does not speculate
  one in.
- `author.publicIdentifier` = the author's DID.
- `threadId`/`replyTo` = the record's own `reply.root.uri`/
  `reply.parent.uri` (AT Protocol's native reply-threading shape already
  separates root from direct parent, mapping onto Alpha 256's "Option C"
  model with no impedance mismatch).
- **Record object not embedded** — confirmed: only `text`/`createdAt`/
  `reply.{root,parent}.uri`/`author.did` cross into
  `FedosBoardPostInput`; no raw AT Protocol record, no `$type` field, no
  CID.
- Fixture used: a REPLY (`reply.root`/`reply.parent` both present) —
  demonstrating that AT Protocol's native root+parent shape maps
  directly onto `threadId`+`replyTo`.

## 6. Session

- **Only explicitly gateway-published board messages** — the fixture
  represents a message a Session gateway has ALREADY published to a
  public board context (a `gatewayMessageId` the gateway itself assigns);
  nothing about this fixture, this Stage, or `src/board/` reads, imports,
  or references any private, E2EE one-to-one or group conversation
  content. **Private Session DM/conversation content must never be
  imported automatically** — confirmed by construction: no
  `src/board/` file imports anything from a Session-DM-shaped source, and
  no fixture in this Stage's test represents one.
- `author.publicIdentifier` = the Session ID, where appropriate (the
  gateway-published fixture carries one; a fully anonymous
  gateway-relayed message with no attributable Session ID is not modeled
  this Arc — `publicIdentifier` remains a required field, so such a
  message could not be mapped until a future Stage decides how to
  represent "anonymous, gateway-attested only").
- `source.reference` = the gateway's own message reference
  (`gatewayMessageId`).
- Fixture used: a ROOT post — demonstrating the root path a fourth,
  structurally different transport (no cryptographic event, no AS2
  object, no AT URI — a bare gateway-assigned reference).

## 7. Fixture tests — no real network call

Confirmed: `test/secure_runtime_alpha_259_protocol_neutrality_verification.test.ts`
contains zero `fetch`, zero WebSocket construction, and zero import of
`src/nostr/ws_relay.ts`/`src/desktop/websocket_relay.ts`/any other
transport module — every fixture is a plain object literal defined
inline in the test file.

## 8. Conclusion — protocol-neutrality confirmed

All four target entry paths this Arc names map onto the SAME eight-field
`FedosBoardPost` (Alpha 255) through the SAME `validateFedosBoardPost`
(Alpha 257), with no protocol-specific field added to the Canonical Board
Model to accommodate any one of them. Two used the root path, two used
the reply path (§3–6); together they exercise every branch of Alpha
256's own root/reply semantics using genuinely different source shapes.

## 9. See also

- `docs/secure_runtime_alpha_253_board_source_provenance.md`
- `docs/secure_runtime_alpha_256_thread_reply_semantics.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
- `docs/threads_adapter_planning.md`
