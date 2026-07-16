# Secure Runtime Alpha 805 — Opaque Byte Handling

Stage 15. Requirements, checked against both backends
(`InMemoryFedosConversationPayloadStorage`,
`AppendOnlyFedosConversationPayloadStorage`):

- **Defensive copy on write** — `putPayload` stores
  `Uint8Array.from(bytes)`, never the caller's own reference (confirmed,
  `test/secure_runtime_alpha_807_in_memory_payload_storage.test.ts` item
  4: mutating the caller's array after `put()` does not affect stored
  bytes).
- **Defensive copy on read** — `getPayload` returns
  `Uint8Array.from(stored)`, never the internally-held array (confirmed,
  item 5: mutating the returned array does not affect a subsequent
  read).
- **`Uint8Array` only** — no string conversion of raw bytes anywhere in
  the Application-facing API; base64 (Alpha 806) is confined strictly
  to the append-only backend's own persistence boundary.
- **No logging of bytes** — confirmed structurally,
  `test/secure_runtime_alpha_818_structural_security_guards.test.ts`
  item 10: no `console.log`/`console.error`/`console.warn`/etc. call
  anywhere in either module.
- **No Debug-style dump** — no `toString()`/`JSON.stringify()` call
  ever applied to a `bytes` value (item 2 of the same test).
- **Maximum payload size is explicit, not invented.** No repository
  precedent exists for a byte-size limit (Alpha 791 finding 5 confirms
  the closest analog, `StorageRef`/`idRef`, carries no size limit
  either — it stores nothing). `AppendOnlyFedosConversationPayloadStorage`'s
  constructor therefore takes `maxPayloadByteLength` as a REQUIRED
  parameter, with no default — the caller must make an explicit,
  informed choice (confirmed,
  `test/secure_runtime_alpha_809_append_only_payload_storage.test.ts`
  item 9: an oversized write fails, never silently truncated).
