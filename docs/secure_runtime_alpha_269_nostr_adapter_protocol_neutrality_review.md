# Secure Runtime Alpha 269 — Protocol Neutrality Review (Post-Adapter)

**Status: this Stage VERIFIES. It adds NO new production file — it is
backed by a real test
(`test/secure_runtime_alpha_269_nostr_adapter_protocol_neutrality_review.test.ts`)
that constructs an actual `FedosBoardPost` via `validateNostrBoardPost`
and inspects its shape.** Stage 9 of the Alpha 261–270 Nostr Canonical
Board Adapter Arc.

## 1. Why now

Alpha 259 (prior Arc) verified the Canonical Board Model COULD honestly
represent Nostr content, using an inline fixture mapping in a test file.
This Stage re-verifies the SAME claim now that the mapping is real
production code (`fedos_board_nostr_adapter.ts`, Alpha 266), confirming
nothing was lost or Nostr-specific-ified in translating the fixture into
a real adapter.

## 2. No Nostr-specific field outside `FedosBoardSourceReference`

A `FedosBoardPost` produced by `validateNostrBoardPost` has exactly the
same eight fields any other Protocol Adapter's output would have (Alpha
255) — confirmed by structural inspection of the object's own key set,
not merely by type-checking:

```
id, boardId, threadId, replyTo, author, body, createdAt, source
```

The word `"nostr"` appears in exactly two places on the resulting value:
`source.protocol` and `author.protocol` — both DATA fields whose entire
purpose is to name a protocol (Alpha 253/254 both document this as
intentional, not a leak). No Nostr-specific KEY exists anywhere on the
object: no `tags`, no `kind`, no `sig`, no `pubkey` (renamed to
`publicIdentifier`), no `content` (renamed to `body`), no `created_at`
(renamed to `createdAt`).

## 3. `author.publicIdentifier`'s hex format is expected, not a leak

`author.publicIdentifier` holds a 64-character lowercase-hex string for
Nostr-sourced posts — a Nostr-specific FORMAT, but not Nostr-specific
SEMANTICS: the field's own contract (Alpha 254) is "an already-public
identifier in the author's own protocol namespace," which for
ActivityPub would instead hold a URI, for AT Protocol a DID, and for
Session a Session ID (Alpha 259 §3–6, prior Arc, already fixture-tested
all three). No Board-model code anywhere parses, validates the shape of,
or branches on the FORMAT of `publicIdentifier` — it is treated as an
opaque string throughout `src/board/`, confirmed by grepping
`fedos_board_post_validator.ts`'s own `validateAuthor` (Alpha 257): it
checks only non-emptiness, never a hex pattern, a URI scheme, or a DID
prefix.

## 4. The exact same shape remains producible by the other three protocols

Re-confirming Alpha 259's own three non-Nostr fixture mappings
(ActivityPub, AT Protocol, Session) required NO change to
`FedosBoardPost`, `FedosBoardAuthorReference`, or
`FedosBoardSourceReference` to accommodate the NOW-REAL Nostr adapter —
`fedos_board_nostr_adapter.ts` (Alpha 266) added a NEW FILE, and modified
ZERO existing `src/board/` file. The three other fixtures from Alpha 259
therefore remain equally valid and equally producible without any Board
code change:

- **ActivityPub** would supply `author.publicIdentifier` = an Actor URI,
  `source.reference` = the object URI, `source.protocol`/`author.protocol`
  = `"activitypub"`.
- **AT Protocol** would supply `author.publicIdentifier` = a DID,
  `source.reference` = an AT URI, `source.protocol`/`author.protocol` =
  `"atproto"`.
- **Session** would supply `author.publicIdentifier` = a Session ID,
  `source.reference` = a gateway message reference,
  `source.protocol`/`author.protocol` = `"session"`.

Each would follow the SAME two-step composition
`map<Protocol>EventToBoardPostInput` → `validateFedosBoardPost` this Arc
established for Nostr (Alpha 266 §2) — the pattern, not just the
Board-model shape, generalizes.

## 5. See also

- `docs/secure_runtime_alpha_266_nostr_board_adapter_implementation.md`
- `docs/secure_runtime_alpha_259_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_270_nostr_board_adapter_completion.md`
