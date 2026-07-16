# 07 — At-Rest Storage Boundary

## Current append-only backend, confirmed by direct source reading

Both `AppendOnlyFedosBoardPersistence` (`src/board/persistence/`) and
`AppendOnlyFedosBoardOutboxPersistence` (`src/board/outbox/`) share the
identical discipline, re-confirmed this pass:

- **Plaintext, always.** NDJSON — one `JSON.stringify(record) + "\n"`
  per `appendFileSync` call. No encryption import exists in either
  file. Every field of `FedosPersistedBoardPostRecordV1` — `id`,
  `boardId`, `threadId`, `replyTo`, `author.identityId`/`.protocol`/
  `.publicIdentifier`, `createdAt`, `source.protocol`/`.reference`,
  `body` — sits in plaintext in the log.
- **Metadata leakage even if `body` were hypothetically ciphertext.**
  A private conversation reusing this backend as-is (Option A below)
  would still leak, per message, in plaintext, on disk: the sender's
  own author reference, the exact timestamp, the reply-graph edge
  (`replyTo`), and the grouping (`boardId`/`threadId`) — i.e. the
  entire social graph and cadence of a "private" conversation, with
  only the message body itself hidden. This is the single most
  important finding this section adds: **encrypting `body` alone is
  nowhere near sufficient** for anything resembling real privacy.
- **Outbox metadata leakage.** An Outbox intent's own persisted record
  (`FedosPersistedBoardOutboxRecordV1`) carries `target.protocol`/
  `.destination` in plaintext, and the intent's own deterministic id
  (`postId::protocol::destination`) embeds the destination unhashed
  even inside the id field itself — a durable, disk-resident record of
  WHERE a message was being routed, for every private message that
  ever specifies an explicit outbound target.
- **No delete/truncate/compaction method exists on either class** —
  confirmed directly: each has exactly three methods (`put*`/`get*`/
  `list*`); no fourth method of any kind. "`putPost()` NEVER rewrites,
  NEVER truncates, and NEVER reorders the log file."
- **Corruption behavior**: fail-closed, throw-not-skip — a malformed
  non-blank line throws unconditionally on the NEXT `listPosts()`/
  `getPost()` call (real replay-on-every-read, no cache), verified
  against real on-disk corruption in this codebase's own existing test
  suite (`test/secure_runtime_alpha_357_crash_review.test.ts`).
- **File path ownership.** Both constructors require an explicit
  `filePath: string`, no default anywhere in `src/` — `FedosDesktopHost`
  itself never computes a default location; the caller always injects a
  fully-constructed persistence instance. **True process-restart is
  already genuinely exercised** by this codebase's own existing test
  suite (`test/secure_runtime_alpha_367_host_restart_verification.test.ts`) —
  a real temp file, a real second `FedosDesktopHost`/persistence
  instance pointed at the same path, real cross-instance disk
  persistence, not an in-memory shortcut.
- **No file-permission hardening anywhere** — confirmed: zero
  `chmod`/octal-mode/restrictive-creation-mode usage in either
  persistence file, or anywhere in `src/board/persistence`/`src/board/outbox`.
  Both files inherit the OS/process default umask.
- **No `fsync`** — a disclosed, pre-existing gap in both files' own doc
  comments, not new to this review.

## `StorageBackend`/Windows DPAPI — confirmed disconnected from Board persistence entirely

`RuntimeStorageBackend` (`src/runtime/fedos_runtime_storage_backend.ts`)
stores only already-opaque `AeadCiphertextWire` strings, and only via
`MemoryStorageBackend` (in-process `Map`, non-persistent) — the only
implementation actually wired into `resolveRuntimeStorageBackend()`.
`WindowsDpapiStorageBackend` is real and working but **not wired into
the active resolver**, and even if it were, it DPAPI-protects the
already-encrypted wire string sitting in RAM, never touching disk — it
has zero relationship to `src/board/persistence`/`src/board/outbox`,
confirmed by a direct search finding zero cross-references in either
direction, and by both append-only Board files' own guardrail comments:
"NO reference to `src/runtime/*`."

## True process restart — confirmed, not assumed

