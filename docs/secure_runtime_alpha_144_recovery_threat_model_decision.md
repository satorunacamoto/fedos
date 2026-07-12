# Secure Runtime Alpha 144 — Recovery & Threat Model Decision

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 4 of the Alpha 141–145 Deterministic Identity Root
Derivation Design Arc, following Alpha 143's own Domain Separation
Decision.**

## 1. Why now

Alpha 142 fixed the hierarchy shape; Alpha 143 fixed how each
derivation is context-separated. Both together make one claim
possible: "the same Master Seed and the same derivation parameters
reconstruct the same Protocol Identity." This Stage formally reviews
that claim as a contract — what it actually promises, what it does
NOT promise, and what happens under compromise.

## 2. Recoverable — deterministically reconstructible from Master Seed + parameters

- **Protocol Root** (Nostr Root / Session Root / ATProto Root / future)
  — pure function of Master Seed + the Alpha 143 fixed context; always
  reconstructible.
- **Nostr Secret/Public Key pair** — pure function of Nostr Root +
  Account/Device index (Alpha 143 §2/§3); always reconstructible.
- **Session identity key** — same guarantee, under Session Root.
- **ATProto identity key** — same guarantee, under ATProto Root.
- **Storage wrapping root** — same guarantee, under Storage Root (a
  sibling of Application Root, Alpha 142 §5); reconstructible
  independent of any Protocol Root.
- **Account-index-separated Identity** — a different Account index
  under the SAME Protocol Root always reconstructs to its OWN,
  independent Identity, deterministically.
- **Device-index-separated Identity** — same guarantee, for Device
  index.

## 3. NOT recoverable — outside this contract's own scope, by design

- **Events lost from a Relay** — Relay-side data is NEVER a function of
  Master Seed; losing Relay state is a Relay/network availability
  problem, not a key-derivation problem.
- **Data deleted server-side** — same reasoning; no key ever
  reconstructs data that no longer exists anywhere.
- **Desktop local UI state** — ephemeral, never derived, never a
  candidate for this contract.
- **Cache contents** — ephemeral by definition (Alpha 118/123's own
  `#currentPublicIdentity`-style Desktop caches are RE-FETCHED, not
  recovered from Master Seed).
- **Observation Events** (Alpha 076–085) — a delivery/notification
  record, never keyed material, never reconstructible from a seed.
- **Lost external profile data** — data another service holds about
  the user is never a function of this repository's own Master Seed.
- **Encrypted data bodies (ciphertext)** — recovering the KEY does not
  recover the ciphertext if the ciphertext itself is lost; this
  contract recovers KEYS, not the encrypted payloads those keys once
  protected. BOTH the key and the ciphertext are required together;
  Master Seed recovery alone is insufficient if the ciphertext no
  longer exists anywhere.

## 4. Threat Model

