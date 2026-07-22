# FedOS Account and Nostr Identity Rotation V1 — Specification Review

Specification-only. Zero production diff. Base: `d825aa0`
(`arc/ratchet-peer-notification-capability-advertisement`). Worktree:
`C:\wt\account-nostr-identity-rotation-review`. Branch:
`review/fedos-account-nostr-identity-rotation-v1`.

## Why this review exists now

`d825aa0`'s own completion declaration named this review's exact title as
its recommended next step. It is also the review `3ebfa37` ("FedOS Direct
Ratchet Multi-Device Session Lifecycle and Identity Rotation V1
Specification Review") itself deferred: `3ebfa37` §10/§11 already
concluded account/Nostr identity should remain immutable in the Arc it
was scoping (the Ratchet Device Lifecycle Foundation, `f80889d`), and
explicitly left a full identity-rotation decision for later. Two live
Arcs have shipped since `3ebfa37`: `f80889d` (authenticated Session Reset)
and `d825aa0` (peer capability advertisement / Device lifecycle
notification). This review re-examines the question with those two new
capabilities actually available as real, live source — not as an
independent redecision, but as this repository's own next required step.

## Normative inputs (read-only; nothing here is merged)

| Commit | Title | Role |
|---|---|---|
| `d825aa0` | FedOS Ratchet Peer Notification and Capability Advertisement Arc | Base; live peer-capability/lifecycle-notification layer |
| `f80889d` | FedOS Ratchet Device Lifecycle and Authenticated Session Reset Foundation Arc | Live Session Reset Authority/Coordinator, Device Lifecycle, Device Replacement |
| `b8e9e06` | FedOS Direct Double Ratchet Conversation Runtime and NIP-17 Integration Arc | Live Direct Ratchet integration |
| `080cb99` | FedOS Direct Double Ratchet Cryptographic Core Arc | Real WASM ECDH/HKDF/AEAD ratchet primitives |
| `be1bc0d` | FedOS Direct Ratchet State and Sealed Persistence Foundation Arc | Session identity/lifecycle/sealed-secret foundation |
| `3ebfa37` | FedOS Direct Ratchet Multi-Device Session Lifecycle and Identity Rotation V1 Specification Review | The prior decision review this Arc extends; named `f80889d` as its own next Arc |
| `b34d608` | FedOS Forward Secrecy, Key Rotation, and Direct Double Ratchet V1 Specification Review | Predecessor review; independent Device identity + no-in-place-rotation findings |
| `e4bb0b0` | Security Goals and Threat Model | No forward secrecy claim, Master-Seed-leak-uncontained fact, Fail-Closed convention |
| `406c144` | Secure Memory Runtime Architecture | Secret Buffer single-owning-scope rule |
| `d227ae4` | Crypto Runtime Architecture V1 | Names identity as a `unlock_trigger_placeholder`; recommends the forward-secrecy review that became `b34d608` |
| `d62090f` | Nostr Secure Messaging Architecture V1 | Confirms no Direct-conversation key rotation exists; Sender-Key `rotateEpoch()` (unmerged) provides no forward secrecy |

Read-only, unmerged, historical: `review/sender-key-rotation-v1` (`41da82d`,
Group/Sender-Key epoch rotation — a different identity layer, kept
separate per `3ebfa37` §03); `arc/signed-recipient-deletion-request-state-foundation`
(`22f9277`, unmerged — inspected only for authorship-identity coupling).

## Document map

01. Current identity inventory (lineage table)
02. Security goals and threat alignment
03. Identity layer taxonomy
04. Current account identity model
05. Current Nostr identity model
06. Rotation vs. replacement vs. recovery vs. migration vs. alias
07. Rotation authorization models
08. Old-key and new-key proof
09. The compromised-old-key problem
10. Peer acceptance and trust model
11. Device migration
12. Ratchet session transition
13. Conversation and Membership continuity
14. Archive, history, and Search
15. Master Seed replacement
16. Peer notification and capability update
17. Rollback, downgrade, and split-brain
18. Option comparison
19. Implementation Arc packaging
20. Normative recommendation

## One-paragraph verdict

Account identity and Nostr identity do **not** rotate in V1 — they remain
the single, immutable value they are today (`3ebfa37`'s Option 1,
reaffirmed). What this review adds, now that a real Session Reset and a
real peer-capability/evidence layer both exist, is a complete, closed
specification for **replacement**: an account/Nostr identity that must
change (compromise, catastrophic loss) always produces a brand-new
identity, never an in-place key change, authenticated by the strongest
evidence actually available (old-identity signature plus, where present,
trusted-Device evidence — never old-key-signature alone), with Device
migration modeled as explicit rebind-with-reverification (never automatic
label-matching), Ratchet sessions always reset (never rebound), and peer
acceptance modeled as evidence, never automatic trust — reusing every
closed-vocabulary/evidence-level/durable-observation pattern `f80889d`
and `d825aa0` already established rather than inventing new primitives.
The first implementation Arc builds only the types, validation, and
durable evidence layer — no live migration ships until a later Arc.
