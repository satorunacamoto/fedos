# Secure Runtime Alpha 180 — Nostr Public Identifier Runtime Boundary Completion

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 5, the closing Stage, of the Alpha 176–180 Nostr Public
Identifier Runtime Boundary Arc.**

## 1. Why now

Alpha 176 reviewed the origin of `publicIdentifier` and resolved the
Alpha 039 §3 tension against the Alpha 146–170 chain. Alpha 177 chose
hex as the Runtime-internal canonical representation. Alpha 178
decided Desktop's own presentation latitude. Alpha 179 confirmed the
Identifier abstraction already generalizes to Session/ATProto/Wallet.
This Stage issues the Arc's own closing Completion Declaration,
formally FREEZES the Boundary this Arc reviewed, and recommends
exactly one next Arc.

## 2. The Boundary, as this Arc leaves it — one diagram, four frozen
   decisions

```
FedosNostrPublicIdentitySnapshot (external, caller-supplied)   [Alpha 039 — UNCHANGED, reconfirmed Alpha 176 §2/§6]
        │  Source Boundary (Interface + injected implementation)
        ↓
FedosNostrPublicIdentitySource.readPublicIdentity()
        │  verbatim copy, no reformatting                       [Alpha 039 §6 — UNCHANGED]
        ↓
FedosIdentityDescriptor.publicIdentifier : string
        │
        ├──→ NostrIdentityProvider (Identity Layer)              [Alpha 035/039/046 — UNCHANGED]
        └──→ NostrPublicIdentityReader (Desktop Layer)            [Alpha 103 — UNCHANGED]

-- separately, still fully disconnected from the above today --

FedosMasterSeedHandle → ... → FedosNostrPublicKeyHandle            [Alpha 146-170 — UNCHANGED]
        │  nostr_identifier_encoding (Alpha 173, pub(crate)-only)
        ↓                                                ↓
FedosNostrPublicKeyHex ── RUNTIME-CANONICAL (Alpha 177)   FedosNostrNpub ── DESKTOP-DEFAULT DISPLAY (Alpha 178)
```

**Four decisions this Arc formally FREEZES:**

1. **Origin (Alpha 176):** `publicIdentifier`'s ONE legitimate origin
   remains the Source Boundary (Alpha 039) — a caller-supplied,
   externally-controlled snapshot, never a value this crate computes
   or derives. Alpha 039 §3's "never derive from a held private key"
   ceiling does NOT categorically forbid a future Source built on the
   deterministic chain (Alpha 176 §4) — but no such Source is proposed
   or built by this Arc, and building one remains a distinct, future,
   separately-reviewed product decision.
2. **Runtime-canonical form (Alpha 177):** hex
   (`FedosNostrPublicKeyHex`) — the form any future Runtime/protocol-
   level consumer should reach for by default, matching
   `NostrEvent.pubkey`'s own existing shape with zero conversion.
3. **Desktop latitude (Alpha 178):** Desktop MAY expose hex, `npub`,
   or both, at its own future discretion — `npub` remains the
   recommended DEFAULT for human-facing display, non-binding.
4. **Extensibility (Alpha 179):** the Descriptor shape, the Source
   Boundary pattern, and the `HkdfDomain` separation scaffold all
   already generalize to Session/ATProto/Wallet with zero Runtime-side
   protocol-specific logic; the concrete Nostr TYPES/PARAMETERS
   (`FedosNostrPublicKeyHex`/`FedosNostrNpub`, the fixed `"npub"` HRP,
   the lowercase-hex rule) must never be reused for any of the three.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. The Runtime Boundary
for Nostr Public Identifiers — where `publicIdentifier` originates,
which string form Runtime treats as canonical, how much latitude
Desktop has to format it, and whether the abstraction survives future
protocols — has been reviewed end to end and FROZEN as the four
decisions in §2, with ZERO new Cargo dependency, ZERO new npm
dependency, ZERO new cryptographic algorithm, ZERO new
`#[wasm_bindgen]` export (fixed at 13), ZERO new `pub fn` (fixed at
36), ZERO GUI, ZERO Relay, ZERO Event construction, ZERO Schnorr
signing, ZERO Worker change, ZERO `AppRuntime` change, ZERO Storage
change, ZERO Observation change, and ZERO change to any existing
public API, across all five Stages of this Arc.**

