# Secure Runtime Alpha 265 — Nostr Source Reference

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedNostrEventToBoardPostInput` at Alpha 266.** Stage 5 of the
Alpha 261–270 Nostr Canonical Board Adapter Arc.

## 1. Why now

Alpha 261's own field mapping table named `id` as reused for both
`FedosBoardPost.id` and `FedosBoardSourceReference.reference`. This
Stage fixes the `FedosBoardSourceReference` construction rule before
Alpha 266 implements it, and separately fixes the `boardId` policy this
Arc's own field inventory flagged as "requiring explicit policy."

## 2. The mapping

```
"nostr"    ->  FedosBoardSourceReference.protocol   (fixed constant)
event.id   ->  FedosBoardSourceReference.reference   (verbatim hex event id)
```

Matches `FedosBoardSourceReference`'s own documented convention exactly
(`src/board/fedos_board_source.ts`, Alpha 253: "`nostr`: the Nostr event
id (hex)") and the SAME choice already exercised for the Nostr fixture
in the prior Arc's own protocol-neutrality verification (Alpha 259 §3).

## 3. What is deliberately excluded

Per this Arc's own instruction, verbatim, confirmed absent by direct
inspection of `mapValidatedNostrEventToBoardPostInput`:

- **No relay URL.** `FedosValidatedNostrEvent` itself carries no relay
  field (Alpha 242's own seven fields are exactly the NIP-01 wire
  fields) — there is nothing to even read. A NIP-01 `e`-tag's own
  optional relay-hint slot (`tags[n][2]`) is likewise never read by this
  adapter.
- **No connection state.** No Relay/WebSocket/subscription object is
  ever passed to, or reachable from, this adapter (Alpha 268).
- **No transport metadata.** No timestamp-of-receipt, no relay identity,
  no subscription id — `FedosBoardSourceReference` has exactly two
  fields (Alpha 253 §4: "no generic metadata bag") and this adapter
  populates only those two, both from `event.id` and the fixed literal
  `"nostr"`.

## 4. `boardId` — the one field with no Nostr-side source at all

Nostr has no concept of "board." `FedosBoardPost.boardId` is a value the
CALLER of `validateNostrBoardPost`/`mapValidatedNostrEventToBoardPostInput`
must supply explicitly — this adapter treats it as an opaque parameter,
never inferring, guessing, or defaulting it from `event`'s own content
(not from a tag, not from `kind`, not from anything). Deciding which
local board a given subscription's incoming events belong to is Board
Application Logic's own job — the same layer Alpha 256 §4 already
assigns cross-post invariant checking to — and remains entirely out of
this Arc's scope (no Relay, Runtime, or subscription-wiring change is
made this Arc).

## 5. See also

- `docs/secure_runtime_alpha_261_nostr_board_field_inventory.md`
- `docs/secure_runtime_alpha_253_board_source_provenance.md`
- `docs/secure_runtime_alpha_259_protocol_neutrality_verification.md`
