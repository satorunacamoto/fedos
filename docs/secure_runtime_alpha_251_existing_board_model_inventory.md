# Secure Runtime Alpha 251 — Existing Board Model Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 251–260
Canonical Board Model Foundation Arc. It inspects the actual repository
before any implementation and reports precisely what already exists, so
later Stages neither duplicate an existing honest abstraction nor
misjudge one as reusable when it is not.

## 1. Why now

Alpha 250 closed the Nostr Inbound Event Validation Arc and recommended
exactly this Arc next: "the next product-level requirement is to define
the board/thread/reply model before multiplying transport complexity
with a Relay Pool." This Stage is that recommendation's own starting
point.

## 2. Inventory method

Direct inspection of `src/`, `docs/`, and `test/` — no code executed, no
file modified. Every file named in this Stage's own instruction was read
in full.

## 3. Findings

### 3.1 Whether a canonical board model already exists

**No.** No file in this repository defines an immutable, protocol-neutral
board/thread/post model carrying real post content. `src/board/` does
not exist before this Stage.

### 3.2 What existing types are reusable

None of the existing types are reusable AS-IS for `FedosBoardPost`
(Alpha 255), because every one of them was deliberately built to carry
**no content/body field** (see §3.4 below) — but three existing
*conventions* are reused directly:

- **The Descriptor/validated-value split.** `FedosEventDescriptor`
  (`src/desktop/fedos_event_descriptor.ts`, Alpha 202) and
  `FedosValidatedNostrEvent` (`src/desktop/fedos_validated_nostr_event.ts`,
  Alpha 242) both establish "construction restricted to one module by
  convention, not by a type-system brand" — this Arc's own validator
  (Alpha 257) follows the identical discipline.
- **The `provider`-as-data convention.** `FedosIdentityDescriptor.provider`
  (`src/identity/fedos_identity_descriptor.ts`, Alpha 028) and
  `FedosEventDescriptor.provider` both carry protocol identity as a
  plain field, never as part of a type name — `FedosBoardSourceReference.protocol`
  (Alpha 253) follows the same rule, tightened to a fixed union instead
  of an unconstrained string (see Alpha 253's own doc for why).
  Note: `FedosBoardSourceProtocol`'s value set (`fedos` / `nostr` /
  `activitypub` / `atproto` / `session`) does NOT reuse
  `FederationProviderKind` (`src/federation/types.ts`) — that type's own
  values are `_placeholder`-suffixed labels for an unconnected provider
  boundary, a different concern (see §3.8 below).
- **The hide/mute/filter-never-delete moderation discipline.**
  `src/community/moderation.ts` (Stage 115) already fixed this rule at
  the community-policy layer; `FedosBoardModerationRecord`
  (`./fedos_board_moderation.ts`, Alpha 258) carries it forward at the
  Canonical Board Model layer.

### 3.3 What existing models are protocol-specific

- `src/nostr/types.ts`'s `NostrEvent` — the NIP-01 wire shape
  (`id`/`pubkey`/`created_at`/`kind`/`tags`/`content`/`sig`) — Nostr-only
  by design.
- `src/desktop/fedos_nostr_wire_event.ts`'s `FedosNostrWireEvent` and
  `src/desktop/fedos_validated_nostr_event.ts`'s
  `FedosValidatedNostrEvent` — both explicitly the SAME seven NIP-01
  field names, Nostr-only by design (their own doc comments say so).
- `src/thread/thread.ts` / `src/thread/types.ts` — `buildThreads` reads
  NIP-10 `e` tags and every `ThreadNode` embeds a raw `NostrEvent`
  directly; this module is Nostr-only and stays that way (it is NOT
  touched by this Arc — it remains the existing Nostr-specific thread
  builder, orthogonal to the new protocol-neutral Canonical Board Model).
- `src/query/thread_query.ts` / `src/query/types.ts` — operates on
  `ThreadBuildResult`/`ThreadNode`, i.e. transitively Nostr-only through
  `src/thread/types.ts`.
- `src/federation/nostr_mapping.ts` / the `NostrEventCandidate` shape in
  `src/federation/types.ts` — an OUTBOUND mapping candidate toward Nostr
  specifically, borrowing the Nostr tag shape by design.

### 3.4 Whether thread/reply relationships already exist

**Yes, but only inside the Nostr-specific thread builder**
(`src/thread/thread.ts`, §3.3), which resolves NIP-10 `e`-tag
root/reply markers into a `parentId`/`depth`/`children` tree over raw
`NostrEvent`s. This is real, working reply resolution — but it is
protocol-specific (reads Nostr tags directly) and holds no immutable,
storable post model; it operates on an in-memory event array supplied
fresh on every call. The Canonical Board Model's OWN thread/reply
semantics (Alpha 256) are new and independent of this file: `threadId`/
`replyTo` on `FedosBoardPost` are plain identifier fields a Protocol
Adapter would populate (a future Nostr adapter could reuse
`getReplyTarget`/`getRootTarget` internally, but that wiring is
explicitly out of scope for this Arc).

