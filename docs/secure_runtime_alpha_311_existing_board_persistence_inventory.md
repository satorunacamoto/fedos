# Secure Runtime Alpha 311 — Existing Board Persistence Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 311–320
Canonical Board Persistence Boundary Arc. It inspects the actual
repository before any implementation, exactly as every prior Board-layer
Arc's own opening Stage did (Alpha 251, 261, 271, 281, 291, 301).

## 1. Why now

Alpha 310 closed the Canonical Board Repository, Index & Feed Foundation
Arc and recommended exactly this Arc next: "The in-memory application
semantics must be frozen before choosing a durable storage backend."
This Stage inspects the repository before that persistence SEAM (not
yet a real backend) is defined.

## 2. Inventory method

Direct inspection of `src/board/repository/*`, `src/runtime/*storage*`,
`src/runtime/*ciphertext*`, `src/storage/*`, `src/indexer/*`,
`src/board/fedos_board_moderation.ts` — no code executed, no file
modified. `p2p/` was inspected ONLY to confirm repository isolation
(its own separate `.git` directory) — no internal file was read, per
this Arc's own instruction ("do not inspect its internal implementation
beyond confirming repository isolation").

## 3. Findings, answering all ten required questions

### 3.1 Whether a generic persistence interface already exists

**No.** `StorageBackend` (`src/storage/types.ts`, Stage 107) is entirely
inert — its own doc comment states "this file defines shapes ONLY... no
implementation performs real storage" (already confirmed, Alpha 301
§3.5). `RuntimeStorageBackend` (`src/runtime/fedos_runtime_storage_backend.ts`,
Alpha 021) IS real and working, but it is narrow — a three-method,
single-key `store`/`load`/`delete` interface scoped to exactly ONE
payload shape (§3.2). Neither is a generic, arbitrary-object persistence
interface.

### 3.2 Whether Secure Runtime ciphertext storage is suitable for Board
posts

**No — confirmed unsuitable by TYPE, not merely by inconvenience.**
`RuntimeStorageBackend.store`/`.load` (Alpha 021) accept/return
`AeadCiphertextWire` ONLY — enforced at the TYPE level, so passing a
`FedosBoardPost` (a plain, unencrypted object) is a COMPILE-TIME error,
not a runtime risk to guard against. This Arc's own instruction states
the precedent directly: "Alpha 025 established that `storeCiphertext()`
accepts only encrypted wire data and is not an arbitrary object store" —
confirmed by direct inspection of `fedos_runtime_ciphertext_storage.ts`'s
own doc comment ("STORES `AeadCiphertextWire` ONLY"). Beyond the type
mismatch, THREE further reasons make it the wrong layer even in
principle:

- **Wrong operational posture.** `storeCiphertext`/`loadCiphertext`/
  `deleteCiphertext` are Development-Runtime-gated and Fail Closed
  (return `null`) outside Development — appropriate for a still-inert
  crypto surface, wrong for board content that must persist in every
  runtime mode.
- **Wrong content classification.** `AeadCiphertextWire` names
  ENCRYPTED, presumptively PRIVATE data. `FedosBoardPost` is PUBLIC
  board content (Alpha 255) — encrypting it to fit this API would be
  both semantically backwards and a "persistence encryption" change
  this Arc's own Absolute Prohibitions forbid regardless.
- **Wrong batch shape.** Every operation here is single-key; this Arc's
  own persistence port (Alpha 315) needs `listPosts()` and idempotent
  `putPost()` semantics this narrow interface has no room for without
  redesigning it — itself prohibited ("no ciphertext storage changes").

### 3.3 Whether Board post persistence already exists

**No.** No file anywhere in this repository serializes, stores, or
reloads a `FedosBoardPost`.

### 3.4 What serialization patterns are reusable

**One NAMING precedent, not code.** `EncryptedPayloadDescriptor.version`
(`src/storage/encrypted_payload.ts`) is fixed at the string literal
`"v1"`, explicitly "mirroring the Rust-side
`CiphertextTransportVersion::V1`'s 'exactly one variant' shape" — a
version-tagged wire-record convention already exists in this repository,
though expressed as a lowercase STRING literal rather than a NUMBER.
This Arc's own candidate record (Alpha 313) uses a numeric
`schemaVersion: 1` literal instead — matching this Arc's own instruction
verbatim, not copying the existing string-literal spelling; the
DISCIPLINE (a fixed, explicitly-checked version tag) is reused, the
exact type is not.

