# Crypto Verification Infrastructure (binding)

**Update (Stage 73): §5's "imported" step has since happened for five of the
six primitives in scope.** [`test-vectors/`](../test-vectors/README.md) now
holds verbatim official vectors for ChaCha20-Poly1305, AES-256-GCM,
HKDF-SHA256, Argon2id, and NIP-44 v2 (XChaCha20-Poly1305 remains unimported,
source undecided). This moves those primitives from lifecycle step 1
("proposed") to step 2 ("imported") in §5 below — **no primitive has reached
step 3 ("wired")**; no Rust code exists to consume these files, and every
runtime-gate condition in §9 remains unmet for all primitives. The rest of
this document describes the pipeline as originally fixed in Stage 72 and is
otherwise unchanged.

**Status: this document adds no code and, as originally written, committed no
vectors.** It fixes, in
writing, the **verification infrastructure** that ties together the plans
already fixed in [`crypto_test_vectors.md`](crypto_test_vectors.md),
[`crypto_vector_sources.md`](crypto_vector_sources.md),
[`fedos_core_rust_safety.md`](fedos_core_rust_safety.md), and
[`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) into one
end-to-end pipeline description — so a future Rust crypto core has a single
place that states, in order, what must happen between "an official vector
exists upstream" and "the runtime is allowed to select a real provider". This
is a **pipeline/process document, not an implementation spec**: it defines
the stages of the pipeline and the gate between them, not any algorithm,
API, or file format.

No cryptography, Rust, WASM, AEAD, HKDF, Argon2, or NIP-44 is implemented
here, and **no vector bytes, manifest JSON, or Rust code are added** in this
stage. If a future change would violate a rule below, the rule wins — do not
write the code, or open a new, explicitly-reviewed Stage to renegotiate the
rule in the open.

This is a safety contract, not a marketing claim. It complements the crypto
boundary ([`vault_crypto_identity.md`](vault_crypto_identity.md) §3–4,
`src/crypto/`), the FedOS package boundary
([`../packages/fedos-core-rust/README.md`](../packages/fedos-core-rust/README.md)),
and the WASM loader safety rules
([`fedos_core_wasm_safety.md`](fedos_core_wasm_safety.md)).

---

## 1. Purpose

- **A single pipeline description.** Prior docs each fixed one piece (which
  vectors, which sources, which crate rules, which manifest fields). This
  file states how those pieces compose into one ordered pipeline, so a future
  implementation Stage has one place to check "am I allowed to proceed" at
  each step.
- **Infrastructure, not implementation.** This stage adds the scaffolding
  (docs + empty directories) the pipeline will run inside — it does not run
  the pipeline. Nothing here executes a test, builds Rust, or loads WASM.
- **A gate registry.** Every stage of the pipeline (§3) has an explicit
  "must not proceed until" condition; this file is the place those
  conditions are collected so none is forgotten or reordered silently.

## 2. Verification pipeline (overview)

The pipeline has six stages, each gated on the one before it:

1. **Source catalog** — an official vector source is identified and recorded
   ([`crypto_vector_sources.md`](crypto_vector_sources.md)).
2. **Vector import** — the vector bytes are copied verbatim from that source
   into `test-vectors/`, with source/revision/license recorded alongside
   (§5, [`crypto_test_vectors.md`](crypto_test_vectors.md) §10).
3. **Rust implementation** — a primitive is implemented in
   `packages/fedos-core-rust`, using only audited dependencies adopted per
   [`rust_dependency_adoption.md`](rust_dependency_adoption.md).
4. **`cargo test` against the vectors** — the implementation is wired to run
   the imported vectors as known-answer tests (positive) and tamper tests
   (negative, §6); it must pass before moving on.
5. **Build manifest** — a manifest records the artifact's provenance,
   including which `testVectorSet` it was validated against
   (§9, [`fedos_core_build_manifest.md`](fedos_core_build_manifest.md),
   [`build_manifest_example.md`](build_manifest_example.md)).
6. **Runtime selection** — only after 1–5 are satisfied for a given
   primitive/build can the runtime's crypto-provider selection consider a
   real provider instead of the inert placeholder (§9).

## 3. Source → vector → Rust implementation → `cargo test` → runtime selection

This is the same six-stage flow as §2, stated as an explicit chain with the
gate condition between each link:

- **Source → vector.** Gate: the source must be an official RFC / standard /
  upstream project per [`crypto_vector_sources.md`](crypto_vector_sources.md)
  §2; an unsourced or informal vector never crosses this gate.
- **Vector → Rust implementation.** Gate: the vector file must already exist
  in `test-vectors/` with its source note (§5) BEFORE the corresponding
  primitive is implemented — implementation never precedes its own test
  vectors ([`fedos_core_rust_safety.md`](fedos_core_rust_safety.md) §5,
  "test vectors are mandatory at adoption").
- **Rust implementation → `cargo test`.** Gate: every implemented primitive
  is wired to `cargo test` running its known-answer AND negative vectors
  (§6) in the same Stage it is implemented — an implementation Stage that
  adds code without wiring its vectors as tests is incomplete by definition.
- **`cargo test` → build manifest.** Gate: a manifest is only produced for a
  build whose `cargo test` run (covering all vectors currently wired) is
  green; a manifest is never generated for a failing build
  ([`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) §8).
