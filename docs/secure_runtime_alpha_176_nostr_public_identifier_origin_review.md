# Secure Runtime Alpha 176 — Nostr Public Identifier Origin Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 1 of the Alpha 176–180 Nostr Public Identifier Runtime Boundary
Arc, following the completed Nostr Public Identifier Encoding Arc
(Alpha 171–175), which built a deterministic hex/`npub` Encoder
entirely `pub(crate)`, and recommended (Alpha 175 §5) exactly this
Arc as the next, lower-risk step before any Signing capability.**

## 1. Why now

Alpha 175 §3 closed with three still-UNWIRED recommendations for
`FedosIdentityDescriptor.publicIdentifier`, and Alpha 171 §2.9 already
found the field "externally sourced, untouched by this crate." Before
this Arc freezes anything, this Stage re-verifies both claims directly
against the CURRENT repository state — not by re-citing Alpha 171/175,
but by re-reading the actual current source — and, separately,
resolves a design tension neither Alpha 171 nor Alpha 175 examined:
whether the Alpha 146–170 deterministic Master-Seed → Nostr-key chain
is even a candidate origin for this field, given Alpha 039's own
permanent "never derive identity from a secret key" ceiling.

## 2. Where the value originates today — re-verified, not assumed

Tracing `publicIdentifier` from its Descriptor declaration down to its
one real write site, by direct inspection of the current file
contents:

```
FedosIdentityDescriptor.publicIdentifier            (src/identity/fedos_identity_descriptor.ts)
        ↑ copied verbatim, unvalidated reformatting
NostrIdentityProvider.describeIdentity()             (src/identity/fedos_nostr_identity_provider.ts)
        ↑ copied verbatim from snapshot.publicIdentifier
FedosNostrPublicIdentitySnapshot.publicIdentifier    (src/identity/fedos_nostr_public_identity_source.ts)
        ↑ resolved by whichever Source is injected
FedosNostrPublicIdentitySource.readPublicIdentity()
        ↑ today, always NullNostrPublicIdentitySource → null
          (in production; StaticNostrPublicIdentitySource, Alpha 108,
          exists as a second implementation, holding a
          caller-SUPPLIED snapshot verbatim, wired into nothing)
```

