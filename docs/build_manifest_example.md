# FedOS Core Build Manifest — Example (illustrative, non-normative)

**Status: this document adds no code and commits no manifest.** It shows an
ILLUSTRATIVE example of what a future build manifest might look like, using
the fields already fixed in
[`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) §3, with
placeholder values. This is **not** a real manifest, **not** a schema
definition, and **not** the file
`packages/fedos-core-rust/manifest.example.json` named as a future candidate
in [`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) §10 — that
file, if and when it is added, is a separate future Stage's own decision.
The example below exists only inside this markdown document.

No manifest JSON file is added anywhere in the repository in this stage. If
a future change would treat this example as authoritative or wire it up
anywhere, that is a violation — the example is illustration only.

This complements
[`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) (the field
definitions and rules this example merely illustrates) and
[`verification_infrastructure.md`](verification_infrastructure.md) (§9,
where a manifest is one of five runtime-gate preconditions).

---

## 1. Purpose

- **Make the §3 field list from
  [`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) concrete**,
  so a future Stage that actually writes a manifest generator has a
  worked example to check its output shape against.
- **Placeholder values only.** Every value below is fabricated for
  illustration; none corresponds to a real build, a real commit, or a real
  artifact.
- **Not a schema, not a spec.** [`fedos_core_build_manifest.md`](fedos_core_build_manifest.md)
  remains the authoritative field list and rules; if this example and that
  document ever disagree, that document wins.

## 2. Illustrative example

```jsonc
{
  "manifestVersion": "0.1.0-example",
  "packageName": "fedos-core-rust",
  "rustToolchain": "stable-1.79.0-x86_64-unknown-linux-gnu",
  "sourceRevision": "0000000000000000000000000000000000000",
  "sourceTreeDigest": "sha256:EXAMPLE00000000000000000000000000000000000000000000000000",
  "wasmTarget": "wasm32-unknown-unknown",
  "buildProfile": "release (example: opt-level=z, lto=true — illustrative only)",
  "dependencyLockDigest": "sha256:EXAMPLE00000000000000000000000000000000000000000000000000",
  "testVectorSet": {
    "chacha20poly1305": "test-vectors/aead/chacha20poly1305-rfc8439.json@EXAMPLE_REVISION",
    "hkdfSha256": "test-vectors/kdf/hkdf-sha256-rfc5869.json@EXAMPLE_REVISION"
  },
  "wasmArtifactDigest": "sha256:EXAMPLE00000000000000000000000000000000000000000000000000",
  "signatureRef": "example://unset — no signing implemented yet",
  "provenanceRef": "example://unset — no provenance attestation implemented yet",
  "buildTimestampPolicy": "normalized (example: SOURCE_DATE_EPOCH pinned to sourceRevision commit time — illustrative only)",
  "notes": "ILLUSTRATIVE EXAMPLE ONLY. Not a real build. No artifact exists. All digests, revisions, and refs above are placeholders."
}
```

## 3. Field-by-field notes on the example

- **`manifestVersion`** — `"0.1.0-example"` is a placeholder; the real
  schema version, once a manifest generator exists, is decided in that
  future Stage.
- **`packageName`** — matches the crate name
  (`packages/fedos-core-rust/Cargo.toml`'s `name`), the one concrete value
  here that is not arbitrary.
- **`rustToolchain`** — shown as a channel+version+target triple; the actual
  pinned toolchain is decided when toolchain pinning is implemented
  ([`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) §7).
- **`sourceRevision`** / **`sourceTreeDigest`** — all-zero / `EXAMPLE`
  placeholders; a real value is a git commit hash and a real tree digest,
  never fabricated.
- **`dependencyLockDigest`** — placeholder; would be computed over a real
  lockfile once dependencies exist (currently `[dependencies]` is empty, so
  there is nothing to digest).
- **`testVectorSet`** — shown as an object mapping primitive name to a
  vector-file reference plus revision, matching the file layout named in
  [`crypto_vector_sources.md`](crypto_vector_sources.md) §10 and
  [`test-vectors/README.md`](../test-vectors/README.md) — this exact shape
  (object vs. array, key naming) is illustrative, not binding; a future
  Stage may adjust it when the manifest is actually generated.
- **`wasmArtifactDigest`** — placeholder; there is no `.wasm` artifact to
  digest yet (no WASM target, no `cdylib`, per
  [`fedos_core_rust_safety.md`](fedos_core_rust_safety.md) §8).
- **`signatureRef`** / **`provenanceRef`** — explicitly shown as `unset`
  with a note, since signing/provenance attestation is a future candidate,
  not implemented ([`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) §6).
- **`buildTimestampPolicy`** — shown as a normalization strategy label, not
  a timestamp value, per
  [`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) §7.
- **`notes`** — deliberately states, inside the example itself, that it is
  fabricated — so that if this block were ever copy-pasted out of context,
  it still self-identifies as non-real.

## 4. What this example deliberately omits

- **No secret, key, token, or credential appears** — every value is either a
  fabricated digest/hash-shaped placeholder or a policy label, consistent
  with [`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) §4's
  forbidden-field list.
- **No local/machine-specific path** — no home directory, no absolute build
  path, nothing host-identifying.
- **No real digest** — every `sha256:` value above is the literal string
  `EXAMPLE...`, not a computed hash of anything, so it can never be mistaken
  for or accidentally trusted as a real artifact identity.

## 5. Current conclusion

- **Docs only.** No manifest JSON file is added anywhere in the repository —
  the example in §2 exists solely inside this markdown file's fenced code
  block.
- **No `packages/fedos-core-rust/manifest.example.json`** is created in this
  stage; that remains a named-but-deferred future candidate
  ([`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) §10).
- **No Rust, no WASM, no build script, no hashing/signing tooling** is added
  or implied as working by this example.
- **Authoritative source stays [`fedos_core_build_manifest.md`](fedos_core_build_manifest.md).**
  This file only illustrates it.
