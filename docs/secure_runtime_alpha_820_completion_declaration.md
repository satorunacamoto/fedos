# Secure Runtime Alpha 820 — Conversation Retention & Private Payload Storage Boundary Foundation Completion

Alpha 791–820 builds the safe storage and retention foundations needed
before private messages can exist — the bottom two boundaries of the
target architecture (Opaque Payload Reference → Private Payload
Storage → Retention/Tombstone Authority), built on the completed Alpha
741–760 Conversation Identity/Record Foundation. Independently
mergeable from Alpha 761–790 (not depended on, per this Arc's own
precondition).

## What is complete

- **Honest retention vocabulary** — eight named deletion meanings
  (Alpha 792), only three genuinely V1-enforceable
  (`application-hidden`/`logically-tombstoned`/`local-payload-removed`),
  never one generic boolean.
- **Retention transition rules** — `active → tombstoned →
  payload-removed` only; every reverse/skip transition surfaces
  `"conflict"`; no restore method exists, of any kind (Alpha 798).
- **Payload descriptor** — `FedosConversationPayloadDescriptor` (Alpha
  803), metadata-only, closed `mediaType` vocabulary of exactly one
  value, no plaintext/algorithm/author/membership field.
- **Dedicated storage port** — `FedosConversationPayloadStorage` (Alpha
  804), no delete method, defensive byte copies on both write and read.
- **In-memory backend** — `InMemoryFedosConversationPayloadStorage`
  (Alpha 807).
- **Durable zero-dependency backend** — `AppendOnlyFedosConversationPayloadStorage`
  (Alpha 809), base64-at-the-persistence-boundary-only codec (Alpha
  806), explicit required `maxPayloadByteLength`.
- **Corruption/restart behavior** — fail-closed on any malformed or
  conflicting record; state (including retention decisions) verified
  to survive a real restart cycle (Alpha 812/819).
- **Tombstone enforcement** — `FedosPayloadRetentionAuthority.readPayload()`
  genuinely denies normal reads once tombstoned (Alpha 796/799/811).
- **Optional local payload removal** — implemented as an honest,
  conditional access-state transition (Alpha 799); the underlying
  append-only backend's own bytes are NOT claimed physically erased.
- **Conversation isolation** — no cross-conversation listing leak;
  storage is explicitly NOT claimed to be a complete authorization
  system (Alpha 813).
- **No false encryption/deletion claims** — verified by real behavior
  (plaintext round-trips unchanged, Alpha 814) and by structural scan
  (no crypto/erasure vocabulary in code, Alpha 818).
- **No duplication of Conversation persistence** — `FedosConversationRecord`,
  its persistence, Board persistence, `FedosBoardRuntime`, and
  `startFedosDesktopRuntime()` are all confirmed byte-for-byte
  untouched (Alpha 816).

## Verification

- `npx tsc --noEmit` — zero new error (the one pre-existing, unrelated
  error in `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`
  remains, confirmed present before this Arc began).
- 12 new test files, 121 tests, all passing.
- Production changes confined to `src/conversation/retention/` (7 new
  files) and `src/conversation/payload_storage/` (7 new files) — zero
  modification to any existing file. No Rust/Cargo change, no new
  dependency, `p2p/` untouched.

## Remaining blockers (confirmed, not assumed)

Private message envelope; encryption/WASM export; key distribution;
Membership authorization; Capability invitations; private Conversation
construction (`private-group`/`direct`); cryptographic erasure;
compaction; remote deletion; backup deletion; GUI/Worker; protocol
mapping. None of these is referenced anywhere under this Arc's own new
modules (Alpha 818).

## Next Arc recommendation — exactly one

**Durable Membership & Capability Persistence Foundation Arc** — NOT
the Private Message Envelope & Encryption Authority Boundary Arc.

This Arc's own findings (Alpha 813, 815) confirm storage and retention
are now real, but Membership prerequisites are NOT sufficiently
defined: no `FedosConversationMembershipAuthority` exists anywhere
(confirmed unchanged since the prior Arc's own identical finding,
`docs/secure_runtime_alpha_760_completion_declaration.md`), and
`validateFedosConversationPolicy()` (Policy Arc, unmodified) still
rejects `writeAccess: "restricted"` for exactly that reason. A Private
Message Envelope needs a real sender/recipient authority to address a
message TO — which only a real Membership model can provide; building
the Envelope first would either fake that authority (explicitly
forbidden) or leave the Envelope's own most basic field
(who-can-read-this) unaddressable. Per the approved Conversation
Foundation V1 review's own `14_arc_packaging.md`, Package B
(Membership + Capability) may proceed in parallel with Package D
(Storage + Retention, now complete) — but Package C (Private Envelope +
Encryption Authority) explicitly depends on Package B's REAL output,
not merely its interface shape. Membership is therefore the correct,
load-bearing next step; the Envelope Arc should follow only once it
exists.
