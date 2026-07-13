# Secure Runtime Alpha 255 — Canonical Board Post Model

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/fedos_board_post.ts`.** Stage 5 of the Alpha 251–260
Canonical Board Model Foundation Arc.

## 1. Why now

Alpha 252–254 fixed identifiers, provenance, and the author reference.
This Stage assembles them into the minimum immutable post shape itself —
the type the whole Arc exists to define.

## 2. The shape

```ts
export interface FedosBoardPost {
  readonly id: FedosBoardPostId;
  readonly boardId: FedosBoardId;
  readonly threadId: FedosThreadId;
  readonly replyTo: FedosBoardPostId | null;
  readonly author: FedosBoardAuthorReference;
  readonly body: string;
  readonly createdAt: number;
  readonly source: FedosBoardSourceReference;
}
```

Eight fields, matching this Arc's own candidate exactly.

## 3. Optional additions — reviewed and rejected

This Arc's own instruction lists six candidates and requires each be
"justified by actual product requirements," warning explicitly: "Do not
add speculative fields merely because one source protocol supports them."
None is added this Arc:

- **subject/title** — see Alpha 256 §4 for the full thread-root
  title-policy decision; no field is added.
- **attachments** — explicitly out of scope this Arc (this Arc's own
  "Still out of scope" list, Alpha 260); no reference type for it exists
  yet either (Alpha 251 §3.6/§3.12).
- **content warning** — no product requirement named in this Arc's own
  instruction; a future Stage can add it once one exists, since
  `validateFedosBoardPost` (Alpha 257) is the only construction point and
  would gate the new field the same way it gates every existing one.
- **language** — same reasoning; no requirement, no field.
- **editedAt** — `FedosBoardPost` is IMMUTABLE (§5); an edit is a NEW
  post version at the Board Application Logic layer, not a mutation of
  this one, so this Arc adds no `editedAt` field to a type that, by
  design, is never edited in place.
- **deletedAt** — see Alpha 258: deletion/moderation state is
  DELIBERATELY kept off `FedosBoardPost` entirely, on a separate
  `FedosBoardModerationRecord`. Adding `deletedAt` here would violate
  that Stage's own decision before it is even written.

## 4. Field-by-field rationale

- `id: FedosBoardPostId` — this post's own application identifier
  (Alpha 252).
- `boardId: FedosBoardId` — which board this post belongs to. Required,
  never optional: a Canonical Board Post is always scoped to exactly one
  board (see Alpha 256 §5 for the "cross-board replies invalid"
  invariant this field makes checkable).
- `threadId: FedosThreadId` — the root post's identity for this post's
  thread (Alpha 256 §2).
- `replyTo: FedosBoardPostId | null` — the direct parent, or `null` for a
  thread root (Alpha 256 §2–3).
- `author: FedosBoardAuthorReference` — Alpha 254.
- `body: string` — PLAIN TEXT ONLY this Arc. HTML/Markdown interpretation
  is out of scope (Alpha 260); `validateFedosBoardPost` (Alpha 257) does
  no HTML/Markdown transformation of any kind — the string is stored
  verbatim, exactly as supplied, up to
  `FEDOS_BOARD_POST_MAX_BODY_LENGTH`.
- `createdAt: number` — Unix SECONDS (see Alpha 251 §3.7 for the
  timestamp-format survey and why seconds was chosen over the
  `SocialEventDescriptor.createdAt` millisecond outlier).
- `source: FedosBoardSourceReference` — Alpha 253.

## 5. Minimum guarantees, confirmed by direct inspection (and this
Stage's own structural test)

- **Immutable** — every field is `readonly`; no mutation method or
  setter exists on the interface (an interface cannot define one anyway,
  but no companion class does either — this file defines a TYPE ONLY).
- **No transport object embedded** — no Nostr tags, no ActivityPub
  Activity, no ATProto record, no Session message object appears
  anywhere on this type.
- **No mutable arrays by reference** — the type has no array-typed field
  at all this Arc (attachments, the one plausible candidate, is out of
  scope — §3).
- **No open metadata object** — no `Record<string, unknown>`, no index
  signature.
- **`body` remains plain text this Arc** — confirmed above.
- **HTML ingestion is out of scope** — confirmed; no sanitizer, no
  parser, no HTML-aware code exists anywhere in `src/board/`.
- **Markdown interpretation is out of scope** — confirmed; no Markdown
  parser or renderer exists anywhere in `src/board/`.
- **Attachment bytes are out of scope** — confirmed; no byte-carrying
  field exists on this type.

## 6. Construction discipline

Only `validateFedosBoardPost` (`./fedos_board_post_validator.ts`, Alpha
257) may construct a value of this type, by convention and module
placement — the identical discipline `FedosValidatedNostrEvent`
(`src/desktop/fedos_validated_nostr_event.ts`, Alpha 242) already
established for validated Nostr events. This file itself defines no
function, class, or construction logic of any kind.

## 7. See also

- `docs/secure_runtime_alpha_254_canonical_board_author.md`
- `docs/secure_runtime_alpha_256_thread_reply_semantics.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
- `docs/secure_runtime_alpha_258_moderation_deletion_boundary.md`
