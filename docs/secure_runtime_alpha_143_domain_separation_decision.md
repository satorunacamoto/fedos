# Secure Runtime Alpha 143 — Domain Separation & Derivation Context Decision

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 3 of the Alpha 141–145 Deterministic Identity Root
Derivation Design Arc, following Alpha 142's own adoption of the
Application Root hierarchy (Option C).**

## 1. Why now

Alpha 142 fixed the SHAPE of the hierarchy but explicitly deferred the
exact Domain Separation strings/context format. `docs/crypto_test_vectors.md`
§5 already mandates "Domain separation is mandatory. Every derivation
carries a distinct, documented `info`/context." The EXISTING
`HkdfDomain` enum (`packages/fedos-core-rust/src/lib.rs:2498`) already
proves the pattern this Stage extends: fixed, compile-time
`&'static [u8]` salt/info strings, one pair per domain, in the literal
format `b"fedos-hkdf-{salt|info}-{domain}-v1"` (e.g.
`b"fedos-hkdf-salt-root-key-v1"`). This Stage formally fixes the
CONTEXT COMPOSITION for the new, deeper hierarchy Alpha 142 adopted —
it does not invent a new string format from nothing.

## 2. Contexts considered, and their decision

| Context | Decision |
|---|---|
| **FedOS derivation schema version** | Included, as a fixed leading segment (`v1`) in every domain string — matches the EXISTING `-v1` suffix convention exactly. |
| **Root category** | Included — `root-key`/`identity`/`storage`/`conversation` in the EXISTING enum; this Stage adds `wallet` and `application` as new root-category segments. |
| **Protocol identifier** | Included — a new segment under `application`, e.g. `nostr`/`session`/`atproto`. Free-form protocol names are FORBIDDEN (§4) — each must be an enum variant, never a caller-supplied string. |
| **Network / environment** | Included as a MANDATORY segment (`mainnet`/`testnet`/`test-only`) — see §5's Development/Production Decision. |
| **Account index** | Included — encoded as fixed-width big-endian bytes APPENDED to the `info` context after the fixed label (never embedded as a decimal string — see §3). |
| **Device index** | Included — same encoding rule as Account index, its own separate append position after Account index. |
| **Key purpose** | Included — reuses the EXISTING `HkdfDomain`-style enum-variant pattern (e.g. `signing` vs. `encryption` sub-purpose within one protocol), never a free string. |
| **Key algorithm version** | Included as a trailing fixed segment, independent of the schema version — allows a protocol's own key algorithm to version independently of FedOS's own derivation schema. |

## 3. Binary format — fixed

Extending the existing `salt()`/`info()` pattern
(`packages/fedos-core-rust/src/lib.rs:2519-2538`) exactly:

- **`salt`**: a fixed, compile-time `&'static [u8]` literal per domain
  — NEVER derived from caller input, NEVER random. Format:
  `b"fedos-hkdf-salt-{root-category}-{protocol}-v{schema}"`, e.g.
  `b"fedos-hkdf-salt-application-nostr-v1"`.
- **`info`**: a fixed, compile-time `&'static [u8]` LABEL PREFIX,
  identical in shape to `salt`, followed by APPENDED fixed-width
  binary fields for any variable index (Account, Device):
  `b"fedos-hkdf-info-application-nostr-v1" || account_index.to_be_bytes() || device_index.to_be_bytes()`.
  Big-endian, fixed-width (`u32`, 4 bytes each) — never a decimal
  ASCII string, never variable-length, to avoid any ambiguity between
  e.g. account `1` device `23` and account `12` device `3`.
- **`output length`**: fixed per consuming protocol's own standard
  (e.g. 32 bytes for a secp256k1 scalar) — decided by each Protocol
  Adapter, not by this shared derivation layer; the shared layer's own
  `derive_secret_handle_internal` already returns HKDF-Expand output
  sized to the caller's own request (Alpha 141 §2.3).
- **`index encoding`**: fixed-width big-endian `u32`, NEVER ASCII
  decimal, NEVER variable-length (fixed above).
- **`version encoding`**: a fixed ASCII decimal integer embedded
  directly in the ATOM string (`v1`, `v2`, ...) — never a separate
  binary field, matching the EXISTING `-v1` convention exactly; a new
  schema version is a NEW enum variant with its OWN fixed salt/info
  pair, never a runtime-mutable field.
- **Unicode**: FORBIDDEN in any salt/info/context component. Every
  segment is a fixed, compile-time ASCII literal, chosen by the Rust
  source itself — never accepts caller-supplied text of any kind.
- **Case**: lowercase-ASCII-only, matching the EXISTING convention
  (`root-key`, `identity`, `storage`, `conversation`, `test-only`) —
  no mixed case anywhere.
- **Separator rule**: hyphens (`-`) separate segments WITHIN a fixed
  label (matching the EXISTING convention); no other separator
  character is permitted in any salt/info literal.
- **Network separation**: a MANDATORY domain segment (§2), never
  optional — a derivation call omitting network context is a
  programming error, not a valid production call.
- **Test-only context**: the EXISTING `HkdfDomain::TestOnly` variant
  (`b"fedos-hkdf-salt-test-only-v1"`) is REUSED unchanged as the
  general test-fixture domain; production domains additionally gain
  their own `-test-only-` NETWORK segment (distinct from
  `HkdfDomain::TestOnly`, which is reserved for this module's own unit
  tests per its existing doc comment) for realistic non-production
  environments (e.g. testnet-like protocol test networks).
- **Production context**: any domain segment other than the two
  test-designated ones above.

## 4. Free-string prohibition

**No free-form string may be used directly as a salt, info, or context
value anywhere in this hierarchy.** Every segment (root category,
protocol identifier, key purpose, network/environment) MUST be an
explicit, closed Rust enum variant with its OWN fixed, compile-time
literal — exactly the discipline `HkdfDomain` already enforces
(`packages/fedos-core-rust/src/lib.rs:2498-2510`). Account index and
Device index are the ONLY components permitted to vary at runtime, and
even those are fixed-width binary, never free text (§3).

## 5. Development vs. Production identity

**Development and Production MUST NOT share the same derived Identity
for the same Master Seed.** The MANDATORY network/environment segment
(§2) guarantees this structurally: a `testnet`/development-network
domain and a `mainnet`/production-network domain, even with an
otherwise-identical protocol/account/device context, produce
CRYPTOGRAPHICALLY UNRELATED outputs under HKDF's own domain-separation
guarantee — an attacker (or an accidental cross-environment code path)
observing a Development-derived key learns nothing about the
Production-derived key for the same user. This is a DELIBERATE safety
property, not an oversight: it prevents a development/test build from
ever accidentally producing, leaking, or colliding with a real
Production Identity.

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind. `HkdfDomain` (Alpha 141 §2.3) is NOT extended
  with new variants by this Stage — that is future implementation
  work, not this Design Arc's own deliverable.
- Does **not** fix the FINAL, literal byte-for-byte constant strings
  for every future protocol — it fixes the COMPOSITION RULE those
  strings must follow (§3), so each new protocol's own literal is
  mechanically derivable from this rule without a fresh design review.
- Does **not** implement Master Seed generation, Root derivation, or
  any cryptography.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, Storage, Observation, Rust,
  `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_141_existing_secret_kdf_inventory.md`
- `docs/secure_runtime_alpha_142_root_hierarchy_decision.md`
- `docs/crypto_test_vectors.md`