### 3.5 Whether schema-version conventions exist

**Only as the naming precedent named in §3.4.** No migration CODE exists
anywhere in this repository — the one "migration" hit in
`src/runtime/types.ts` is a doc-comment cross-reference to an unrelated
key-handle migration write-up (Alpha 013), not a schema-migration
pattern for persisted records. There is nothing to migrate FROM yet,
which is why Alpha 314's own "no silent migration" decision costs
nothing to adopt.

### 3.6 Whether atomic batch operations exist

**No.** Every write surface reviewed (`RuntimeStorageBackend.store`,
`MemoryStorageBackend`) operates on exactly ONE key per call; no
batch/transaction API of any kind exists anywhere in this repository's
TypeScript layer.

### 3.7 Whether persistent indexes already exist

**Yes, but scoped to a DIFFERENT, explicitly non-authoritative concern
— not reused.** `D1MetadataIndex` (`src/indexer/d1_index.ts`, Stage 14)
is a REAL, working Cloudflare D1 (SQL, prepared-statement-bound)
implementation of `MetadataIndex` — but its own doc comment states
plainly: "D1 is used HERE ONLY as a metadata/index store for
discovery... it is NOT an audit log or an authoritative/durable record —
the index can be rebuilt from relays and may lag or be incomplete."
This Arc's own Core Persistence Rule requires the OPPOSITE property for
Board posts — AUTHORITATIVE application facts, not a rebuildable,
lag-tolerant discovery index. Reusing or extending `D1MetadataIndex` for
canonical Board persistence would be a category error even before
considering that this Arc's own Absolute Prohibitions forbid a real D1
backend of any kind regardless.

### 3.8 Whether moderation records have a persistence path

**No.** `FedosBoardModerationRecord` (`src/board/fedos_board_moderation.ts`,
Alpha 258) remains a pure, inert type — never constructed, never stored,
by design (Alpha 258 §6/§7 confirmed this at the time and nothing since
has changed it). This Arc's own instruction lists moderation records as
persistence-eligible only "if already part of the canonical model" — it
is a TYPE in this repository, but no moderation RECORD has ever been
instantiated; there is nothing yet to persist.

### 3.9 Which existing storage abstractions must not be reused

- **`RuntimeStorageBackend`/`MemoryStorageBackend`/`storeCiphertext`/
  `loadCiphertext`/`deleteCiphertext`** (§3.2) — wrong payload type,
  wrong operational gating, wrong content classification.
- **`StorageBackend`** (`src/storage/types.ts`) — entirely inert, no
  real storage of any kind to build on.
- **`D1MetadataIndex`/`InMemoryMetadataIndex`** (§3.7) — scoped to a
  non-authoritative discovery index, the wrong authority level for
  canonical Board persistence, and Nostr-specific regardless.

### 3.10 Why `p2p/` is not the persistence backend

**Confirmed, at the repository-isolation level, that `p2p/` is a
genuinely separate git repository** — it carries its OWN `.git`
directory; the parent repository's own `git status` reports it as one
opaque untracked directory (`?? p2p/`), never as tracked contents. This
Arc's own instruction requires NOT inferring or reclassifying its
purpose from an incidental README or directory name — regardless of
what `p2p/` actually contains, it is architecturally isolated (a
separate repository, never staged, never imported) and this Arc's own
"Core Persistence Rule" and "P2P Ontology Engine Boundary" sections make
the correct handling identical either way: it is not, and cannot become,
this Arc's own persistence backend.

## 4. Conclusion

No existing honest abstraction is duplicated by this Arc. The Secure
Runtime ciphertext storage stack is confirmed unsuitable by TYPE, not
mere preference, and is not reused, extended, or modified. The D1
metadata index is confirmed to solve a different (non-authoritative)
problem and is not reused. `StorageBackend` remains inert and unbuilt-on.
`FedosBoardModerationRecord` has no persistence path yet and this Arc
does not add one (moderation persistence stays explicitly out of scope,
Alpha 320 §4). `p2p/` is confirmed isolated and untouched. New files are
placed under `src/board/persistence/` (this Arc's own required
directory) — no existing location in this repository was found to be a
better fit.

## 5. See also

- `docs/secure_runtime_alpha_310_board_repository_completion.md`
- `docs/secure_runtime_alpha_301_existing_board_repository_inventory.md`
- `docs/secure_runtime_alpha_019_secure_storage_foundation.md`
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md`
- `docs/secure_runtime_alpha_258_moderation_deletion_boundary.md`
