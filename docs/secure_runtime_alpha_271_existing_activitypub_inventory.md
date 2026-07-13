# Secure Runtime Alpha 271 — Existing ActivityPub / Mastodon Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 271–280
ActivityPub Canonical Board Adapter Arc. It inspects the actual
repository before any implementation, exactly as Alpha 251 did for the
Canonical Board Model itself and Alpha 261 did for the Nostr Adapter.

## 1. Why now

Alpha 270 closed the Nostr Canonical Board Adapter Arc and recommended
exactly this Arc next, since ActivityPub is the second of the four
target entry paths the Canonical Board Model was designed against
(Alpha 251–260 §"Core Direction") and Nostr's adapter (Alpha 261–270)
now exists as a reference pattern to follow "where honest."

## 2. Inventory method

Direct inspection of `src/`, `docs/`, and `package.json` — no code
executed, no file modified. Searched for `ActivityPub`, `activitypub`,
`Mastodon`, `inReplyTo`, `HTTP Signature`, `WebFinger`, `NodeInfo`,
`attributedTo`, and every directory/file name containing `activitypub`,
`mastodon`, or `actor`.

## 3. Findings, answering all ten required questions

### 3.1 What ActivityPub code already exists

**None.** `src/activitypub/` does not exist. No file anywhere in `src/`
matches `*activitypub*`, `*mastodon*`, or `*actor*` by name, and a
full-text search for `ActivityPub`/`activitypub`/`Mastodon`/`inReplyTo`/
`HTTP Signature`/`WebFinger`/`NodeInfo`/`attributedTo` across `src/`
returns zero matches. `docs/threads_adapter_planning.md` is the one
superficially-similarly-named file in this repository, but it is about
Meta's **Threads** platform (a centralized, proprietary API, explicitly
"not a protocol FedOS could ever be a peer on" — that doc's own §2) —
an entirely different thing from the **ActivityPub** protocol Mastodon
speaks. It is not ActivityPub code or planning and is not reused here.

### 3.2 Whether inbound HTTP signatures are already verified

**No.** No HTTP Signature verification code exists anywhere in this
repository. No dependency capable of it is present either (`package.json`'s
own two dependencies are `@noble/curves` and `@noble/hashes`, both
Nostr-oriented elliptic-curve/hash primitives, unrelated to RFC 9421/
Mastodon-style HTTP Signatures).

### 3.3 Whether Actor resolution already exists

**No.** No Actor-fetching, WebFinger, or NodeInfo code exists anywhere.
No network-capable ActivityPub client of any kind exists.

### 3.4 Whether a normalized Note type already exists

**No.** Nothing resembling `FedosValidatedActivityPubPost` exists before
this Stage. The closest structurally-similar precedent is
`FedosValidatedNostrEvent` (`src/desktop/fedos_validated_nostr_event.ts`,
Alpha 242) — a DIFFERENT protocol's validated-value type, reviewed here
only as the naming/construction-discipline pattern to mirror (Alpha 272
does mirror it), not as reusable ActivityPub code.

### 3.5 Whether HTML sanitization exists

**No true inbound sanitizer exists.** `src/render/html.ts`'s
`escapeHtml` (Stage 3) is the one HTML-adjacent function in this
repository, and it is the WRONG DIRECTION for this Arc's purpose: it
ESCAPES already-plain-text Nostr content for safe OUTPUT into an HTML
page (`&` → `&amp;`, `<` → `&lt;`, ...) — it does not PARSE, STRIP, or
SANITIZE untrusted INBOUND HTML into safe plain text. No HTML parser,
no `DOMPurify`-equivalent, and no HTML-to-plain-text converter exists
anywhere in `src/` or in `package.json`'s dependencies. This directly
shapes Alpha 272/275's own content-policy decision (Option A/B, "already
sanitized plain text," §5 below) — this repository has no capability to
sanitize HTML itself, so it cannot honestly claim any other option.

### 3.6 Whether Create(Note) and Note are represented separately

