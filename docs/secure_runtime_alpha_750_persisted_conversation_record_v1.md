# Secure Runtime Alpha 750 — Persisted Conversation Record V1

Stage 10. `src/conversation/persistence/fedos_persisted_conversation_record_v1.ts`
(the STABLE WIRE SHAPE) + `fedos_conversation_record_codec.ts`
(`serializeFedosConversationRecord`/`deserializeFedosConversationRecord`) —
mirrors `FedosPersistedBoardPostRecordV1`/`fedos_board_post_codec.ts`
(Alpha 313/314) exactly.

## Requirements, checked

- **`schemaVersion: 1`** — a literal numeric type at the TS level (any
  other value is a compile-time error in the wire type); the codec adds
  the matching RUNTIME check.
- **No secret** — every field is a plain `string`/`number`; no key,
  ciphertext, or credential of any kind.
- **Exact fields** — `id`/`mode`/`boardId`/`rootThreadId`/`rootPostId`/
  `policyReference`/`createdAt`, matching `FedosConversationRecord`'s
  own field set (Alpha 745) one-to-one.
- **Fail-closed codec** — `deserializeFedosConversationRecord` returns
  `null` for anything malformed; never throws.
- **Unknown fields rejected** — `TOP_LEVEL_KEYS` allow-list, mirroring
  `deserializeFedosBoardPost`'s own `hasOnlyAllowedKeys` discipline
  exactly.
- **Unknown schema rejected** — `schemaVersion !== 1` fails closed,
  never guessed at.
- **Round-trip equality** — `serialize` then `deserialize` reproduces a
  structurally identical `FedosConversationRecord` (verified by
  `test/secure_runtime_alpha_749_conversation_persistence_port.test.ts`).
- **No silent migration** — an unrecognized `schemaVersion` is rejected
  outright; no automatic upgrade/repair path exists or is planned for
  this Arc.

`deserializeFedosConversationRecord` reuses `validateFedosConversationRecord`
(Alpha 748, unmodified) for every structural/domain check rather than
re-implementing any of them — the codec's own job is purely the
raw-JSON-shape boundary (unknown-key/type checks), exactly matching the
Board codec's division of responsibility.
