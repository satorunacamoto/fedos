# 02 — Storage Alignment

## Three storage-adjacent seams, confirmed structurally independent

Direct reading confirms these do not reference one another:

1. **`src/board/persistence/`** (`AppendOnlyFedosBoardPersistence`) and
   **`src/board/outbox/`** (`AppendOnlyFedosBoardOutboxPersistence`) —
   the real, durable, NDJSON append-only backends powering the shipped
   Public Board Runtime. SEC §07 (re-confirmed by this review, no
   change): plaintext always, no `delete`/`truncate`/`compact` method on
   either class, no file-permission hardening, no `fsync`. Confirmed
   directly: `fedos_board_persistence.ts`'s own header states *"No
   `delete` method — deliberately excluded this Arc."*
2. **`src/storage/{types,policy,noop_storage}.ts`** (Stage 107) — a
   wholly separate, older, Google-Drive-replacement-oriented seam. Its
   own header states its purpose: letting *"the Python v8.6 host's
   Google Drive coupling... eventually be replaced by a real backend...
   without the rest of the app depending on any concrete backend."*
   `NoopStorageBackend` denies every operation; `PlaceholderStorageBackend`
   evaluates `reviewStoragePacket` but stores nothing (`get` always
   resolves `unavailable`, `delete` is a no-op). Neither is wired into
   the Runtime or Worker.
3. **`src/runtime/fedos_runtime_ciphertext_storage.ts`** (Seam 2, per
   `01_crypto_inventory.md`) — the only storage layer connected to the
   real AEAD pipeline, but non-persistent (`MemoryStorageBackend` only).

**None of the three is the correct home for a Private Message
Envelope's ciphertext, as-is.** This section reconciles all three
against SEC §07's own recommendation and CFv1 §08's own storage-port
design.

## `src/storage/policy.ts`'s own content rule actively excludes envelope-shaped data

`reviewStoragePacket()` (`src/storage/policy.ts`) rejects any
`StoragePacket.metadata` entry whose key or value (case-insensitively,
non-alphanumerics stripped) contains any of:

```
secret, key, seed, token, payment, entitlement, dm, body, content, message
```

`src/storage/encrypted_payload.ts`'s own `reviewEncryptedPayloadDescriptor()`
extends this with `buyer`, `chat`, `private` for its own descriptor
type. **This is a deliberate, documented exclusion** — both files'
headers state this content rule exists specifically so this seam can
never carry chat/DM/private payload data, even as opaque metadata
labels. Concretely: a hypothetical `FedosConversationMessageEnvelopeV1`
routed through this seam's `StoragePacket.metadata` would have its
`conversationId`/`ciphertextRef`/`keyEpoch` labels rejected the moment
any of them is spelled with a substring like `"message"` or
`"content"` — which every plausible field name in `04_envelope_v1.md`
is. **This confirms, independently and by direct behavioral inspection
of a seam neither prior review read, that `src/storage/*` (Stage 107)
must never become the persistence layer for the Private Message
Envelope** — not merely because it is a placeholder (SEC/CFv1's
existing objection to every placeholder seam), but because its own
policy function is *specifically engineered* to refuse this exact kind
of payload, by design, on purpose, today.

## Reconciliation with SEC §07 (at-rest storage) and CFv1 §08 (storage migration)

SEC §07's own conclusion — a **dedicated, private-only append-only
backend** (Option B), reusing the Board persistence class's *proven*
append-only mechanics but never the same file/instance, with an
independently-chosen retention policy and mandatory file-permission
hardening — remains correct and is **not superseded** by anything this
review's own additional source reading found. `src/storage/*` (Stage
107) was never a candidate SEC or CFv1 considered (neither read it);
this review confirms, having now read it, that it would have been
**actively incompatible** even if considered, for the content-policy
reason above.

CFv1 §08's `FedosConversationPersistence` port (metadata-only: `id`,
`mode`, `createdAt`, `boardId`, `threadId`, `policyRef`) is explicitly
**not** the ciphertext store — CFv1 §08 states this directly: *"must
never be extended to carry ciphertext or key material; when a private
storage backend is built, it references `FedosConversationId` as a
foreign key exactly like every other log, but lives in its own
file/port."* This review's own `04_envelope_v1.md` inherits that
separation unchanged: the Envelope's `ciphertextRef` field points *into*
a future dedicated private ciphertext store, never *into*
`FedosConversationPersistence`, `src/storage/*`, or
`fedos_runtime_ciphertext_storage.ts`.

## What this review adds beyond SEC §07/CFv1 §08

Neither prior review names `fedos_runtime_ciphertext_storage.ts` (Seam
2's own storage layer) as a candidate at all, likely because SEC §01
already rejected it for being non-persistent and Dev-only gated before
CFv1 was written. This review reconfirms that rejection remains correct
— `MemoryStorageBackend` does not survive a process restart, a real
regression from what `AppendOnlyFedosBoardPersistence` already
guarantees for public posts today — and adds one clarification: **the
dedicated private ciphertext store SEC §07 Option B recommends must be
its own, fourth persistence port, structurally parallel to Board,
Outbox, and `FedosConversationPersistence`, never a repurposing of any
existing seam this review found** (Board/Outbox: wrong content-shape
and no deletion story; `src/storage/*`: policy-rejects the content
outright; Seam 2 storage: non-persistent). No such port is designed to
implementation-ready detail here — SEC §07's own scope boundary is
inherited unchanged.

## See also

- `docs/reviews/private_conversation_security/07_at_rest_storage.md`
- `docs/reviews/conversation_foundation_v1/08_storage_migration.md`
- `01_crypto_inventory.md` (Seam 4), `17_retention_erasure.md`
