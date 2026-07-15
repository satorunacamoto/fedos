# Secure Runtime Alpha 424 — Signing Authority Scope Decision

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind.** Stage 3 of the Alpha 422–430 Arc, Phase A.
Defines exactly what the Option A authority (Alpha 423) may sign,
given the "narrower is better" principle and the enumerated exclusions
(no caller-supplied pubkey/id/sig, no arbitrary private-key material,
no imported-author identity, no Relay destination, no Outbox state).

## 1. Option A — sign arbitrary 32-byte hashes

Turns the Secure Runtime into an unrestricted signing oracle: any
caller able to reach the export can get a valid BIP-340 signature over
ANY 32 bytes, including hashes that are not, and never were, a real
NIP-01 event pre-image — enabling forgery of signatures over
attacker-chosen data with no relationship to Nostr at all. Directly
matches the Arc's own named anti-pattern: "A generic `sign(hash)` API
is strongly discouraged because it turns the Secure Runtime into an
unrestricted signing oracle."

**Rejected — by name.**

## 2. Option B — sign arbitrary Nostr Event fields

Better than Option A (at least constrained to the NIP-01 shape), but
leaves `kind` fully caller-controlled — a caller could request a
signature over a `kind: 0` (profile metadata replacement), `kind: 5`
(deletion request), or any other semantically loaded kind the Publisher
was never reviewed to emit. This reopens exactly the "generic
arbitrary-signing authority" the Arc's own Objective forbids, one level
narrower than Option A but still open-ended.

**Rejected — kind must be fixed, not caller-supplied.**

## 3. Option C — accept `FedosBoardPost` and construct/sign one constrained event

Ties the Secure Runtime's own signing authority to the Board domain
model. `master_root` (Alpha 422 §2) — and every protocol-root sibling
inside it (Session/ATProto/Wallet) — has zero awareness of Board,
Outbox, or any application-level type today; it is protocol-generic.
Importing `FedosBoardPost` into the signing boundary breaks that
layering for no cryptographic benefit: the constraint that actually
matters (fixed `kind`, deterministic `accountIndex` → pubkey, no
caller-supplied `id`/`sig`) is achievable without ever importing a
Board type. It would also make a future Session/ATProto signing
authority need its OWN copy of the same pattern instead of sharing one
protocol-generic shape.

**Rejected — unnecessary coupling; the same constraints are achievable
protocol-generically (Option D).**

## 4. Option D — accept a reviewed Nostr unsigned-event input, return a complete signed event

Adopted. Matches the Arc's own preferred candidate. The authority fixes
every field that must not be attacker/caller-controlled and accepts
only the fields a legitimate Publisher genuinely needs to vary:

- **Supported kind(s), fixed**: `kind = 1` only (NIP-01 short text
  note) — the one kind a Board-post Publisher plausibly needs first;
  any other kind is rejected, fail-closed. Extending to additional
  kinds is a future, separately-reviewed Stage, not a caller option.
- **Account index**: caller-supplied `u32`, used ONLY to select which
  deterministic sub-identity signs (Alpha 422 §3's own account-index
  derivation) — never used to select or override which upstream root
  is used.
- **Public key derivation**: always derived fresh from
  (`account index` → Nostr Root → Nostr Secret Key → Nostr Public Key,
  Alpha 422 §2); a caller-supplied `pubkey` is never accepted, so it
  can never conflict with or override the derived one.
- **Canonical serialization / Event ID / signature**: always produced
  by the existing, reused Rust functions (`nostr_event_encoding`,
  `derive_nostr_event_id_internal`, `sign_nostr_event_internal`,
  Alpha 422 §2) — never caller-supplied, never independently
  recomputed in TypeScript.
- **Output shape**: exactly the seven NIP-01 wire fields (Alpha 426).

The authority explicitly does **not** accept: a caller-supplied
`pubkey`, `id`, or `sig`; arbitrary private-key material; an
imported-source author identity; a Relay destination; or any Outbox
state — matching the Arc's own binding list verbatim.

## 5. Decision

**Option D is adopted.** `kind` is fixed to `{1}` (single value, not a
range) as the narrowest workable first scope; `accountIndex` is the
only caller-varying identity-selection input; `createdAt`, `tags`,
`content` are the only caller-varying event-content inputs.

## 6. See also

- `docs/secure_runtime_alpha_423_nostr_signing_boundary_options.md`
- `docs/secure_runtime_alpha_422_nostr_signing_boundary_inventory.md`