### 3.5 Whether moderation state already exists

**Only as a PURE POLICY DECISION FUNCTION, never as a stored record.**
`src/community/moderation.ts` (Stage 115) exports
`reviewCommunityModerationTarget`, which maps a requested
hide/mute/filter action to a `ModerationVisibilityDecision` — it holds
no state, persists nothing, and its own target type
(`CommunityModerationTargetInput`) carries only opaque `idRef`/
`targetRef` labels, never a real post. `src/federation/types.ts`'s
`ModerationAction`/`ModerationSignalInput` is the same kind of pure,
unsigned, non-persistent mapping-candidate shape, aimed at Nostr
specifically via `nostr_mapping.ts`. Neither is a moderation RECORD
attached to a real post id — `FedosBoardModerationRecord` (Alpha 258) is
the first such record type in this repository.

### 3.6 Whether attachments already have a safe reference type

**No.** No attachment/asset reference type exists that names a specific
post. `src/asset/types.ts` defines `AssetCache`-layer types (byte
storage/retrieval by content-addressed key), a different, lower-level
concern than "a post's attachment list" — and, per this Arc's own
instruction, attachments are explicitly out of scope this Arc regardless.

### 3.7 Whether timestamps use seconds, milliseconds, Date, or mixed formats

**Mixed, with one confirmed outlier.** The Alpha-numbered, currently
load-bearing surface is consistently **Unix seconds**:

- `NostrEvent.created_at` (`src/nostr/types.ts`) — "Unix timestamp in
  seconds" (own doc comment).
- `FedosEventDescriptor.createdAt` (`src/desktop/fedos_event_descriptor.ts`,
  Alpha 202) — explicitly named to mirror `created_at` field-for-field.
- `FedosValidatedNostrEvent.created_at` (Alpha 242) — the same NIP-01
  field, verbatim.

The one outlier is `src/social/event.ts`'s `SocialEventDescriptor.createdAt`
(Stage 110, a label-only descriptor — §3.8), whose own doc comment reads
**"Unix milliseconds"** — the opposite convention, on a field with the
identical name to every second-based one above. This Arc's own
`FedosBoardPost.createdAt` (Alpha 255) adopts **Unix seconds**, matching
the Alpha-numbered majority and the Nostr source data it will most often
be populated from; `FEDOS_BOARD_POST_MAX_CREATED_AT`
(`./fedos_board_post_validator.ts`, Alpha 257) is deliberately set low
enough (year 3000 in seconds) to reject a value accidentally supplied in
milliseconds, guarding against exactly this class of mismatch.

### 3.8 Whether any current model incorrectly combines transport and application semantics

**No currently-shipped model does — but only because the closest
candidates were deliberately built NOT to carry real content at all,**
which is itself why none is reusable for this Arc's purpose:

- `src/social/event.ts`'s `SocialEventDescriptor` and `src/social/board.ts`'s
  `BoardDescriptor` (both Stage 110) are explicit LABEL-ONLY types — their
  own doc comments state "HARD GUARDRAILS: NO raw bytes field. NO
  `content`/`body`/`text` field of any kind." They were built as a
  placeholder vocabulary for a FUTURE UI, not as a real, storable post
  model — `FedosBoardPost` (Alpha 255) is that real model, and
  deliberately does NOT reuse `SocialEventDescriptor`/`BoardDescriptor`
  because their own guardrails forbid the one field a Canonical Board
  Post most needs (`body`).
- `src/social/intent.ts`'s `BoardInteractionIntentDescriptor` (Stage 114)
  is the same label-only family, for a not-yet-sent user ACTION, not a
  received post.
- `src/federation/types.ts`'s `FederationProvider` boundary and
  `NostrEventCandidate` are explicitly PRE-transport (unsigned, not yet
  published) or POST-transport-agnostic-stub (`connected_placeholder`
  never means a real socket) — neither embeds a live transport object,
  but neither carries real content either, for the same reason.

No transport object (a raw `NostrEvent`, an ActivityPub Activity, an
ATProto record, a WebSocket message) is embedded inside any
currently-shipped "application-level" type in this repository. The
Canonical Board Model (Alpha 252–258) continues that discipline while
finally adding the one field every prior label-only type withheld:
`body`.

### 3.9 `FedosEventDescriptor` / `FedosValidatedNostrEvent` (explicitly named in this Stage's own instruction)

