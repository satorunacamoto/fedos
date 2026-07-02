# FedOS Core Build Manifest — Provenance Plan (binding)

**Status: this document adds no code and commits no manifest.** It fixes, in
writing, the plan for a build **manifest / provenance** contract a FUTURE FedOS
Rust/WASM core must ship with — so a build artifact can be tracked, pinned, and
(eventually) verified before it is ever loaded. This is a **management plan, not
a build spec**: it defines what a manifest records and the rules around it, not
how to compile Rust, emit WASM, generate a hash, or verify a signature.

No Rust, WASM, `Cargo.toml`, `.rs`, `.wasm`, build script, hash generation, or
signature verification is added in this stage, and **no manifest JSON is
committed** (see §10–§11). If a future change would violate a rule below, the rule
wins — do not write the code, or open a new, explicitly-reviewed Stage to
renegotiate the rule in the open.

This is a safety contract, not a marketing claim. It complements the FedOS
package boundary
([`../packages/fedos-core-rust/README.md`](../packages/fedos-core-rust/README.md)),
the WASM loader safety rules
([`fedos_core_wasm_safety.md`](fedos_core_wasm_safety.md) §5, §10), and the crypto
test-vector plan ([`crypto_test_vectors.md`](crypto_test_vectors.md)).

---

## 1. Purpose

- **Provenance contract for a future Rust/WASM core.** Fix how a build artifact's
  origin, inputs, and identity are recorded so a specific `.wasm` can be pinned to
  a specific source tree, toolchain, and dependency set.
- **A manifest skeleton for handling artifacts safely.** Define the fields a
  manifest carries and the rules around them, so provenance is captured the same
  way every time.
- **A management plan, not a build spec.** This file specifies no build steps, no
  compiler flags' semantics, no hashing algorithm implementation, and no signing
  scheme — only what must be recorded and what must never be.

## 2. Why a manifest is needed

- **WASM module swap risk.** The loader seam (Stage 63) is the swap point for a
  real core; without a pinned identity, a substituted/tampered module could be
  loaded unnoticed.
- **Supply-chain risk.** Crypto depends on third-party crates; a manifest records
  exactly which locked dependency set produced an artifact.
- **Dependency drift.** Rebuilds can silently pull different transitive versions;
  a lockfile digest makes drift detectable.
- **Reproducibility.** A manifest ties an artifact to the inputs needed to rebuild
  it, so an independent rebuild can be compared byte-for-byte.
- **Runtime loader safety.** It is the record a FUTURE manifest-validation boundary
  would check before a module is ever loaded (§9).

## 3. Manifest skeleton fields

The planned fields (names fixed here; no JSON is committed yet). Every value is
NON-secret provenance metadata:

- **`manifestVersion`** — schema version of the manifest itself.
- **`packageName`** — the package the artifact belongs to (e.g. the FedOS core).
- **`sourceRevision`** — the VCS revision (commit) the build was made from.
- **`sourceTreeDigest`** — digest of the source tree that was built (§5).
- **`rustToolchain`** — pinned toolchain identifier (channel + version).
- **`wasmTarget`** — the target triple / WASM target the artifact was built for.
- **`buildProfile`** — the build profile (e.g. release) and its relevant settings.
- **`dependencyLockDigest`** — digest of the dependency lockfile (drift detection).
- **`testVectorSet`** — reference to the crypto test-vector set the core must pass
  (§8), linking to [`crypto_test_vectors.md`](crypto_test_vectors.md).
- **`wasmArtifactDigest`** — digest of the produced `.wasm` artifact (§5).
- **`signatureRef`** — OPAQUE label pointing to a detached signature/attestation
  (§6) — never the signature bytes or a key.
- **`provenanceRef`** — OPAQUE label pointing to a provenance/attestation record
  (e.g. a build-system attestation) — never secret content.
- **`buildTimestampPolicy`** — how timestamps are handled for reproducibility (§7)
  — a policy label, not a machine clock value baked into the artifact.
- **`notes`** — free-form NON-secret notes (e.g. known reproducibility gaps).

## 4. Forbidden fields / values

A manifest must NEVER contain:

- **secret** of any kind,
- **API key** or **endpoint token**,
- **private signing key** (or any private key material),
- **raw seed** / key material,
- **local path with a username** (e.g. a home-directory path revealing an account),
- **machine-specific absolute path** (build-host filesystem layout).

Provenance metadata is public-by-design; anything secret- or host-identifying is
out of scope and must be excluded, not "redacted later".

