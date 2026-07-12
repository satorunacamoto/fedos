# Secure Runtime Alpha 145 — Deterministic Identity Derivation Completion

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 5, the closing Stage, of the Alpha 141–145 Deterministic
Identity Root Derivation Design Arc.**

## 1. Why now

Alpha 141 inventoried what exists. Alpha 142 adopted a hierarchy.
Alpha 143 fixed the domain-separation composition rule. Alpha 144
reviewed the Recovery contract and Threat Model. This Stage integrates
all four into a single, formal Design Phase Completion Declaration,
and recommends exactly one implementation Stage to follow.

## 2. Integration — the four Decisions, together

1. **Root hierarchy (Alpha 142):** Option C — Master Seed with FOUR
   sibling children (`Identity Root`, `Storage Root`, `Wallet Root`,
   `Application Root`), Application Root as the SOLE parent of every
   Protocol Root (Nostr/Session/ATProto/future), Account/Device Keys
   as a fifth level under each Protocol Root.
2. **Domain separation (Alpha 143):** every derivation step uses a
   fixed, compile-time, closed-enum-variant salt/info pair
   (`fedos-hkdf-{salt|info}-{root-category}-{protocol}-v{schema}`),
   extending the EXISTING `HkdfDomain` convention (Alpha 141 §2.3)
   with fixed-width binary Account/Device index bytes appended to
   `info`, NEVER a free-form string, NEVER Unicode, ALWAYS
   network/environment-separated (Development ≠ Production, by
   construction).
3. **Derivation Version:** each schema version is its OWN fixed enum
   variant with its OWN fixed salt/info pair (Alpha 143 §3) — versions
   never collide, and a rollback cannot corrupt data, only risk
   selecting a stale (but internally consistent) Identity if caller
   version-selection discipline fails (Alpha 144 §4).
4. **Account / Device index:** fixed-width big-endian binary,
   APPENDED (never embedded as text) to the `info` context (Alpha 143
   §3); index-COLLISION avoidance is explicitly a caller-side
   allocation-discipline requirement, NOT a cryptographic guarantee
   (Alpha 144 §4) — flagged, not silently assumed solved.
5. **Recovery contract (Alpha 144 §2/§3):** Protocol Roots, Nostr/
   Session/ATProto keys, the Storage wrapping root, and every Account/
   Device-index-separated Identity are deterministically
   reconstructible from Master Seed + fixed parameters. Relay data,
   server-deleted data, Desktop UI/cache state, Observation Events,
   external profile data, and ciphertext bodies are explicitly NOT
   covered by this contract.
6. **Threat Model (Alpha 144 §4/§5/§6):** a Protocol Root or Account
   Key leak is CONTAINED (cannot derive the Master Seed, a sibling
   root, or a sibling key) — a direct, structural consequence of
   HKDF's own one-way, domain-separated construction. A Master Seed
   leak is NOT contained — it compromises every derived Identity at
   once, stated plainly, not hidden.
7. **Secret Exposure prohibition:** no raw Master Seed or Root byte
   ever crosses the Rust/Secure Runtime boundary into Desktop, the
   Identity Layer, or any Protocol Adapter — only Opaque Handles
   (Alpha 141 §2.4/§2.7's own `expose_bytes_for_internal_*`/
   `AeadKeyHandle`-wrapper precedent), matching the Responsibility
   Boundary (§3 below) exactly.

## 3. Responsibility boundary — formally fixed

- **Rust / Secure Runtime:** holds the Master Seed Handle, performs
  Root Derivation, produces Protocol Root Handles, zeroizes secret
  values on drop (`docs/secret_lifecycle_implementation_plan.md` §6),
  and NEVER lets a raw secret value leave this boundary.
- **Desktop:** calls derivation explicitly (no implicit/auto-derive),
  supplies only NON-SECRET parameters (Account index, Device index —
  plain integers, never secret material), and may hold ONLY Opaque
  Handles, never raw bytes — matching `DesktopApplication`'s own
  existing Alpha 111/118 Identity Authority boundary discipline
  exactly (Desktop consumes, never becomes, an Authority; the same
  principle now extends to: Desktop consumes, never HOLDS, a secret).
- **Identity Layer** (`src/identity/*`): builds public
  Identifiers/Descriptors only; NEVER holds a private key or Master
  Seed — this is UNCHANGED from Alpha 141 §2.13's own finding, and
  this Arc's own design does not alter it.
- **Protocol Adapter:** receives a Protocol Root or an Opaque Handle
  (never the Master Seed directly), and builds a public Identity
  following that protocol's own standard (e.g. NIP-06 for Nostr).