**No — because neither is represented at all.** No Activity-envelope
type (`Create`, `Update`, `Delete`, `Announce`, `Like`, `Follow`, `Undo`)
and no Object type (`Note`, `Article`, ...) exists anywhere in this
repository. This Arc's own scope decision (§"Important Scope Decision")
already settles how they WILL be separated once built: the Board
Adapter never sees a raw Activity envelope at all, only an
already-normalized `FedosValidatedActivityPubPost` an upstream layer
(not built this Arc) would produce specifically from a `Create(Note)`.

### 3.7 Whether Mastodon-specific assumptions exist

**No.** With zero ActivityPub code present, there are zero
Mastodon-specific assumptions to inherit or avoid. This Stage records,
for future Stages' benefit, that Mastodon status URLs commonly look like
`https://instance.example/@user/123456789012345678` and Mastodon-style
`Create(Note)` activities commonly nest the actor id at
`activity.actor`/`object.attributedTo` — but NONE of this shape
knowledge is encoded anywhere in this Arc's own types or adapter (Alpha
276's own "no Mastodon-specific status-id parsing" invariant holds
trivially: nothing parses a status URL's structure at all).

### 3.8 Which code is reusable

- **The Nostr Adapter's own two-function pattern**
  (`mapValidatedNostrEventToBoardPostInput` +
  `validateNostrBoardPost`, `src/board/fedos_board_nostr_adapter.ts`,
  Alpha 266) — reused as the STRUCTURAL PATTERN (mapper + composed
  validator), not as code. See Alpha 277.
- **`validateFedosBoardPost`** (`src/board/fedos_board_post_validator.ts`,
  Alpha 257) — reused DIRECTLY, unmodified, exactly as the Nostr Adapter
  already does; this is the whole point of a protocol-neutral validation
  boundary.
- **The Descriptor/validated-value construction discipline**
  (`FedosValidatedNostrEvent`, Alpha 242) — reused as a NAMING pattern
  for `FedosValidatedActivityPubPost` (Alpha 272): "validated upstream
  by convention and module placement," not runtime-branded.

### 3.9 Which code is unsafe to reuse

Nothing in this repository is UNSAFE to reuse for this purpose — there
is simply nothing ActivityPub-shaped to reuse at all (§3.1). No risk of
duplicating a dishonest or unsafe existing abstraction exists this Arc,
unlike Alpha 251's finding that the Canonical Board Model's own
label-only precedents (`SocialEventDescriptor`, `BoardDescriptor`)
existed but were unsafe to reuse as-is.

### 3.10 Whether any network access would be required

**Yes — but entirely OUTSIDE this Arc's own scope.** A real ActivityPub
integration would eventually need: inbox HTTP handling, HTTP Signature
verification (requiring the Actor's public key, itself requiring an
Actor fetch or cache), WebFinger/NodeInfo discovery, and possibly
attachment fetching. This Arc's own "Important Scope Decision" places
ALL of that above the line this Arc implements: "The Adapter must accept
only an already-normalized, already-authenticated ActivityPub input
model." Zero network code is added by this Arc (confirmed structurally
in Alpha 277/280) — the normalized input type itself is the entire
contract this Arc establishes for that future, separate work.

## 4. Conclusion

No existing honest abstraction is duplicated by this Arc — there is
nothing ActivityPub-shaped to duplicate. The Nostr Adapter (Alpha
261–270) supplies the STRUCTURAL pattern this Arc mirrors; the Canonical
Board Model (Alpha 251–260) supplies the fixed target shape; neither is
redesigned. New files are placed under `src/board/activitypub/` (this
Arc's own required directory), never under a new `src/activitypub/` —
there is no existing protocol-adapter directory this inventory found
that would justify a different location, and Canonical Board semantics
must not live under a transport-named directory (this Arc's own
instruction, verbatim).

## 5. See also

- `docs/secure_runtime_alpha_270_nostr_board_adapter_completion.md`
- `docs/secure_runtime_alpha_266_nostr_board_adapter_implementation.md`
- `docs/secure_runtime_alpha_261_nostr_board_field_inventory.md`
- `docs/threads_adapter_planning.md`
- `docs/bluesky_adapter_planning.md`
