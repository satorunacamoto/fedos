# Secure Runtime Alpha 432 — Master Seed Authority Options Review

Phase A, Stage 2. Evaluates the seven candidate Master Seed authority
designs against Alpha 431's own inventory.

| Option | Plaintext exposure | Restart persistence | Browser/Worker | Current Desktop Host | Verdict |
|---|---|---|---|---|---|
| A. Rust generates, owns an opaque Handle | Never leaves Rust | None by itself | Yes | Yes | Adopted (combined with E) |
| B. TypeScript supplies raw 32 bytes | JS holds raw seed bytes permanently | Caller's problem | Yes | Yes | Rejected |
| C. Passphrase → seed in TypeScript | JS derives+holds raw seed bytes | Caller's problem | Yes | Yes | Rejected |
| D. Native OS key store owns the seed | Never in JS | Real, OS-native | No (Worker/browser have none) | Partial (DPAPI only) | Deferred — not universal |
| E. Rust owns seed, exports sealed envelope only | Never leaves Rust in plaintext | Real, via envelope | Yes | Yes | Adopted (combined with A) |
| F. Hardware signer | Never in JS or Rust | Real, external | Depends on device | No existing integration | Deferred — no existing integration, explicitly out of scope this Arc |
| G. NIP-07-only, no local seed | N/A | N/A | Browser-extension only | No | Rejected — this Arc's own mandate is a LOCAL authority; NIP-07 is a different, complementary future signing path, not a substitute |

## Why B and C are rejected outright

Both require TypeScript-reachable memory to hold either raw Master Seed
bytes (B) or a passphrase-derived seed (C) for as long as the
authority is "available" — every `.generate()`/`.sign()` call in
between leaves 32 bytes of real secret material sitting in ordinary,
GC-scanned, devtools-inspectable JS heap. Permanent Security Invariant 1
("raw Master Seed bytes are never returned from Rust") is stated as a
Rust-boundary rule specifically because JS memory offers none of Rust's
own zeroize-on-drop discipline — adopting B or C would satisfy the
LETTER of Invariant 1 (Rust still never *returns* the bytes; JS would
*generate* or *receive* them from the user directly) while defeating
its entire purpose.

## Why D and F are deferred, not adopted

Option D (DPAPI) is real and Windows-Desktop-usable (Alpha 431 §4/§5),
but this crate also targets a `getrandom_backend="wasm_js"` browser/
Worker build with no OS key store reachable at all — adopting D alone
would mean two authorities with different security properties per
runtime, and this Arc's own scope is "the smallest safe Master Seed
authority" for the runtime that exists today (a Node/Desktop dev
environment with no browser/Worker integration yet). D remains a
strong FUTURE per-Host wrapping-key option (see Alpha 433) but is not
adopted as the sealing mechanism in this Arc, to keep exactly one
seal/restore code path.

Option F (hardware signer) has no existing dependency, no existing
integration point, and would require a new Cargo/npm dependency this
Arc's own STOP conditions forbid introducing silently.

## Adopted: A + E

Rust generates and owns the Master Seed inside a new, narrow, opaque
`#[wasm_bindgen]` struct (`FedosMasterSeedAuthority`, following the
`AeadKeyHandle` precedent exactly — Alpha 431 §9), and the ONLY thing
that ever crosses the WASM boundary besides booleans is a sealed,
authenticated-encrypted envelope (Option E) — restart restores by
handing that same envelope back to a fresh authority instance. This
satisfies deterministic recovery, browser/Worker/Desktop portability
(the seal/restore code path itself has no OS dependency), and
multi-protocol/account derivation (the existing Identity → Application →
Nostr Root chain is reused unchanged). Backup/migration (copying the
sealed envelope to a new device, still requiring the passphrase to
restore) is possible but not implemented as a feature in this Arc — no
export/import UI, no multi-device sync (explicitly out of scope, see
Alpha 450).
