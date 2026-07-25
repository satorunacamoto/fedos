# Secure Runtime Alpha 8121-8200 — Cargo.lock Policy Decision (Reproducibility Finding 4, `73fc0b2`)

**Decision: Option B — keep `Cargo.lock` untracked, pin the exact resolved
dependency graph and its hash in release provenance.** Not A (commit and
track), not C (defer without any concrete mitigation).

## Why not A (commit and track)

`packages/fedos-core-rust/.gitignore` excludes `Cargo.lock` via a
deliberate, explicitly-commented rule dating to the crate's original
Stage 69 skeleton ("no compiled output, no lockfile... a real
lockfile... lands only in a future, explicitly-reviewed stage"). Since
that stage, **dozens of structural-guard tests across this repository**
(the same ~40 files Reproducibility Finding 2 above touches, plus others)
assert, as one of their own stated invariants, that `Cargo.lock` is never
committed to this package — e.g. `test/runtime_wasm_artifact.test.ts`
test 2's own title: *"a locally-generated .wasm file is ALLOWED to exist...
but must never be tracked by git"*, and equivalent Cargo.lock-specific
assertions elsewhere. Committing `Cargo.lock` now would require revising
the stated INTENT of every one of those tests (not merely their
mechanism, which Reproducibility Finding 2 already fixed) — a genuinely
large, cross-cutting policy reversal, not a narrow reproducibility fix.
That is out of proportion to what this Arc's own mission asks for, and
the mission's own instruction is explicit: *"Do not silently commit
Cargo.lock solely because the review suggested it."*

## Why not C (defer with no concrete mitigation)

The review's own Finding H2 already identified a real, if so-far
unrealized, structural risk: without a committed lockfile, two builds
weeks apart could resolve different transitive dependency versions for a
**security-sensitive cryptographic core**, changing what code is
compiled into the shipped WASM with no visible signal. Deferring with
nothing more than a limitation note leaves that risk completely
unaddressed for this closed-pilot candidate.

## What Option B actually does

1. **A real, current `Cargo.lock` already exists in this worktree**
   (generated during this Arc's own earlier clean-checkout WASM
   reproducibility work, Phase H) — never committed, remains gitignored,
   exactly per existing policy.
2. Its exact contents are captured here as the PINNED reference graph:
   - SHA-256: `6bbdadb710b65b517ceb8d671f2bdbf37283d7373a73d0ed8debc1d895368155`
   - 82 resolved package entries (including this crate itself,
     `fedos-core-rust @0.0.0`).
   - Full resolved package@version list (alphabetical):
     `aead@0.5.2, aead@0.6.1, aes@0.8.4, aes-gcm@0.10.3, argon2@0.5.3,
     base16ct@0.2.0, base64ct@1.8.3, blake2@0.10.6, block-buffer@0.10.4,
     block-buffer@0.12.1, bumpalo@3.20.3, cfg-if@1.0.4, chacha20@0.10.1,
     chacha20poly1305@0.11.0, cipher@0.4.4, cipher@0.5.2, cmov@0.5.4,
     const-oid@0.10.2, const-oid@0.9.6, cpufeatures@0.2.17,
     cpufeatures@0.3.0, crypto-bigint@0.5.5, crypto-common@0.1.7,
     crypto-common@0.2.2, ctr@0.9.2, ctutils@0.4.2, der@0.7.10,
     digest@0.10.7, digest@0.11.3, ecdsa@0.16.9, elliptic-curve@0.13.8,
     fedos-core-rust@0.0.0, ff@0.13.1, generic-array@0.14.7,
     getrandom@0.3.4, ghash@0.5.1, group@0.13.0, hex@0.4.3, hkdf@0.13.0,
     hmac@0.13.0, hybrid-array@0.4.13, inout@0.1.4, inout@0.2.2,
     itoa@1.0.18, js-sys@0.3.103, k256@0.13.4, libc@0.2.189,
     memchr@2.8.3, once_cell@1.21.4, opaque-debug@0.3.1, poly1305@0.9.1,
     polyval@0.6.2, proc-macro2@1.0.107, quote@1.0.47, r-efi@5.3.0,
     rand_core@0.6.4, rustversion@1.0.23, sec1@0.7.3, secrecy@0.10.3,
     serde@1.0.229, serde_core@1.0.229, serde_derive@1.0.229,
     serde_json@1.0.151, sha2@0.10.9, sha2@0.11.0, signature@2.2.0,
     subtle@2.6.1, syn@2.0.119, syn@3.0.3, typenum@1.20.1,
     unicode-ident@1.0.24, universal-hash@0.5.1, universal-hash@0.6.1,
     version_check@0.9.5, wasip2@1.0.4+wasi-0.2.12,
     wasm-bindgen@0.2.126, wasm-bindgen-macro@0.2.126,
     wasm-bindgen-macro-support@0.2.126, wasm-bindgen-shared@0.2.126,
     wit-bindgen@0.57.1, zeroize@1.9.0, zmij@1.0.23`.
3. This exact graph is the one that produced the byte-identical
   `fedos_core_rust_bg.wasm`
   (`sha256:10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a`,
   385,565 bytes) confirmed across three independent builds spanning two
   sessions (this Arc's own Phase H work, cross-referenced against
   `73fc0b2`'s own independent confirmation).
4. This record belongs in the Phase N release provenance report
   (`release-provenance.v1` or equivalent) for the actual pilot-candidate
   build, so a reviewer can independently re-resolve dependencies at the
   recorded versions and confirm the same graph, without this repository
   needing to track a lockfile it has never tracked before.

## Honest limitation this Option B does NOT close

Recording the graph here does **not** make the build automatically fail
if a future `cargo build` silently resolves a different graph — that
would require Option A (a real, enforced, committed lockfile) or a
dedicated CI step diffing a freshly-resolved graph against this
document. **Declared as a named, precise pilot limitation**: *"Rust
dependency resolution for the WASM cryptographic core is empirically
reproducible (proven three-for-three) and its exact resolved graph is
recorded in release provenance, but is not yet structurally enforced by
a committed lockfile — a future Arc should commit `Cargo.lock` if this
becomes a real point of drift, or if release cadence increases enough
that "empirically fine so far" stops being adequate assurance for a
security-sensitive artifact."* This is a disclosed limitation, not a
release blocker for a closed pilot: the WASM artifact this Arc's own
Phase N rebuild produces is verified byte-identical against this exact
graph.
