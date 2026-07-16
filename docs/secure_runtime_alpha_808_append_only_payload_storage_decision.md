# Secure Runtime Alpha 808 — Append-Only Payload Storage Decision

Stage 18. Compares:

**A. Payload bytes inline in JSON Lines (base64-encoded).** ADOPTED.
One `FedosPersistedConversationPayloadV1` record per line, mirroring
`AppendOnlyFedosConversationPersistence`'s own exact NDJSON discipline
(Alpha 752). Smallest, zero-dependency V1; no path-traversal surface
at all — a single log file, no per-payload filename ever derived from
a payload id.

**B. Metadata log + separate blob files.** A real future upgrade path
for larger payloads — noted, not built. This Arc's own instruction:
"do not overbuild without current requirements"; no real private-message
content exists yet to size against.

**C. One file per payload.** Rejected for V1: would need a
payload-id-to-filename mapping and its own path-traversal defense
surface, when Option A already avoids the problem entirely for typical
V1 payload sizes.

**D. Reuse the Conversation log.** REJECTED per this Arc's own Absolute
Prohibition — never duplicate/conflate Conversation metadata
persistence with payload bytes (confirmed,
`test/secure_runtime_alpha_816_no_duplication_guard.test.ts`).

## Evaluated against

- **Simplicity** — Option A is the simplest: one file, one codec,
  already-established backend shape.
- **Crash behavior** — identical to every other append-only backend:
  fail closed, no repair (Alpha 809).
- **Path traversal** — a non-issue for Option A (no per-id filename is
  ever constructed); confirmed structurally,
  `test/secure_runtime_alpha_818_structural_security_guards.test.ts`
  item 9.
- **Large payloads** — Option A is not optimized for this; Option B is
  named as the future answer if/when a real size requirement emerges.
- **Compaction** — none, by design (Absolute Prohibition).
- **Corruption** — fail closed, identical policy to every other backend.
- **Future encryption** — orthogonal; the codec (Alpha 806) neither
  helps nor hinders a future Envelope layer choosing to supply
  already-encrypted bytes.
- **Cleanup** — none exists; matches this Arc's own "no automatic
  compaction" prohibition.
