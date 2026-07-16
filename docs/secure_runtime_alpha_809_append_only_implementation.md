# Secure Runtime Alpha 809 — Append-Only Implementation

Stage 19. `AppendOnlyFedosConversationPayloadStorage`
(`src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.ts`) —
implements Option A from Alpha 808.

## Requirements, checked

- **Caller-supplied root/path** — constructor takes an explicit
  `filePath`; no default, no repository-relative production data path.
- **No constructor network/I/O** — only stores `filePath` and
  `maxPayloadByteLength` (confirmed,
  `test/secure_runtime_alpha_809_append_only_payload_storage.test.ts`
  item 6).
- **No overwrite on conflict** — a differing record for an existing id
  returns `"conflict"`, original preserved (item 8).
- **No path traversal** — no per-payload filename is ever constructed
  (Alpha 808's own Option A choice makes this a non-issue by
  construction, not merely by validation).
- **Corruption fail closed** — a malformed trailing line, or a
  structurally valid-JSON-but-invalid record (bad base64, byteLength
  mismatch), both throw on read (items 10–11) — identical policy to
  every other append-only backend in this codebase (Alpha 357/752).
- **Partial trailing write policy explicit** — no special-casing of a
  trailing line versus a mid-file corrupt one; both throw uniformly
  (this file's own header, restating Alpha 357's reasoning verbatim).
- **No automatic repair, no automatic compaction** — confirmed by the
  Absolute Prohibitions and by structural scan (Alpha 818).
- **No secret/plaintext claim** — this backend makes no claim about
  what the bytes mean (Alpha 814).