- **Storage:** does NOT casually persist a Master Seed or raw Root
  into general-purpose Ciphertext Storage — the actual persistence
  method is explicitly deferred to a future, dedicated Review (Alpha
  144 §7).

## 4. Completion Declaration

**The Deterministic Identity Root Derivation Design Phase is COMPLETE.
The following stand as FedOS's own formal Decisions:**

- **Adopted hierarchy:** Master Seed → { Identity Root, Storage Root,
  Wallet Root, Application Root → { Nostr Root, Session Root, ATProto
  Root, future Protocol Roots } → Account/Device Keys } (Alpha 142).
- **Domain Separation policy:** fixed, closed-enum, compile-time
  salt/info composition, extending the existing `HkdfDomain`
  convention (Alpha 143).
- **Derivation Version policy:** one fixed enum variant per schema
  version, no cross-version collision (Alpha 143 §3, Alpha 144 §4).
- **Account / Device index policy:** fixed-width big-endian binary,
  appended to `info`; collision avoidance is caller-side discipline,
  not a cryptographic guarantee (Alpha 143 §3, Alpha 144 §4).
- **Recovery contract:** the SAME Master Seed and the SAME Derivation
  Parameters reconstruct the SAME Protocol Identity — fixed here as
  FedOS's own formal Recovery contract CANDIDATE (Alpha 144 §2/§3).
- **Threat Model:** Protocol Root / Account Key leaks are contained;
  Master Seed leak is not, and is stated plainly (Alpha 144 §4/§5/§6).
- **Secret Exposure prohibition:** no raw secret ever crosses the
  Rust/Secure Runtime boundary (§3 above).
- **Rust / Runtime / Desktop responsibility boundary:** fixed (§3
  above).
- **Storage policy:** Master Seed/Root persistence method deferred to
  a future, dedicated Review — not decided here, not silently assumed.
- **Application to Nostr:** the Nostr Root, once implemented, becomes
  the FIRST real consumer of this hierarchy — but no Nostr key
  generation, signing, or Relay work is authorized by this Arc.

**Given the SAME Master Seed and the SAME Derivation Parameters
(schema version, root category, protocol identifier,
network/environment, Account index, Device index), FedOS can
deterministically reconstruct the SAME Protocol Identity — this stands
as FedOS's own formal Recovery contract CANDIDATE, ready for a future
implementation Stage to build against.**

**No cryptographic implementation occurs in this Stage or this Arc.**
Every Decision above is a DESIGN commitment a future Stage must
implement and test against — not a claim that anything described here
already runs.

## 5. Alpha 146 recommendation

**Recommended: Master Seed / Root Derivation Rust Boundary Review.**

This is a REVIEW-first Stage (matching this whole session's own
established discipline of interface-before-implementation), scoped
narrowly to: (a) formally reviewing where a `MasterSeedHandle`-style
type would live in `packages/fedos-core-rust/src/`, alongside the
EXISTING `SecretHandle`/`FedosAeadKeyHandle` precedent (Alpha 141
§2.4–2.6); (b) formally reviewing what NEW `HkdfDomain`-style variants
Alpha 143's own hierarchy requires (`application`, `wallet`, and
per-protocol variants), without yet adding them; (c) formally
confirming the exact chaining shape
(`derive(derive(derive(seed, root_category), protocol), account_device)`)
against the ACTUAL existing `derive_secret_handle_internal` signature.
This is the smallest, safest next Stage: it touches no `Cargo.toml`,
adds no dependency, and produces a REVIEW document a subsequent Stage
can implement against — exactly the same "boundary review before
wiring" pattern this repository has used for every prior secret-path
feature (`docs/secret_handle_api_shape.md` before
`docs/secret_lifecycle_implementation_plan.md` before the real
`SecretHandle` implementation).

Nostr Relay connection is explicitly NOT recommended — signing,
key generation, and Relay work all require a Root to already exist,
and no Root exists yet. Generating an Identity before the key's own
origin (the Master Seed / Root boundary) is reviewed and implemented
would invert this Arc's own stated purpose.

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind, across the WHOLE Alpha 141–145 Arc.
- Does **not** implement Master Seed generation, Root derivation, any
  new `HkdfDomain` variant, Nostr key generation, or any cryptography.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, Storage, Observation, Rust,
  `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_141_existing_secret_kdf_inventory.md`
- `docs/secure_runtime_alpha_142_root_hierarchy_decision.md`
- `docs/secure_runtime_alpha_143_domain_separation_decision.md`
- `docs/secure_runtime_alpha_144_recovery_threat_model_decision.md`
- `docs/secret_handle_api_shape.md`
- `docs/secret_lifecycle_implementation_plan.md`