## 5. Digest policy

- **SHA-256 or stronger.** Digests use SHA-256 at minimum (a stronger hash is
  acceptable); the algorithm is recorded alongside each digest.
- **State what each digest covers.** Each digest names its exact input
  (source tree vs. lockfile vs. `.wasm` artifact) — a digest with an ambiguous
  scope is not acceptable.
- **Separate generated files from the source tree.** `sourceTreeDigest` covers
  committed source only; build outputs / generated files are digested separately
  (e.g. `wasmArtifactDigest`) and never folded into the source digest.
- **No unverified WASM at runtime.** A `.wasm` whose `wasmArtifactDigest` has not
  been verified MUST NOT be selectable/loadable at runtime (ties to §9 and
  [`fedos_core_wasm_safety.md`](fedos_core_wasm_safety.md) §5).

## 6. Signature policy

- **Signed release is a future candidate.** Signing/attestation is planned but NOT
  implemented; this stage adds no signing and no verification.
- **`signatureRef` is an opaque label.** It points to a detached signature /
  attestation record — never the signature bytes inline, and never a key.
- **No private key in the manifest.** Signing keys live outside the repo and the
  manifest entirely (see §4).
- **Signature verification is unimplemented.** Until a future explicit stage adds
  it, no manifest signature is checked; the manifest is provenance metadata only.

## 7. Reproducible build policy

- **Toolchain pinning.** `rustToolchain` pins the exact channel + version so
  rebuilds use the same compiler.
- **Lockfile digest.** `dependencyLockDigest` pins the dependency set so drift is
  detectable across rebuilds.
- **Deterministic build flags.** The build profile records the flags intended to
  make output deterministic (documented as intent; their implementation is a
  future stage).
- **Timestamp handling.** `buildTimestampPolicy` documents how timestamps are
  normalized so a build clock does not leak into or perturb the artifact.
- **Build environment note.** `notes` records the environment assumptions a
  reproduction requires.
- **State reproducibility gaps honestly.** If byte-for-byte reproducibility is not
  yet achieved, the manifest/`notes` say so — it is never implied as solved.

## 8. Test-vector linkage

- **Connects to the crypto test-vector plan.** `testVectorSet` references the
  vectors defined in [`crypto_test_vectors.md`](crypto_test_vectors.md).
- **Named in the manifest.** The manifest records WHICH vector set (source +
  revision) a given artifact was validated against.
- **Gate before runtime selection.** A Rust core MUST pass those vectors before it
  can be selected at runtime — provenance (this doc) and correctness
  (test vectors) are both preconditions, behind the existing disabled-by-default
  gates (Stages 63–65).

## 9. Relationship to the runtime loader

- **Connects to the WASM loader safety rules.** See
  [`fedos_core_wasm_safety.md`](fedos_core_wasm_safety.md).
- **The loader does not read the manifest yet.** Stage 63's loader is a seam only;
  it loads nothing and consults no manifest.
- **A future manifest-validation boundary.** A later explicit stage would add a
  boundary that validates a manifest (digests, dependency lock, test-vector set,
  and eventually signature) BEFORE any module is considered loadable.
- **No validation ⇒ no load.** The policy is fixed now: without a passing manifest
  validation, a real module must never be loaded — the loader stays
  disabled/`error`, never "load anyway".

## 10. Future file layout

When a real manifest is eventually adopted, it would live with the FedOS package,
e.g.:

- `packages/fedos-core-rust/manifest.example.json` — an EXAMPLE manifest showing
  the §3 fields with placeholder, non-secret values (added in a future stage, not
  now).
- `packages/fedos-core-rust/build/` — build outputs; **not added** (no build).
- `test-vectors/` — the vector tree from
  [`crypto_test_vectors.md`](crypto_test_vectors.md) §10; **not added**.

Nothing in this list is created in this stage — docs only.

## 11. Current conclusion

- **Docs only.** This stage adds no code and changes nothing under `src/` or
  `packages/fedos-core-rust/src/`.
- **No manifest JSON yet.** No `manifest.example.json`, no `build/`, no
  `test-vectors/` are committed.
- **No WASM.** No `.wasm` artifact and no hashing/signing tooling.
- **No Rust.** No `Cargo.toml`, no `.rs`, no build script.
- **A future explicit stage is required.** A real manifest, real digests, real
  signing/verification, and a manifest-validation boundary each land as their own
  reviewed stages — never grown silently out of these docs.
