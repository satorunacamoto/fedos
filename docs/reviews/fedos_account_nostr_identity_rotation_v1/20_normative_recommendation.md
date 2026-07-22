# 20 — Normative Recommendation

This document is the binding synthesis of `01`-`19`. Every item below is
a decision, not an option left open.

## Whether account identity rotates in V1

**No.** Account identity does not rotate. There is no live or
recommended mechanism by which the same logical account identity
continues under a new cryptographic key (`05`, `06`, `18`).

## Whether Nostr identity rotates in V1

**No** — for the same reason, because account identity and Nostr
identity are the same value in this codebase today (`04`, `05`). This
review does not analyze them as separable questions.

## Rotation vs. replacement model

**Replacement, never rotation.** When an account/Nostr identity must
change (compromise, catastrophic loss, or a deliberate user choice), the
model is: create an entirely new identity (new Master Seed, new
profile), and OPTIONALLY issue an explicit, evidence-leveled continuity
claim linking it to the predecessor identity (`06`, `18` — Option G).

## Authorization/evidence model

**Model H (`07`): hybrid, closed evidence levels, never a boolean.**
Three levels: `"unlinked-replacement"` (no linkage evidence),
`"old-identity-signed"` (old account key signed the claim — weakest
linkage evidence, `09`), `"old-identity-and-device-evidence"` (old
account key AND a currently-trusted Device independently attest —
strongest V1 evidence, `07`-`09`). Multi-Device quorum is named and
explicitly deferred (no primitive exists).

## Compromised-old-key behavior

An old-identity signature alone **never** proves the claim is legitimate
under a compromise assumption (`09`). When the old identity is
known/suspected compromised, the correct, honest response is
`"unlinked-replacement"` — no continuity claim, full manual
re-establishment of peer trust. Device evidence raises the bar but is not
claimed sufficient on its own (`08`, `09`).

## Device migration model

**Option C (`11`): rebind Devices through explicit authorization.**
Every Device must independently complete a fresh, real Account-to-Device
authorization challenge under the new account identity. No Device label
or `deviceId` match ever grants automatic trust. Old Device Bindings are
independently revoked, never silently reused.

## Ratchet session behavior

**Strong default, adopted (`12`): identity Replacement terminates every
active Direct Ratchet session bound to the old identity and requires
brand-new, authenticated Device-pair sessions under the new identity.**
Historical plaintext remains locally readable via Archive. Root/chain
keys are never rebound to a new identity. A new, additive Session Reset
reason value is required for a future Arc; not built here.

## Conversation continuity model

**Option A for Direct Conversations (`13`): preserve the existing
`FedosConversationId`, add an explicit, opt-in identity-transition
history.** The old Membership record is preserved immutably; a new
Membership is created only once a receiving peer's own local policy
reaches `"locally-accepted"`. A new, additive Membership state is named
for a future Arc. Group Conversation continuity is explicitly deferred.

## Archive/history policy

Historical messages, signatures, and identity references are never
rewritten (`14`). Archive Restore never establishes trust in any
identity, old or new. Search associates old/new identities only through
an explicit, locally-accepted transition fact — never inferred.

## Master Seed policy

**No Master Seed replacement that preserves account identity is built or
recommended — any new Master Seed event is treated as a full identity
Replacement (`15`).** Passphrase rotation (same seed, new wrapping
secret) is identified as a genuinely separate, low-risk, identity-preserving
operation worth its own future, narrowly-scoped Arc — not bundled with
identity rotation, not built here. Recovery remains `restoreSealed()`,
unchanged. No raw secret is ever exported through TypeScript.

## Peer notification model

Reuses `d825aa0`'s live, authenticated, evidence-only, private-transport
peer-capability/lifecycle-notification pipeline verbatim, extended with
new additive fact kinds (`16`): `identity-transition-advertised`,
`identity-transition-verified`, `identity-transition-conflicting`,
`old-identity-superseded`, `peer-reverification-required` (plus the
already-existing `ratchet-reset-required` recommendation). No new Nostr
kind, no public event. First-contact/peers-who-only-know-the-old-identity
is an honestly disclosed, unclosed gap (`16`).

## Rollback/conflict model

Monotonic, fact-kind-scoped revision counters; explicit
previous-transition references forming a verifiable, acyclic chain;
durable `"conflicting"`/`"stale"`/`"rollback-detected"`/`"superseded"`
states; no automatic downgrade of an already-accepted transition; no
silent merge of conflicting identities' histories (`17`).

## Explicit non-goals

- No account/Nostr key rotation (in-place identity continuity under a
  new key) is built, ever, in this review's own recommendation.
- No Master Seed replacement preserving account identity.
- No multi-Device quorum authorization primitive.
- No new NIP number, no public unencrypted transition event.
- No automatic trust, route activation, or Ratchet-session mutation from
  any transition claim alone.
- No Group Conversation continuity model.
- No recovery-code/passphrase-independent recovery secret.
- No live implementation of ANY of the above in this Arc — this is a
  specification-only review with an empty production diff.

## Exact implementation sequence

As specified in `19`: (1) Identity Transition types/validation/durable
facts, (2) local authorization/evidence policy, (3) peer notification
integration, (4) Ratchet termination/reset integration, (5) Device
rebind/reverification, (6) Conversation continuity mapping, (7)
Archive/Search compatibility, (8) UI/manual verification, (9) Group
support (deferred indefinitely).

## Exact next Arc

**FedOS Identity Transition Types, Validation, and Durable Evidence
Foundation Arc.**
