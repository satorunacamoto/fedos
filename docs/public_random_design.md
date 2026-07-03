# FedOS Core — Public Random Design, Post-CSPRNG-Adoption (Stage 104)

`docs/public_random_boundary.md` (Stage 103) fixed the DESIGN of a future
public `randomBytes` and its nonce counterpart before any CSPRNG
dependency existed in this crate. Stage 104 adopts `getrandom` as this
crate's first CSPRNG entropy source — build-check ONLY, not imported or
called anywhere in `src/lib.rs`. This document extends the prior design
one level deeper, now that a concrete dependency has been chosen, while
remaining a design record, not an implementation.

## 1. Why `getrandom` and not `rand`

This crate adopts `getrandom` directly rather than the higher-level
`rand`/`rand_core` crates. `getrandom` is the minimal wrapper around the
operating system's own CSPRNG syscall — it has no `Rng`/`CryptoRng` trait
ecosystem, no pluggable-algorithm surface, and no seedable
deterministic-PRNG code path that could be misused for a case that needs
a real CSPRNG. A future `randomBytes` implementation has exactly one
job — produce OS-grade random bytes — and `getrandom` is scoped to
exactly that job with no adjacent surface a reviewer would need to also
audit. If a future stage identifies a real need for the broader `rand`
ecosystem (for example, a non-cryptographic shuffling or sampling use
case elsewhere in this project), that is a separate, explicitly-reviewed
decision — this document does not anticipate one.

## 2. What a future `randomBytes` implementation would call

`getrandom`'s public surface, once wired, is expected to be reduced to a
single call: filling a caller-provided, fixed-length buffer and getting
back a `Result` indicating success or a platform-reported failure — no
seed, no algorithm selection, and no configuration surface for a caller
to get wrong. The buffer's length is expected to come from the
`FedosRandomBoundary`/`FedosNonceBoundary` label-selected size classes
`docs/public_random_boundary.md` section 2 already describes, never an
open-ended caller-supplied count.

## 3. Error mapping

A `getrandom` failure (the OS entropy source being unavailable, most
commonly on an unsupported or misconfigured platform) is expected to map
onto this crate's fixed error taxonomy
(`docs/fedos_core_public_api_design.md` section 8) as a single, specific
label — something like "entropy source unavailable" — never the
underlying platform error's raw text, error code, or `Display`
representation. This keeps the promise that no error surfaced by this
crate's public API ever carries a raw error type or platform-specific
detail a caller could depend on.

## 4. What Stage 104's verification-infrastructure placeholder is, and is not

`csprng_verification_infrastructure` (a new `#[cfg(test)]`-only module
in `src/lib.rs`, Stage 104) fixes, as a label enumeration only, four
categories a FUTURE wiring stage would need to verify once `getrandom`
is actually called: that the entropy source links and can be invoked at
all, that a requested output length is honored exactly, that a failure
surfaces as a `Result::Err` rather than a panic, and that two calls in
immediate succession are not obviously identical. It does NOT call
`getrandom`, draw a random byte, or assert anything about the
statistical quality, distribution, or entropy of any output — there is
no output to inspect, because nothing is drawn. This is a deliberately
narrower scope than the RFC 8439/5869/9106 vector-wiring modules, which
each verify their dependency against an official byte-exact known-answer
vector; no such vector exists for randomness, so "verification" here
means fixing the SHAPE of what a future check would look like, not
performing one.

## 5. What this stage does NOT do

- No `randomBytes` implementation, public or private.
- No nonce generation, anywhere.
- No call into `getrandom` anywhere in this crate — production or test.
- No change to `FedosRandomBoundary`/`FedosNonceBoundary` or their status
  functions (Stage 103) — both remain byte-for-byte unchanged, still
  permanently `Unavailable`.
- No change to this crate's public API surface — `getrandom`'s adoption
  adds a `Cargo.toml` entry only, not a new type or function.

## 6. Roadmap

1. Design and review the fixed, bounded output-size classes
   `docs/public_random_boundary.md` section 2 references, as their own
   small, explicit enumeration (not an open numeric parameter).
2. Implement the real `randomBytes` function behind
   `FedosRandomBoundary`, calling `getrandom` exactly once per request,
   mapping any failure per section 3 above.
3. Wire `csprng_verification_infrastructure`'s four categories to real
   assertions ONLY once step 2 exists to test — until then, the module
   stays a label-only plan.
4. Implement real nonce generation for the AEAD path, consuming the same
   `getrandom` call `randomBytes` uses, wired ONLY internally to the
   future `encrypt` implementation (`docs/public_random_boundary.md`
   section 3).