**The following do NOT exist yet, exactly as this Arc's own rules
require:**

- **A Public Runtime API for either identifier form** — `FedosNostrPublicKeyHex`/
  `FedosNostrNpub` remain `pub(crate)` only (Alpha 176 §5, Alpha 177
  §6, unchanged).
- **Any Source implementation feeding a Nostr-derived value** —
  `NullNostrPublicIdentitySource` remains the only production-wired
  Source (Alpha 176 §2).
- **Any Desktop rendering of `publicIdentifier` in any form** — this
  Arc contains no GUI code, per its own rule.
- **A `Session`/`ATProto`/`Wallet` Root, Secret Key Handle, Public Key
  Handle, or Encoder** — `HkdfDomain`'s ten variants and
  `SecretHandleKind`'s thirteen variants are both unchanged (Alpha 179
  §8).
- **`nsec`, Secret Key export/import, Schnorr signature, Nostr Event,
  Event ID, Relay communication, WebSocket, DM** — all remain absent,
  unchanged from Alpha 175 §5's own identical list, reconfirmed here
  by direct inspection, not by re-citation alone (Alpha 176 §7, Alpha
  179 §8).

**No further review stage should be added for THIS topic — the
Runtime Boundary for Public Identifiers.** This Arc's own five Stages
(origin, Runtime-canonical form, Desktop latitude, extensibility,
completion) exhaust the Objective's own four named review questions;
a sixth Stage revisiting any of them without a NEW concrete finding
would be re-review for its own sake, which this repository's own
established discipline (Alpha 175 §5's identical closing pattern) has
consistently avoided.

**This freeze binds the BOUNDARY's shape, not any future WIRING
Stage's own freedom to implement within it** — exactly as Alpha 172
§7/Alpha 175 §3 already established for the Encoding Arc's own
recommendations: a future Stage that actually builds a Nostr-derived
Source, exposes a Public Runtime API, or renders `publicIdentifier` in
Desktop remains free to do so, within the four frozen decisions above,
without this Arc's own further involvement or re-review.

## 4. Next Arc recommendation — one candidate

**Nostr Schnorr Signing Boundary Review.** Alpha 175 §5 already named
this as the live future candidate, deliberately not recommended next
at that time, "absent a concrete blocking need." That reasoning no
longer applies at the SAME strength: the Public Identifier chain
(Master Seed through hex/`npub`) is now not only built (Alpha 175) but
also has its own Runtime Boundary reviewed and frozen (this Arc) —
Signing is the next capability in the SAME dependency order the
original Nostr arcs have followed throughout (Root → Secret Key →
Public Key → Identifier → Signing → Event), and no other Nostr-
adjacent Boundary remains unreviewed ahead of it. As with every prior
"Review" Arc in this lineage, a Signing Boundary Review would itself
precede any actual signing implementation, consistent with this Arc's
own "avoid implementation absent proven need" instruction.

## 5. What this Stage does NOT do

- Does **not** modify `packages/fedos-core-rust/src/lib.rs` — no
  further production code change, this Arc-wide.
- Does **not** wire any Public Runtime API, Source, or Desktop
  rendering — §3's own four frozen decisions are Boundary shape, not
  implementations.
- Does **not** implement `nsec`, Schnorr signing, Events, Relay
  communication, or a Decoder.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `src/nostr/*`, `create_runtime.ts`, `types.ts`, `worker.ts`, Storage,
  Observation, any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_179_nostr_identifier_protocol_extensibility_review.md`
- `docs/secure_runtime_alpha_178_nostr_desktop_presentation_review.md`
- `docs/secure_runtime_alpha_177_nostr_runtime_canonical_identifier_decision.md`
- `docs/secure_runtime_alpha_176_nostr_public_identifier_origin_review.md`
- `docs/secure_runtime_alpha_175_nostr_public_identifier_completion.md`