| Threat | Consequence | Contained? |
|---|---|---|
| **Master Seed loss** (no compromise, just lost) | ALL derived Identities become permanently unrecoverable through this contract — there is no other recovery path once the seed itself is gone. | N/A — total loss is the accepted cost of a single-seed design (Alpha 142 §3, criterion 7 vs. Option E). |
| **Master Seed leak** (compromise) | ALL derived Identities across ALL Protocol Roots, ALL Accounts, ALL Devices are compromised — full compromise, no containment possible at any level. | **NOT contained — documented here explicitly, not hidden (§5).** |
| **One Protocol Root leak** | That Protocol Root's own Account/Device Keys are compromised. | **Contained** — HKDF domain separation (Alpha 143 §3/§4) prevents deriving the Master Seed OR any sibling Protocol Root (Identity/Storage/Wallet Root, or a different Protocol Root) from a leaked Protocol Root. |
| **One Account Key leak** | That specific Account's own key material for that specific Protocol is compromised. | **Contained** — HKDF's own one-way property prevents deriving the Protocol Root OR any sibling Account/Device Key from a leaked Account Key. |
| **Desktop compromise** | Whatever Opaque Handles Desktop currently holds in memory are compromised for their own active session; raw Master Seed / Root bytes are NEVER exposed to Desktop in the first place (Alpha 141 §2.5/§2.7, Alpha 143's boundary premise), so a Desktop compromise alone cannot exfiltrate the Master Seed itself. | **Partially contained** — active-session Handles are exposed, but the Master Seed's own raw bytes are structurally never reachable from Desktop. |
| **Memory dump** | Same boundary as Desktop compromise: raw secret bytes exist ONLY inside the Rust/Secure Runtime boundary (Alpha 141 §2.4–2.7's zeroize/`secrecy` discipline); a Desktop-process memory dump does not contain Master Seed bytes by construction. A Rust-process memory dump, if captured DURING a live derivation, could expose transient material — `zeroize`-on-drop (`docs/secret_lifecycle_implementation_plan.md` §6) narrows, but does not eliminate, this window. | **Narrowed, not eliminated — documented, not oversold** (matching `docs/vault_crypto_identity.md` §4's own "this is a limitation to document, not a guarantee to advertise" discipline). |
| **Backup theft** | Depends entirely on how/where a Master Seed backup is stored — a decision explicitly OUT OF SCOPE for this Arc (Storage's own persistence method is deferred to a future Review, per the Responsibility Boundary). If a backup is stored unencrypted, it is a Master-Seed-leak event (above). | **Not addressed by this Arc — flagged as a dependency for the future Storage Review, not silently assumed safe.** |
| **Rollback** (reusing an old Derivation Version after a newer one was adopted) | Since each schema version is its own fixed enum variant with its own fixed salt/info (Alpha 143 §3), an old version's own outputs remain internally consistent but distinct from the new version's outputs — a rollback does not corrupt data, but CAN cause a caller to derive the WRONG (stale) Identity if version selection itself is not pinned correctly by the caller. | **Partially contained by design (no cross-version collision); the caller's own version-selection discipline is out of THIS Arc's own scope.** |
| **Derivation Version change** (a new schema version introduced) | New-version outputs are cryptographically UNRELATED to old-version outputs (fixed, distinct salt/info per version, Alpha 143 §3) — this is a deliberate MIGRATION event, not a silent identity change; a future Stage must define the actual migration UX, which this Arc does not. | **Structurally safe (no accidental collision); migration UX is future work.** |
| **Account Index collision** (two logical accounts accidentally assigned the same index) | Would silently derive the SAME Identity for what the caller believes are two different accounts — a caller-side bookkeeping bug, not a cryptographic flaw; the derivation function itself has no way to detect a caller's own index-management error. | **NOT contained by cryptography — an index-allocation-discipline requirement for whatever future Stage manages Account indices; explicitly flagged here, not silently assumed away.** |
| **Device Index collision** | Same reasoning and same containment status as Account Index collision, one level deeper. | **NOT contained by cryptography — same flagged caller-discipline requirement.** |

## 5. Master Seed leak — impact stated plainly, not hidden

**If the Master Seed leaks, EVERY derived Identity is affected — every
Protocol Root, every Account, every Device, across Nostr, Session,
ATProto, Storage, Wallet, and any future protocol, ALL AT ONCE, with NO
containment possible at any level below the Master Seed itself.** This
is the unavoidable cost of a single-Master-Seed hierarchy (the SAME
trade-off already surfaced in Alpha 142 §3's own comparison, criterion
9, against Option E's "independent seeds" alternative, which trades
this exposure for a materially worse recovery/backup burden). This Arc
does NOT claim Master-Seed leak is an acceptable risk to minimize
silently — it is named here explicitly so any future Stage that
handles Master Seed storage, backup, or unlock treats this as the
single highest-value target to protect.

## 6. Protocol Root leak — impact stated plainly, confirmed contained

**If a single Protocol Root leaks, it cannot be used to derive the
Master Seed or any sibling Protocol Root (Identity/Storage/Wallet Root,
or a different protocol's own Root).** This containment is a direct,
structural consequence of HKDF's own one-way, domain-separated
construction (RFC 5869) as already implemented by
`derive_secret_handle_internal` (Alpha 141 §2.3) — not a new property
this Arc invents, but a property this Arc's own hierarchy choice
(Option C, Alpha 142) is specifically designed to make USE of, by
ensuring every derivation step is a ONE-WAY function with its own
fixed, distinct context.

## 7. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** decide HOW a Master Seed backup is stored — that is
  explicitly deferred to a future Storage Review (§4's own Backup
  theft row; matches the Responsibility Boundary's own "保存方式は将来の
  専用Review対象" instruction).
- Does **not** decide Account/Device index ALLOCATION discipline
  (avoiding collisions) — flagged as a caller-side requirement for
  whatever future Stage manages index assignment.
- Does **not** implement Master Seed generation, Root derivation, or
  any cryptography.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, Storage, Observation, Rust,
  `Cargo.toml`, or `package.json`.

## 8. See also

- `docs/secure_runtime_alpha_141_existing_secret_kdf_inventory.md`
- `docs/secure_runtime_alpha_142_root_hierarchy_decision.md`
- `docs/secure_runtime_alpha_143_domain_separation_decision.md`
- `docs/vault_crypto_identity.md`
- `docs/secret_lifecycle_implementation_plan.md`
