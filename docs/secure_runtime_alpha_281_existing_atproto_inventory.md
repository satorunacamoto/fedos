# Secure Runtime Alpha 281 — Existing AT Protocol / Bluesky Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 281–290 AT
Protocol Canonical Board Adapter Arc. It inspects the actual repository
before any implementation, exactly as Alpha 251 did for the Canonical
Board Model, Alpha 261 did for the Nostr Adapter, and Alpha 271 did for
the ActivityPub Adapter.

## 1. Why now

Alpha 280 closed the ActivityPub Canonical Board Adapter Arc and
recommended exactly this Arc next: "Nostr and ActivityPub now provide
two structurally different verified inputs that map into the same
Canonical Board Model, proving the adapter architecture before adding
Bluesky." This Stage inspects the repository before that third adapter
is built.

## 2. Inventory method

Direct inspection of `src/`, `docs/`, and `package.json` — no code
executed, no file modified. Searched for `atproto`, `AT Protocol`,
`Bluesky`, `bsky`, `did:plc`, `did:web`, `XRPC`, `Lexicon`,
`reply.root`/`reply.parent`, and `CID`, plus every directory/file name
containing `atproto` or `bluesky`.

## 3. Findings, answering all twelve required questions

### 3.1 Whether any AT Protocol code exists

**No TypeScript AT Protocol code exists.** `src/atproto/` and
`src/bluesky/` do not exist. No file anywhere in `src/` matches
`*atproto*`/`*bluesky*`/`*bsky*`/`*xrpc*`/`*lexicon*` by name, and a
full-text search across `src/` for `XRPC`/`Lexicon`/`reply.root`/
`reply.parent` returns zero matches.

**One UNRELATED-LAYER mention exists, reviewed and confirmed
irrelevant:** `packages/fedos-core-rust/src/lib.rs` (Rust) already
reserves a domain-separated key-DERIVATION root named `"ATProto"`
(`derive_atproto_root_internal`, Secure Runtime Alpha 153 — see
`docs/secure_runtime_alpha_153_session_atproto_wallet_root.md`) —
alongside sibling `Nostr`/`Session`/`Wallet` roots. This is
CRYPTOGRAPHIC KEY MATERIAL scoping for a not-yet-built future AT
Protocol identity, entirely at the Rust/key-derivation layer — it
contains no DID validation, no AT URI parsing, no CID handling, and no
board-post concept of any kind. It is a different layer from this Arc's
own concern (`src/board/`, pure TypeScript, no crypto) and this Arc's
own Absolute Prohibitions forbid "Rust changes"/"Cargo.toml changes"
regardless — confirmed not touched, not imported, not referenced by
anything this Stage or any later Stage of this Arc adds.

### 3.2 Whether DID validation exists

**No.** No DID-shape validation (`did:plc:...`/`did:web:...` or
otherwise), no DID Document parsing, and no DID resolution code exists
anywhere in `src/`. The Rust-side `"ATProto"` key-derivation domain
(§3.1) does not validate or even represent a DID string — it derives
key material under a fixed HKDF domain label, unrelated to identity
STRING validation.

### 3.3 Whether AT URI parsing exists

**No.** No `at://` URI parser, no `did`/`collection`/`rkey` path
extraction, and no AT-URI-shaped regex exists anywhere in `src/`.

### 3.4 Whether CID handling exists

**No.** No CID (Content Identifier) parsing, encoding, or validation
code exists anywhere in `src/`. No CID-capable dependency (`multiformats`,
`cids`, or equivalent) is present in `package.json` — its two
dependencies remain `@noble/curves` and `@noble/hashes`, both
Nostr-oriented elliptic-curve/hash primitives, unrelated to
content-addressing.

### 3.5 Whether `app.bsky.feed.post` is modeled

**No.** No Lexicon-shaped record type of any kind — for
`app.bsky.feed.post` or any other collection — exists anywhere in
`src/`.

### 3.6 Whether `reply.root`/`reply.parent` is modeled

**No.** No reply-shaped structure (strong reference pair: URI + CID) of
any kind exists anywhere in `src/`. The prior Arc's own fixture work
(Alpha 259, Canonical Board Model Foundation Arc) DID already
demonstrate — in a TEST file only, never production code — that AT
Protocol's native `reply.root`/`reply.parent` two-field shape maps
cleanly onto the Canonical Board Model's `threadId`/`replyTo` (Alpha 256
"Option C"); that fixture is not reused as code here, only as confirming
precedent that the shape fits (Alpha 286 revisits this mapping formally).

