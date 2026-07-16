# Secure Runtime Alpha 817 — Performance and Limits Review

Stage 27. Verified correctness at:

- **1 payload** — every unit test in this Arc's own suite exercises the
  single-payload path.
- **100 payloads** — verified against the real append-only backend
  (`test/secure_runtime_alpha_819_end_to_end_storage_verification.test.ts`
  item 12) and the in-memory backend
  (`test/secure_runtime_alpha_807_in_memory_payload_storage.test.ts`
  item 12): all 100 round-trip correctly, list-by-Conversation returns
  the full set, and an arbitrary middle entry reads back exact bytes.
- **A reasonable maximum configured size** — exercised via
  `maxPayloadByteLength`, confirmed both accepting a within-limit write
  and rejecting an over-limit one
  (`test/secure_runtime_alpha_809_append_only_payload_storage.test.ts`
  item 9).

## Current complexity, stated honestly

The append-only backend's `getPayload`/`listConversationPayloads` both
REPLAY the entire log on every call — O(n) per read, where n is the
total number of payload records ever written to that log (matching
`AppendOnlyFedosConversationPersistence`'s own identical, already-accepted
complexity, Alpha 752). No index of any kind exists. This is not
benchmarked at scale in this Arc — no real private-message volume
exists yet to size against, and this Arc's own instruction is explicit:
"Do not benchmark huge data or add indexes without need." If a future
Arc's real usage pattern demands better-than-O(n) reads, that Arc is
the right place to introduce an index — not this one.
