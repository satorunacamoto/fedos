# 17 — Release Security Threat Model

## Threat categories (all required categories covered)

| Threat | Mitigated by | Residual risk (honest) |
|---|---|---|
| Compromised build machine | dirty-tree builds forbidden (`10`); git-commit binding in release notes (`10`) lets a later audit compare a suspicious artifact's claimed commit against the real repository history | no build reproducibility/attestation system exists (e.g. reproducible builds, SLSA provenance) — a compromised build machine at build TIME could still produce a divergent artifact from a clean-looking commit; not solved by this review |
| Compromised release account (whatever account publishes to the canonical host, `16`) | none currently, since no account/host is evidenced yet | this is the single largest unmitigated risk category for an unsigned Beta — a compromised publishing account could replace both the artifact AND its own published checksum simultaneously; code signing (`05`, deferred) would not even fully solve this unless the signing key is held completely separately from the publishing account |
| Stolen signing certificate | not applicable for V1 (no certificate exists, `05`) | when a certificate is eventually adopted, its custody/revocation procedure (`05`) becomes the relevant control; not designed here |
| Malicious mirror | mirror-checksum-verification requirement (`16`) | only effective if users actually verify; no automated mirror-monitoring exists |
| Substituted binary | SHA-256 checksum publication (`07`) | only effective if the checksum itself was published through a channel not simultaneously compromised (see "compromised release account" above) |
| Substituted WASM | the existing, reused `fedos_production_wasm_artifact_manifest.ts` hash-recompute-at-verify-time mechanism (`08`) — this is a REAL, already-implemented, already-tested control, not a gap | none identified beyond the general "compromised build machine" caveat above (a compromised build machine could produce a self-consistent-but-malicious WASM+manifest pair that still passes its own internal verification) |
| Stale release | version/channel policy (`09`/`10`) names an explicit version per release; release notes are expected to state the current recommended version | no automated "you are running an old version" notice exists (consistent with `15`'s own "no automatic update" decision) — a stale-but-still-functioning install could persist indefinitely without update pressure; accepted as a known Beta 0.1 limitation, not a defect |
| Downgrade attack | `13`'s own explicit "downgrade only when schema-compatible, otherwise restore from backup" policy | this review has no technical enforcement preventing a user from manually downgrading into an unsafe state — the accepted codecs' own fail-closed behavior (`11`) is the only backstop, and it fails closed to `"recovery-required"`, not to a graceful migration |
| Update metadata compromise | not applicable for V1 (no update metadata/mechanism exists, `15`) | becomes relevant only if/when an update mechanism (`15`, option B/C+) is later adopted — must be designed with this threat in mind at that time |
| Malicious installer (a THIRD PARTY repackaging FedOS Desktop with malware inside an installer wrapper and redistributing it) | checksum verification (`07`) against the CANONICAL host's own published values would reveal a mismatch — but only if the user checks against the real canonical source, not a spoofed one | this is fundamentally a "does the user know the real canonical URL" problem (`16`'s own "anti-confusion policy") — no technical control fully prevents a convincing fake distribution site |
| Tampered profile (on the user's own local disk) | every codec's own fail-closed corruption handling (`11`) — a tampered profile fails closed rather than silently loading altered data | this codebase's persisted records are not independently cryptographically signed/MAC'd against local tampering (only the sealed Master Seed envelope itself is AEAD-sealed) — a sophisticated local attacker with write access to the profile directory could still corrupt non-secret records in ways that pass structural validation; local-machine compromise is explicitly out of this project's own accepted protection boundary (matches the existing Beta limitations model's own "local malware is outside the protection boundary" statement) |
| User downloading a fake "FedOS" from an unrelated site | the anti-confusion policy (`16` — exactly one published canonical URL) | this review cannot prevent search-engine/typosquatting confusion; release notes/announcements should always link the canonical URL directly rather than telling users to "search for it" |
| Local malware (already running on the user's machine) | explicitly OUT OF SCOPE — already an accepted Beta limitation (`src/desktop/beta/fedos_desktop_beta_limitations.ts`'s own `"local-malware-out-of-scope"` entry, unmodified, cited not duplicated) | none claimed; this review does not invent a new anti-malware boundary |
| Certificate expiry/revocation | not applicable for V1 (no certificate, `05`) | becomes relevant once a certificate is adopted; the certificate's own custody/renewal process (not designed here) must account for it |
| Build dependency compromise (a compromised npm/cargo package) | none specific to distribution; this is a general supply-chain concern for the whole project, not unique to packaging/signing | out of this review's own scope (Absolute Prohibition: no dependency changes); flagged as a general project concern, not resolved here |
| Package-manager compromise (npm registry, crates.io) | same as above | same as above |

## The exact boundary of signing, hashes, and manifests (restated plainly)

- **The WASM artifact manifest (`08`)** proves the BUNDLED WASM binary
  inside a given package matches what that package's own build produced
  — an internal, already-solved integrity problem.
- **A release checksum (`07`)** proves the bytes a user downloaded match
  what was published under that filename at the canonical host — it says
  nothing about who controls that host or whether the host itself was
  compromised.
- **Code signing (`05`, not present for Beta 0.1)** would additionally
  bind a publisher IDENTITY to the binary, independent of which host
  served it — but proves nothing about malware absence or reputation on
  its own (`06`).
- **None of the three** solve "is the canonical host/account itself
  trustworthy right now" — that remains a governance/operational-security
  question outside what any of these three mechanisms can technically
  guarantee.