### 3.7 Whether rich-text facets are modeled

**No.** No facet type (mention/link/tag byte-range annotations) exists
anywhere in `src/`.

### 3.8 Whether embeds are modeled

**No.** No embed type (image, external link, record, or record-with-media)
exists anywhere in `src/`.

### 3.9 Whether a normalized validated post model already exists

**No.** Nothing resembling `FedosValidatedAtprotoPost` exists before
this Stage. The two closest structurally-similar precedents are BOTH
different protocols' validated-value types —
`FedosValidatedNostrEvent` (`src/desktop/fedos_validated_nostr_event.ts`,
Alpha 242) and `FedosValidatedActivityPubPost`
(`src/board/activitypub/fedos_validated_activitypub_post.ts`, Alpha
272) — reviewed here only as the naming/construction-discipline pattern
to mirror (Alpha 282 does mirror it), not as reusable AT Protocol code.

### 3.10 Whether any network access would be required

**Yes — but entirely OUTSIDE this Arc's own scope.** A real AT Protocol
integration would eventually need: an XRPC client, DID resolution
(PLC directory or `did:web` HTTPS lookup), repository/CAR fetching or a
Jetstream/firehose subscription, and CID verification against fetched
record bytes. This Arc's own "Important Scope Decision" places ALL of
that above the line this Arc implements: "The Board Adapter must not
consume raw XRPC responses, CAR files, repository blocks, firehose
frames, or arbitrary lexicon records." Zero network code is added by
this Arc (confirmed structurally in Alpha 287/290).

### 3.11 Which code is reusable

- **The two-step Adapter pattern** (`map<Protocol>PostToBoardPostInput`
  + `validate<Protocol>BoardPost`) established by
  `fedos_board_nostr_adapter.ts` (Alpha 266) and confirmed to generalize
  by `fedos_activitypub_board_adapter.ts` (Alpha 277) — reused as the
  STRUCTURAL PATTERN, not as code.
- **`validateFedosBoardPost`** (`src/board/fedos_board_post_validator.ts`,
  Alpha 257) — reused DIRECTLY, unmodified, exactly as both existing
  adapters already do.
- **`FedosBoardSourceProtocol`'s own `"atproto"` value** (`src/board/fedos_board_source.ts`,
  Alpha 253) — already reserved in the CLOSED five-value union since the
  Canonical Board Model Arc; this Stage confirms it needs no change.
- **The Descriptor/validated-value construction discipline** — reused as
  a NAMING pattern for `FedosValidatedAtprotoPost` (Alpha 282):
  "validated upstream by convention and module placement," not
  runtime-branded, matching both `FedosValidatedNostrEvent` and
  `FedosValidatedActivityPubPost`.

### 3.12 Which code must not be reused

The Rust-side `"ATProto"` key-derivation root (§3.1) MUST NOT be
referenced, imported, or touched by anything in this Arc — it is a
different layer (cryptographic key material, not board-post modeling),
this Arc's own instruction forbids Rust/Cargo changes regardless, and
conflating "a domain label happens to be named ATProto" with "AT
Protocol post validation" would be a category error.

## 4. Conclusion

No existing honest abstraction is duplicated by this Arc — there is
nothing AT-Protocol-post-shaped to duplicate anywhere in `src/`. The
Nostr and ActivityPub Adapters (Alpha 261–280) supply the STRUCTURAL
pattern this Arc mirrors for a third time; the Canonical Board Model
(Alpha 251–260) supplies the fixed target shape; neither is redesigned.
New files are placed under `src/board/atproto/` (this Arc's own
required directory), never under `src/atproto/` or `src/bluesky/` — no
existing protocol-adapter directory this inventory found would justify
a different location, and Canonical Board semantics must not live under
a transport-named directory (this Arc's own instruction, verbatim,
matching Alpha 271's identical rule for ActivityPub).

## 5. See also

- `docs/secure_runtime_alpha_280_activitypub_board_adapter_completion.md`
- `docs/secure_runtime_alpha_277_activitypub_board_adapter.md`
- `docs/secure_runtime_alpha_271_existing_activitypub_inventory.md`
- `docs/secure_runtime_alpha_266_nostr_board_adapter_implementation.md`
- `docs/secure_runtime_alpha_153_session_atproto_wallet_root.md`
- `docs/bluesky_adapter_planning.md`
