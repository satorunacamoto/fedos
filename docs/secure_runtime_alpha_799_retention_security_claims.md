# Secure Runtime Alpha 799 — Retention Security Claims

Stage 9. The load-bearing contract `FedosPayloadRetentionAuthority`'s
own behavior must never exceed (restated verbatim from that file's own
header comment, which is the normative source):

## May claim

- The application will no longer return a tombstoned or payload-removed
  payload's bytes through `readPayload()` — a real, enforced, tested
  behavioral change
  (`test/secure_runtime_alpha_799_payload_retention_authority.test.ts`
  items 12–13).
- Local payload bytes can be considered removed from the ACTIVE READ
  PATH once `removeLocalPayload()` succeeds — the Authority's own gate,
  not a claim about the underlying backend's raw storage.

## Must not claim

- Secure physical overwrite, SSD erasure, cloud backup deletion, remote
  peer deletion, cryptographic erasure without a key lifecycle (none
  exists in this Arc), or worldwide deletion.

`removeLocalPayload()` records an ACCESS-STATE transition only —
`FedosConversationPayloadStorage` (Alpha 804) has deliberately no
delete method, so the underlying backend's own raw bytes are NOT
guaranteed physically removed. For the append-only backend (Alpha 809)
specifically, the byte-carrying JSON line remains on disk (matching
every append-only backend's own "no delete/rewrite/compaction"
discipline in this codebase) — confirmed directly,
`test/secure_runtime_alpha_799_payload_retention_authority.test.ts`
item 15: the raw port still returns the bytes after `removeLocalPayload()`,
proving the claim is scoped to the Authority's own gate, not the
backend's storage.

A future Arc choosing a backend capable of real byte deletion (e.g.
one file per payload, Alpha 808's Option C) could strengthen this claim
for that backend specifically; this Arc does not.