The SAME shape repeats one layer up, independently, for Desktop:
`DesktopApplication.currentPublicIdentity()`/`readPublicIdentity()`
(Alpha 121/127/128) delegate to `NostrPublicIdentityReader`
(`src/desktop/nostr_public_identity_reader.ts`, Alpha 103), which
performs the IDENTICAL validated copy from the SAME
`FedosNostrPublicIdentitySnapshot` shape — a deliberately duplicated
mapping (Alpha 103's own doc comment: "so this class stays entirely
independent of the Identity Layer's own internal Provider/Service/
Registry pipeline"), not a second origin.

**Confirmed: `publicIdentifier` has exactly ONE kind of origin today
— a caller-supplied `FedosNostrPublicIdentitySnapshot`, injected
through the Source Boundary (Alpha 039). No code path anywhere in
`src/` computes, derives, or encodes `publicIdentifier`'s own value.**
`grep -rn "publicIdentifier\s*=" src/` (excluding object-literal field
assignment `publicIdentifier: snapshot.publicIdentifier` /
`publicIdentifier: descriptor.publicIdentifier` — verbatim pass-
through, not computation) finds zero assignment from any derived or
computed expression.

## 3. Verified against the existing Runtime decisions — no drift

| Decision | Where decided | Still true today? |
|---|---|---|
| A Source Boundary, not inline Provider logic, is the sole legitimate origin | Alpha 039 §2 | Yes — `NostrIdentityProvider`/`NostrPublicIdentityReader` both still only ever call an injected Source, never compute a value themselves |
| Identity is NEVER derived from a secret key, even momentarily held | Alpha 039 §3 | Yes — confirmed again in §4 below, now cross-checked against the Alpha 146–170 chain specifically, which did not exist when Alpha 039 was written |
| No fixed/dummy npub is ever fabricated | Alpha 039 §4 | Yes — `NullNostrPublicIdentitySource` remains the only production-wired Source, always resolving `null`; `StaticNostrPublicIdentitySource` (Alpha 108) exists but is wired into nothing |
| `publicIdentifier` remains externally sourced, untouched | Alpha 171 §2.9 | Yes — reconfirmed by §2's own fresh trace above, not merely re-cited |
| Three recommendations (`npub` for the field, hex-or-bytes for protocol-internal, `npub` for Desktop display) are NOT binding | Alpha 175 §3 | Yes — none of the three has been wired; this Arc's own Alpha 177/178 treat them as inputs to reconsider, not as already-decided |

No drift is found. The current implementation is BYTE-FOR-BYTE
consistent with every prior Stage that touched this field.

## 4. The design tension — Alpha 039 §3 vs. the Alpha 146–170 chain

Alpha 039 §3 forbids deriving a public identifier from a private key
"even momentarily held" at the Source/Provider layer, for three
reasons: (1) this repository never built key generation/derivation
there, (2) doing so would require HOLDING a private key at that layer,
and (3) "what public identity is available" and "what private key
produces it" are cleanly separable questions. Five Arcs later
(Alpha 146–170), a DIFFERENT subsystem was built — a deterministic
Master Seed → Identity Root → Application Root → Nostr Root → Nostr
Secret Key → Nostr Public Key chain, entirely inside
`packages/fedos-core-rust/src/lib.rs`'s `master_root` module, wrapped
in Opaque `SecretHandle`s (Alpha 007 §6, Alpha 168 §4) that never
expose raw bytes across the Rust boundary. Alpha 173's Encoder then
added `encode_nostr_public_key_hex_internal`/`encode_nostr_npub_internal`,
taking a `&FedosNostrPublicKeyHandle` (a PUBLIC key handle, never a
secret one) and returning a `pub(crate)`-only string type.

**These are not the same operation Alpha 039 §3 forbade.** Alpha 039
§3's ceiling targets deriving a public value FROM A HELD PRIVATE KEY
at the TypeScript Source/Provider layer — a place this repository has
correctly never allowed private key material to reach at all
(confirmed again, directly: `grep -rn "SecretHandle\|secrecy\|zeroize"
src/` finds ONLY prohibition doc-comment mentions — "No `SecretHandle`,
..." denylist lines repeated across `src/runtime/*`'s own guardrail
comments, the SAME pattern Alpha 171 §2.3 already found for
`bech32`/`npub`/`nsec` — never an actual field, variable, or import
that HOLDS such material; no TypeScript file has ever held that kind
of value). The Alpha 146–170 chain instead derives a public key
from a secret key ENTIRELY INSIDE Rust's own Opaque-Handle system,
never exposing the secret bytes anywhere — the same pattern Alpha 168
§4 already uses for the (unrelated) existing `derive_nostr_public_key_internal`
call. Consuming that chain's OWN OUTPUT (a public key encoding) from a
future Source implementation would not require the Source to hold, or
even see, a private key — it would only ever see a string the Rust
boundary already finished deriving.

**This Stage's own finding: Alpha 039 §3 does NOT categorically forbid
a future Source built on top of the Alpha 146–170 chain.** It DOES
still forbid exactly what it always forbade — a Source/Provider that
itself performs key derivation, or that is handed raw secret bytes.
Whether such a future Source SHOULD be built is a separate product
question (self-derived, always-present FedOS identity vs. an
externally-linked account the user already controls, the ORIGINAL
justification in Alpha 039 §2/§7 for why the Boundary exists as
`FedosNostrPublicIdentitySource` rather than, say, a plain "Nostr
Identity Config" struct) — that question is explicitly OUT OF SCOPE
for this Stage and this Arc (no speculative architecture; this Arc
reviews the BOUNDARY, not whether to change what feeds it).

## 5. What blocks such a future Source today, independent of the
   product question in §4

Even setting aside §4's product question, no future Source could be
built on top of the Alpha 146–170/171–175 chain TODAY without first
adding a NEW capability this Arc's own rules forbid touching:

- The Encoder's own output types (`FedosNostrPublicKeyHex`,
  `FedosNostrNpub`) are `pub(crate)` (Alpha 172 §5) — unreachable
  outside `packages/fedos-core-rust/src/`.
- Zero `#[wasm_bindgen]` annotation exists on any function in the
  `nostr_identifier_encoding` module (Alpha 175 §5) — the crate's own
  WASM-exported surface is fixed at 13, confirmed unchanged again by
  this Stage (§7 below).
- `create_runtime.ts`/`types.ts`/`AppRuntime` expose no method that
  reaches the deterministic chain at all.

A future Source of this kind would first need its OWN, separately
reviewed Public Runtime API Stage — squarely the kind of "minimal
implementation" this Arc's own instruction says to avoid absent a
proven need, and no such need is proven here.

## 6. Answer to this Stage's own question

**Where SHOULD `publicIdentifier` originate in the completed
architecture?** Exactly where it originates today: a caller-supplied
`FedosNostrPublicIdentitySnapshot`, delivered through the Source
Boundary (Alpha 039), with the Boundary itself remaining agnostic to
WHERE a future concrete Source gets its data (a linked-account config,
a cached profile — Alpha 039 §1's own inventory — or, per §4 above, a
future Source wrapping the deterministic chain, IF a separate product
review ever decides FedOS should offer a self-derived identity as one
Source option among others). This Stage does not narrow that set of
future Sources, does not pick one, and does not wire anything — it
confirms the Boundary itself remains the correct, and only, seam.

## 7. Structural confirmation (real inspection, this Stage)

- `#[wasm_bindgen]` count in `lib.rs`: fixed at 13, unchanged.
- `pub fn` count in `lib.rs`: fixed at 36, unchanged.
- `src/identity/fedos_identity_descriptor.ts` still declares exactly
  `id`/`provider`/`publicIdentifier`/`displayName`/`avatar` — no new
  field.
- `src/identity/fedos_nostr_identity_provider.ts` and
  `src/desktop/nostr_public_identity_reader.ts` both still perform
  ONLY the Alpha 039/103 verbatim-copy mapping — no new transformation
  of `publicIdentifier`.

## 8. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** decide the Runtime canonical representation (hex vs.
  `npub`) — that is Alpha 177's own deliverable.
- Does **not** decide Desktop presentation — that is Alpha 178's own
  deliverable.
- Does **not** wire any future Source implementation of any kind, on
  top of the deterministic chain or otherwise.
- Does **not** decide the product question named in §4 (whether FedOS
  should ever offer a self-derived identity) — that remains open,
  future, and explicitly out of this Arc's own scope.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, any Protocol Adapter, `Cargo.toml`, or
  `package.json`.

## 9. See also

- `docs/secure_runtime_alpha_175_nostr_public_identifier_completion.md`
- `docs/secure_runtime_alpha_171_existing_nostr_identifier_inventory.md`
- `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
- `docs/secure_runtime_alpha_168_nostr_public_key_handle.md`
