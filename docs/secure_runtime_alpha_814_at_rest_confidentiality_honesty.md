# Secure Runtime Alpha 814 — At-Rest Confidentiality Honesty

Stage 24. **This storage is not encrypted unless bytes supplied are
already encrypted.** Verified by real behavior, not merely asserted:
plaintext bytes written through the append-only backend are recoverable
byte-for-byte after a restart
(`test/secure_runtime_alpha_814_at_rest_confidentiality_honesty.test.ts`
item 1) — proving no silent encryption occurs anywhere in this Arc.

- **Opaque does not equal encrypted.** `mediaType: "application/octet-stream"`
  (Alpha 803) makes no confidentiality claim of any kind.
- **Filesystem metadata leaks.** File mtimes/size are visible to
  anything with filesystem access — unaddressed by this Arc, matching
  SEC §07's own identical finding for Conversation persistence
  (`docs/reviews/private_conversation_security/07_at_rest_storage.md`).
- **Descriptor leaks Conversation linkage and timing.** Confirmed
  directly — `conversationId`/`createdAt` appear in plain text in the
  durable log
  (`test/secure_runtime_alpha_814_at_rest_confidentiality_honesty.test.ts`
  item 2).
- **OS permissions remain external.** No `chmod`/file-permission
  hardening is implemented — matching the same gap SEC §07 already
  found in Conversation/Board persistence.
- **Future Envelope/Encryption must run BEFORE storage.** This
  boundary's own job stops at "store whatever bytes you're given, make
  no claim about them" — confirmed structurally: no `encrypt(`/
  `decrypt(`/`AeadKey`/`CryptoProvider`/cipher-name reference exists
  anywhere in `src/conversation/retention/` or
  `src/conversation/payload_storage/` (item 3), and no key/nonce/AAD
  field exists on the wire record (item 4).

**No silent encryption with an invented key** — this Arc introduces no
key generation, no key storage, and no cipher of any kind.
