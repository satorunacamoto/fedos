# Secure Runtime Alpha 793 — V1 Retention Contract Decision

Stage 3. Compares:

**A. No deletion, retain forever.** Rejected — gives no answer at all
to the reviewed requirement that a user be able to act on a stored
payload; leaves `logically-tombstoned`/`local-payload-removed` (Alpha
792) both unimplemented for no real reason.

**B. Logical tombstone only.** A real, defensible V1 on its own — but
leaves `local-payload-removed` unaddressed even though it is genuinely
achievable (as an access-state transition, Alpha 799) with only a
little more work.

**C. Tombstone + optional local payload removal.** ADOPTED. Both
transitions this Arc's own backends can genuinely support:
`FedosPayloadRetentionAuthority.tombstonePayload()`/`removeLocalPayload()`
(Alpha 796–799). "Optional" because `removeLocalPayload()` is a
distinct, separately-callable operation — a caller may tombstone
without ever removing, matching the real, distinct authorities SEC §08
names for the two meanings.

**D. Automatic physical compaction.** Rejected outright — this Arc's
own Absolute Prohibition forbids it; also contradicts the append-only
backends' own "no compaction" hard guardrail (Alpha 752/809).

## What is never promised

No remote deletion, no backup erasure — confirmed nowhere in this
Arc's own claims (Alpha 799's own "must not claim" list), and
structurally impossible to promise: no federation delivery of private
content and no backup system exist anywhere in this codebase (Alpha
791 findings 4/7 by omission).
