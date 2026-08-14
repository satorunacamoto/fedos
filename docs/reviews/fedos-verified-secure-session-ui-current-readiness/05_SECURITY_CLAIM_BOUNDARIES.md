# Security Claim Boundaries

Per mandate §7/§52: for every visible string, "What exact code/runtime
fact proves this? If no exact fact: weaken/remove the claim." Agent R's
Part 4 (`07_TEST_MATRIX.md`) confirmed zero forbidden-claim strings exist
today — this document is the forward-looking boundary for the NEW copy
this arc adds.

## Forbidden (never write these, per mandate §7)
"Fully secure" · "End-to-end verified" · "Identity verified" · "All
devices verified" · "Forward secrecy active" (as an unqualified claim —
only ever true per-message/per-route, see below) · "No one can intercept"
· "Anonymous" · "Safe" (as a standalone claim).

## Allowed factual claims, one per axis, exact wording used in implementation

- `IDENTITY_CONTINUITY: good` → "Same identity as when this contact was
  first added to this conversation — no unexplained change observed."
- `IDENTITY_CONTINUITY: attention` (auto-accepted) → "This contact's
  identity changed and FedOS accepted the new key automatically, without
  asking you. Confirm with them out of band that they really did change
  identity."
- `IDENTITY_CONTINUITY: attention` (unresolved) → "This contact's identity
  changed and is waiting for your review."
- `IDENTITY_CONTINUITY: unknown` → "FedOS has no history for this
  contact's identity yet."
- `ENCRYPTION: good` → "A Direct Ratchet session is active for this
  conversation."
- `ENCRYPTION: attention`/`unavailable` → exact `FedosDirectRatchetSafeStatus`
  mapping, e.g. "reset-required" → "The secure session for this
  conversation needs to be re-established."; "unsupported"/"unavailable" →
  "Direct Ratchet is not available for this conversation."
- `FORWARD_SECRECY: good` → "Messages are sent through the Ratchet — a
  later key compromise would not expose them."
- `FORWARD_SECRECY: attention` → "Messages in this conversation do NOT
  currently have forward secrecy — a later key compromise could expose
  them." (capital NO preserved from the historical precedent, confirmed
  by Agent H as the deliberate, disciplined shipped wording)
- `DEVICE_KNOWLEDGE: good` → "The peer device(s) this conversation has
  used are trusted."
- `DEVICE_KNOWLEDGE: unknown` → "FedOS has not observed a device for this
  contact yet."
- `EVIDENCE_INTEGRITY: attention` → exact rejection reason surfaced
  verbatim from the domain layer (e.g. "A recent security event for this
  contact could not be verified and was rejected.").
- `METADATA_EXPOSURE: not-protected` (always) → "Relays can see that this
  conversation is happening. Encryption does not hide that."

## Standing limits (shown always, regardless of axis state — never omitted)
- "FedOS has no safety number. There is no code you and your contact can
  compare." (reused verbatim from the historical precedent, re-confirmed
  still true by Agent C Item 8.)
- "This app does not know about, list, or verify all of a contact's
  devices — only devices it has directly observed."