- **Build manifest → runtime selection.** Gate: the runtime provider
  selection may only consider a real provider for a build backed by a
  manifest whose `testVectorSet` matches the currently-wired vectors and
  whose digests validate (§9); otherwise selection stays on the inert
  placeholder (`NoopCryptoProvider` / `PlaceholderFedosCoreCrypto`).

## 4. Docs dependency graph

The pipeline is backed by these documents, each covering one link. This is
the dependency order (later docs assume earlier ones):

1. [`crypto_test_vectors.md`](crypto_test_vectors.md) — WHICH vector
   categories and rules (AEAD/KDF/Argon2id/NIP-44, tamper cases).
2. [`crypto_vector_sources.md`](crypto_vector_sources.md) — WHICH official
   source, per primitive, satisfies (1).
3. [`fedos_core_rust_safety.md`](fedos_core_rust_safety.md) — the crate-level
   guardrails (unsafe, dependencies, secrets, randomness, WASM) any
   implementation consuming (1)–(2) must obey.
4. [`rust_dependency_adoption.md`](rust_dependency_adoption.md) — the
   per-crate adoption process that (3) requires but does not itself detail.
5. [`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) — the
   provenance-record plan a build produced under (3)–(4) must ship with.
6. [`build_manifest_example.md`](build_manifest_example.md) — a concrete
   illustration of (5)'s fields (still no real manifest JSON).
7. **This file** — the pipeline that orders (1)–(6) and names the gate
   between each link.
8. [`test-vectors/README.md`](../test-vectors/README.md) — the directory (2)
   eventually populates.

A change to an earlier doc in this list may require re-checking later ones;
a change to a later doc must never contradict an earlier one silently.

## 5. Vector lifecycle

Each vector file, from creation to use, follows this lifecycle:

1. **Proposed** — a source is identified in
   [`crypto_vector_sources.md`](crypto_vector_sources.md) (already done for
   the six primitives in scope).
2. **Imported** — the vector bytes are copied verbatim into
   `test-vectors/<category>/<file>.json`, with `source`, `sourceRevision`,
   and `licenseNote` recorded per case or per file (schema proposed in
   [`crypto_vector_sources.md`](crypto_vector_sources.md) §11). This is the
   FIRST time any vector byte enters the repository — it does not happen in
   this stage (§13).
3. **Wired** — a Rust test in `packages/fedos-core-rust` reads the vector
   file and asserts the implementation reproduces the expected output
   (positive) and rejects tampered input (negative, §6).
4. **Passing** — `cargo test` is green for that vector file; this is a
   precondition for the build manifest step (§3).
5. **Referenced** — the build manifest's `testVectorSet` names the vector
   file(s) (and their revision) a given build was validated against.
6. **Frozen** — once imported, a vector file's content is never edited to
   "fix" a failing implementation; if the implementation disagrees with an
   official vector, the implementation is wrong. A vector file only changes
   if the upstream source itself is re-imported at a new revision, and that
   re-import is its own reviewed change with an updated `sourceRevision`.

## 6. Negative vectors

Restated as an infrastructure requirement (the categories themselves are
fixed in [`crypto_test_vectors.md`](crypto_test_vectors.md) §4–§7 and
[`crypto_vector_sources.md`](crypto_vector_sources.md) §9):

- **Every vector file that has known negative/tamper cases in its source
  must import them, not just the positive cases.** A vector file containing
  only "happy path" cases is incomplete for pipeline purposes.
- **`cargo test` must assert failure, not merely absence of a panic.** A
  negative case passes only if the implementation returns an explicit
  authentication/verification failure (`allowed:false` / `Err`) — a test
  that merely checks "it didn't crash" does not satisfy this gate.
- **A negative case can never be skipped to make CI green.** If a negative
  case is failing (i.e. the implementation wrongly accepts tampered input),
  that is a release-blocking defect, not a flaky test to `#[ignore]`.

## 7. Regression policy

- **Vectors, once wired, run on every `cargo test`.** A wired vector file is
  never removed from the test run without an explicit, reviewed reason
  recorded in the same change.
- **A new dependency version cannot silently change vector results.** Per
  [`rust_dependency_adoption.md`](rust_dependency_adoption.md) (semver
  policy), a crate version bump is validated against the full wired vector
  set before merge — a bump that changes any expected output is treated as a
  correctness incident, not accepted silently.
- **A vector-set change re-runs the whole pipeline for affected
  primitives.** Re-importing a vector file at a new `sourceRevision`
  re-triggers §3's "Rust implementation → `cargo test`" gate for every
  primitive that vector file covers.

## 8. CI policy (future)

Not implemented in this stage; fixed here as intent only:

- **A future CI job runs `cargo test` for the FedOS Rust crate** whenever
  `packages/fedos-core-rust/` or `test-vectors/` changes, in addition to the
  existing `npm test` / `npm run typecheck` jobs.
- **A future CI job blocks merge on any red vector test** — no vector test
  is allowed to be "known failing" on a merged branch.
- **`cargo check` stays a cheap, fast pre-check**; `cargo test` (once real
  tests exist) is the authoritative correctness gate, not `cargo check`.
- **No CI config is added or modified in this stage.**

## 9. Runtime gate condition

Collected from §3 and the prior docs, stated as a single condition: the
runtime crypto-provider selection may consider a real (non-placeholder)
provider for a given primitive/build ONLY IF ALL of the following hold
simultaneously:

1. Every vector file for that primitive is imported from an official source
   with a recorded `source` + `sourceRevision` + `licenseNote` (§5 step 2).
2. The Rust implementation is wired to and passes every known-answer case in
   those vector files (§5 step 4).
3. The Rust implementation fails closed on every negative/tamper case in
   those vector files (§6).
4. A build manifest exists for the artifact, its `testVectorSet` matches the
   currently-wired vector files, and its digests validate
   ([`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) §5, §8).
5. The WASM loader safety prerequisites are satisfied
   ([`fedos_core_wasm_safety.md`](fedos_core_wasm_safety.md) §5, §10) —
   provenance/pinned digest before any load.

**If any one condition is unmet, the runtime stays on the inert placeholder
(`NoopCryptoProvider` / `PlaceholderFedosCoreCrypto`).** This is unchanged
from Stages 63–65 and is not relaxed by this stage.

## 10. Current conclusion

- **Docs + skeleton only.** This stage adds no code and changes nothing
  under `src/` or `packages/fedos-core-rust/src/`.
- **No vectors, no manifest JSON, no Rust, no WASM.** `test-vectors/`
  contains only a `README.md` and empty category directories (§5 step 2 is
  described, not performed); `packages/fedos-core-rust/Cargo.toml` and
  `src/` are untouched.
- **The pipeline is now fully named end-to-end**, but every stage of it
  remains unimplemented — this file records the order and the gates, it does
  not cross any of them.
- **Next candidate:** importing the first official vectors verbatim (Stage
  73 candidate) is the first stage that actually crosses gate 1 of §9 for
  any primitive; it still does not implement Rust or cross gates 2–5.
