# Secure Runtime Alpha 2501–2580: Conversation Search Runtime — Execution Spec

Architecture frozen. This Arc adds no new Rust/WASM primitive, no new `AeadAadDomain` variant, no new persistence port, no Host/GUI wiring, no network transport. It is a pure TypeScript, in-memory, derived indexing layer over already-existing conversation domains.

## Scope

**Reuse** (consumed as-is, unmodified):
- Conversation Runtime (`src/conversation/runtime/`, Alpha 921–930) — `FedosConversationRuntimeDependencies`'s own `draftPersistence`/`membershipAuthority` pair. `FedosConversationSearchIndexDependencies` is declared as a literal `Pick<FedosConversationRuntimeDependencies, "draftPersistence" | "membershipAuthority">`, so a caller already holding a runtime dependency set (e.g. from `assembleFedosConversationRuntimeDependencies()`) passes it straight through.
- Archive (`src/conversation/archive/`, Alpha 1541–1610) — `FedosConversationArchiveBundleV1` plus its own established "deserialize via the record's own existing codec, never re-implement validation" idiom, reused verbatim by the archive index.
- Envelope (`src/conversation/envelope/`, Alpha 854/858) — `FedosConversationMessageEnvelope` is the direct source of every field a search document carries except `text`.
- Membership (`src/conversation/membership/`, Alpha 762–790) — `FedosConversationMembershipAuthority.listMemberships()` resolves a `senderMembershipId` back to a participant.
- Draft records (`src/conversation/construction/`, Alpha 894) — `FedosConversationDraftPersistence.getDraft()` classifies a conversation id's `FedosPrivateConversationMode`.

**Implement** (new, under `src/conversation/search/`):
- Search Index (`fedos_conversation_search_index.ts`) — top-level facade composing every sub-index below.
- Incremental Index (`fedos_conversation_search_incremental_index.ts`) — the dedup/progress guard.
- Archive Index (`fedos_conversation_search_archive_index.ts`) — Archive-sourced conversation tracking + Bundle→document conversion.
- Mode Index (`fedos_conversation_search_mode_index.ts`) — satisfies both "group index" and "direct index" (see decision 2 below).
- Reply Index (`fedos_conversation_search_reply_index.ts`).
- Date Index (`fedos_conversation_search_date_index.ts`).
- Participant Index (`fedos_conversation_search_participant_index.ts`).
- Keyword Index (`fedos_conversation_search_keyword_index.ts`).

Plus one supporting type-only file not separately named in the instruction but required by every sub-index above: the indexable unit itself (`fedos_conversation_search_document.ts`).

## Key design decisions

1. **The keyword index's plaintext boundary.** No component in this codebase today produces decrypted message plaintext end-to-end: Payload Storage bytes are deliberately opaque (`application/octet-stream` only, Alpha 803), and the Encryption/Decryption Authorities (Alpha 861/862) still require a caller-already-resolved `localAccountIndex`/`counterpartyPublicKeyHex` — real identity-resolution wiring this Arc is not chartered to build. `FedosConversationSearchEnvelopeDocument.text` is therefore `string | null`, ALREADY-DECRYPTED text SUPPLIED BY THE CALLER — the exact same "ALREADY RESOLVED by the caller" idiom `FedosConversationEncryptionRequest`/`FedosConversationDecryptionRequest` already use. This module never calls a Decryption Authority and never touches ciphertext or payload bytes. `text: null` indexes nothing for that document; never an error.

2. **"Group index" + "direct index" share one Mode Index, not two structures.** `direct`/`private-group` are two values of one closed `FedosPrivateConversationMode` enum. Building two independently-maintained maps for one classification would be exactly the redundant index `FedosConversationReader`'s own Alpha 753 "Conversation Repository / Index Decision" already rejected ("nothing a second in-memory index would compute that a direct lookup does not already give for free"). One `conversationId → mode` map backs both `directConversationIds()` and `groupConversationIds()`, independently tested.

3. **No new persistence.** `FedosConversationSearchIndex` and every sub-index are pure, rebuildable, in-memory structures over already-durable data (Envelope, Membership, Draft, Archive) — no new log, port, or file. This mirrors `FedosBoardService`'s own hydration-time index-rebuild precedent: after a restart, a freshly constructed instance fed the identical source data reproduces identical query results.

4. **Incremental + idempotent by construction.** Every ingestion path (`indexEnvelope`/`indexEnvelopes`/`indexArchiveBundle`) is driven through one shared `FedosConversationSearchIncrementalIndex` dedup guard — indexing the same Envelope id twice, whether directly or via an Archive Bundle, is a documented `"duplicate"`, never a double-counted keyword hit or bucket entry.

5. **Delete has no cascade.** `removeEnvelope()` purges an id from every content/metadata sub-index and reopens it in the Incremental guard (so a later legitimate re-index is not mistaken for a duplicate) — but does NOT cascade to children in the Reply Index, mirroring this codebase's own established "no cascading delete" discipline on every append-only-backed port (Board/Envelope/Payload/Membership all accept no delete method at all).

6. **Participant resolution is memoized.** `FedosConversationMembershipAuthority` exposes no direct "get membership by id" method — only `listMemberships(conversationId)`. The Participant Index memoizes the resolved participant per `senderMembershipId` (safe across conversations, since a membership id is itself deterministic — Alpha 767) so indexing at scale (this Arc's own "large dataset" verification) does not re-scan a conversation's membership list once per Envelope.

## Deliberately out of scope (named, not silently dropped)

- Real decryption of Payload bytes into `text` — a future Decryption-Authority-wiring Arc's job (see decision 1).
- Any Host/file-path/GUI wiring for a search UI, search-as-you-type debouncing, ranking/relevance scoring beyond AND-semantics token matching, stemming, or stop-word handling.
- A durable, persisted search index (a search-index log/cache file) — this Arc's index is derived and rebuildable only.
- Cross-conversation-boundary search authorization (deciding WHICH conversations a given local user is allowed to search) — this Arc indexes whatever it is handed; access control over what gets handed to it is a caller/Runtime-wiring concern, not this module's.