Both reviewed in full (§3.3, §3.7). Both are frozen, Nostr-specific (or
Nostr-shaped) types this Arc does not modify, extend, or redesign — the
Canonical Board Model references neither by import; a future Nostr
Adapter Arc (Alpha 260's own recommendation) is where the actual mapping
from `FedosValidatedNostrEvent` into `FedosBoardPost` will be written.

### 3.10 Identifiers and branded-string patterns

**No branded-string pattern exists anywhere in `src/` today.** Every
existing id (`FedosIdentityDescriptor.id`, `FedosEventDescriptor.id`,
`NostrEvent.id`, `BoardDescriptor.id`, ...) is a plain `string`. This Arc
introduces the FIRST branded identifiers in this repository
(`FedosBoardId`/`FedosThreadId`/`FedosBoardPostId`/`FedosExternalReference`,
Alpha 252).

### 3.11 Source-protocol tracking

`FedosIdentityDescriptor.provider`/`FedosEventDescriptor.provider`
(plain, unconstrained `string`) and
`FederationDescriptor.kind: FederationProviderKind` (a fixed,
`_placeholder`-suffixed union) are the two existing source-tracking
precedents; see §3.2 and §3.11 for why `FedosBoardSourceProtocol`
(Alpha 253) is its own fixed union rather than reusing either.

### 3.12 Attachment or asset abstractions

Covered at §3.6 — `src/asset/types.ts` exists but names a different
layer (content-addressed byte cache), not a post-scoped attachment
reference. Not reused; attachments stay out of scope this Arc regardless.

### 3.13 Identity Descriptor / Identity Record

`FedosIdentityDescriptor` (Alpha 028/045) and `FedosIdentityRecord`
(Alpha 040/047) both reviewed in full (§3.2). Both are reused only by
REFERENCE — `FedosBoardAuthorReference.identityId` (Alpha 254) points at
a `FedosIdentityRecord.id` when the author is a known local identity;
neither type is embedded, and neither's own file is modified by this Arc.

### 3.14 Storage boundaries

`src/storage/types.ts`'s `StorageBackend` is a generic
encrypted-key/value seam, unaware of "board"/"post"/"thread" as concepts.
Not touched, not referenced, not wired to the Canonical Board Model by
this Arc — persistence is explicitly out of scope (this Arc's own
Absolute Prohibitions list).

### 3.15 Desktop models

`src/desktop/*` (Alpha 191–250: wire event, validated event, relay,
subscriptions, inbound validation) is the frozen, ALREADY-COMPLETE
surface this Arc's own instruction says "MUST NOT be redesigned." Read in
full for §3.3/§3.7/§3.9; none of it is modified by this Arc.

### 3.16 Legacy forum or feed code

`src/thread/`, `src/query/`, `src/render/board_preview.ts` — all
Nostr-shaped display/query helpers over `NostrEvent`/`ThreadNode`
directly (§3.3/§3.4). None is a "legacy forum" in the sense of dead code:
all are live, tested, Nostr-specific presentation-layer code that
continues to operate unmodified alongside the new Canonical Board Model.

## 4. Conclusion

No existing honest abstraction is duplicated by this Arc. Every
label-only descriptor this repository already ships (`SocialEventDescriptor`,
`BoardDescriptor`, `BoardInteractionIntentDescriptor`,
`CommunityModerationTargetInput`, `NostrEventCandidate`) was deliberately
built to carry NO content field, for its own stated placeholder purpose —
none is a candidate to become `FedosBoardPost`. The Canonical Board Model
is genuinely new: it is placed under a new `src/board/` directory (this
repository holds no existing canonical home for it — `src/social/`,
`src/thread/`, and `src/community/` are all either label-only or
Nostr-specific, confirmed above), and reuses only CONVENTIONS (the
Descriptor/validated-value split, `provider`-as-data,
hide/mute/filter-never-delete) rather than any existing TYPE.

`src/index.ts`'s own barrel (Stage 1) is NOT extended for `src/board/`:
inspection confirms this barrel was never kept current for any
Alpha-numbered module (`src/desktop/`, `src/identity/`, `src/runtime/`
are ALL absent from it already) — extending it now for `src/board/` alone
would misrepresent a barrel this repository has not actually maintained
since the Alpha renumbering began. No `src/board/index.ts` is added
either, for the same reason ("`index.ts` only if the repository
consistently uses barrel exports" — it does not).

## 5. See also

- `docs/secure_runtime_alpha_250_inbound_validation_completion.md`
- `docs/secure_runtime_alpha_242_validated_nostr_event_model.md`
- `docs/secure_runtime_alpha_202_desktop_facing_event_reader_abstraction.md`
- `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md`
- `docs/secure_runtime_alpha_040_fedos_identity_record.md`
