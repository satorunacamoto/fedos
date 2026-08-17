# Current Release Truth (as of CandidateHead 8712add7 / EvidenceHead f57812a0)

## Artifact traceability

- Cargo.lock now exists and is tracked — resolved-dependency-graph reproducibility gap
  from the original audit is closed.
- WASM glue-file integrity gap remains: `importGlue()` executes the glue module before
  any hash check, and the manifest schema has no field to hash it at all even if checked
  later. Reachability from real app boot is now definitively confirmed (previously
  unconfirmed) — this makes the gap more concretely actionable, not merely theoretical.
- Tor strict-transport packaging (the historical files-allowlist P0 that caused a
  crash-on-every-launch) is fixed and re-verified complete; no similar gap found
  elsewhere on the real packaged path.

## Checksum / install docs

Fixed. `docs/pilot/INSTALLATION.md` now names the real artifact files
(`FedOS-Desktop-Beta-Setup-<version>.exe`, `SHA256SUMS.txt`) exactly as produced by
`electron_builder.beta.config.json` / `generate_release_checksums.mjs`.

## Install / upgrade / uninstall

Still NOT TESTED. `generate_public_beta_gate.mjs` continues to self-score
`install-uninstall-tested`, `profile-preservation-tested`, and `same-schema-upgrade-tested`
as `"accepted-limitation"` — nothing in the repo has ever set these to `true`. This
remains the single largest untested real-world release path.

## CI vs. local release pipeline

Two distinct things, correctly separated this pass:
- **Remote CI** (`.github/workflows/ci.yml`): thin — ~10% of test files gated, no Rust/
  WASM build, no packaging, typecheck explicitly ungated. Gap is real but honestly
  self-documented in the workflow file itself, not hidden.
- **Local release pipeline** (`build_release.mjs`, documented in `BUILDING.md`): a real
  14-step sequence including packaged dependency-closure verification, checksum
  generation + independent re-verification, and the beta-readiness gate script running
  as a hard-fail step. This is load-bearing and genuinely strong.

Net: thin remote CI + strong local gate is a real but bounded risk (a merge to `main`
could regress the Rust/WASM/packaging layer without CI catching it, but the actual
release-cutting process itself is well-gated when a human runs it locally). P1, not P0.

## Documentation accuracy

- Commerce disclosure in README.md is accurate and up to date for this lineage.
- Tor/onion-routing disclosure is now stale in the "we don't have this" direction — see
  `04_CURRENT_SECURITY_TRUTH.md`. P2, recommend a doc update before any release that
  might expose the (currently disabled-by-default) Tor path.
- Forward-secrecy-default disclosure was not independently re-verified this pass against
  current pilot docs (out of scope for the 4 reconciliation agents); the underlying
  architecture fact (legacy NIP-17 remains the ordinary-launch default) is unchanged
  from the original audit.

## Not evaluated this pass (recommend before final GO)

- Full `cargo test` / `cargo build` / WASM build / Electron packaging run against this
  exact CandidateHead (agents avoided heavy builds during the reconciliation/classification
  pass by design — reserved for the fix-and-gate phase).
- Live installed-binary NSIS install/upgrade/uninstall test.
- Fresh Commerce and Secrets red-team passes (not in scope for this reconciliation's 4
  agents).