Re-stated because it matters for Option A/B below: this codebase
already has a REAL, working demonstration that an
`AppendOnlyFedosBoardPersistence`-shaped backend survives a genuine
process-restart-shaped scenario (fresh instance, same file, real disk
I/O) — this is not a hypothetical capability a future Private Storage
backend would need to prove from scratch; the pattern already exists
and is already tested.

## Options compared

**A. Store an encrypted envelope inside the EXISTING append-only
backend** (i.e. `AppendOnlyFedosBoardPersistence`/a sibling instance of
the same class, storing `FedosConversationMessage` records instead of
`FedosBoardPost` records). REJECTED as the default: inherits every
plaintext-metadata leak named above (sender, timestamp, reply-graph,
still in plaintext even with `body`/`ciphertext` encrypted) and the
total absence of deletion — exactly the "no delete method" / "B4"
blocker the prior review named, now confirmed to apply identically to
ANY reuse of this class, private or public.

**B. A dedicated Private-only append-only backend** — same NDJSON
append-only mechanics (reusing the CLASS's own proven discipline, per
"True process restart" above), but a SEPARATE file, SEPARATE schema,
and — critically — its own, independently-decided retention/deletion
policy (§08), not inherited from the public Board log's own
never-delete convention by default.

**C. A future SQLite (or similar) backend.** Not designed by this
review — `docs/secure_runtime_alpha_348_deployment_review.md` (prior
Arc, re-read this pass) already surveys SQLite as a candidate general
Board backend, concluding only the Desktop Host/Node environment can
reach either SQLite or the append-only file backend at all (Cloudflare
Workers has no real filesystem). A private-conversation backend
inherits the identical environment constraint regardless of format
choice.

**D. Reuse Secure Runtime ciphertext storage** (`fedos_runtime_ciphertext_storage.ts`,
§01). REJECTED as the primary store: confirmed non-persistent
(in-process `Map` only, "data does NOT survive an actual process
restart"), Dev-only gated, and entirely disconnected from the Host/
Board write path — using it as message storage would silently lose
every private message on restart, a regression from what the EXISTING
public Board append-only backend already guarantees today.

**E. OS secure storage as the message store itself** (e.g. Windows
Credential Manager/DPAPI, macOS Keychain) holding conversation
messages directly. REJECTED: OS secure-storage APIs are designed for
small, infrequent secrets (keys, tokens), not an append-only, potentially
large and growing message history — `docs/secure_runtime_alpha_022_storage_backend_selection_policy_review.md`'s
own comparison table (re-read this pass) already characterizes DPAPI/
Keychain/Secret-Service as weak-to-nonexistent for BACKUP/multi-device
specifically, a property message history needs more than a key does.

## Recommendation: **B**, key storage and message storage kept structurally separate

A dedicated Private Conversation append-only backend (B), reusing the
PROVEN append-only mechanics but never the SAME file/class instance as
public Board data, with a deliberately separate retention/deletion
policy (§08) — never conflating "where the group/pairwise KEY material
lives" (a §05/§01 concern, properly a `RuntimeStorageBackend`/opaque-
handle concern) with "where the CIPHERTEXT MESSAGE HISTORY lives" (this
section's own concern). This is the same distinction §01 already found
the codebase itself observes structurally (`AeadKeyHandle` vs.
`AeadCiphertextWire` are different types with different handling rules)
— extended here to the persistence layer explicitly, per this review's
own instruction not to conflate key storage and message storage.

## Access control — a real, unresolved gap this review flags, not fixes

Confirmed: zero file-permission hardening exists anywhere in the
current persistence layer. A future Private Storage backend (B) MUST
NOT inherit this silently — restrictive file creation
(`fs.appendFileSync`'s own `mode` option, or an explicit `chmod` after
first creation) is a real, concrete requirement this review names as a
prerequisite for B, not an optional hardening step, precisely because B
holds ciphertext (and, per the leaked-metadata finding above,
substantial plaintext metadata) for content whose entire purpose is
confidentiality.

## See also

- `docs/reviews/private_conversation_security/01_existing_crypto_inventory.md`
- `docs/reviews/private_conversation_security/02_private_canonical_model.md`
- `docs/reviews/private_conversation_security/08_deletion_retention.md`
- `docs/secure_runtime_alpha_347_storage_layout_review.md`
- `docs/secure_runtime_alpha_322_durable_backend_requirements.md`
