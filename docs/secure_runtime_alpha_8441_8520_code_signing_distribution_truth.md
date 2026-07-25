# Secure Runtime Alpha 8441-8520 — Code-Signing and Distribution Truth

Verifies actual release artifacts directly, not by trusting build-log
output or a prior claim.

## Independent Authenticode verification (this session, this Arc)

Ran `Get-AuthenticodeSignature` directly against the real, freshly-built
NSIS installer (`FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`, produced
earlier this session by a real `npm run release:beta` run, commit
`86825157` on `release/fedos-desktop-beta-0.1`):

```
Status            : NotSigned
StatusMessage     : The file ... is not digitally signed.
SignerCertificate :
```

**Confirmed unsigned, independently, not by trusting the build log or
the release manifest's own `"unsigned": true` field** (though that
field agrees).

## Why the build log mentions "signing with signtool.exe" for an unsigned artifact

The real `npm run release:beta` run this session produced these lines:

```
• signing with signtool.exe  path=dist-package-beta\win-unpacked\FedOS Desktop Beta.exe
...
• signing with signtool.exe  path=dist-package-beta\win-unpacked\resources\elevate.exe
• signing with signtool.exe  path=dist-package-beta\FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe
```

This is `electron-builder`'s own generic pipeline step name — it
invokes `signtool.exe` unconditionally as part of its packaging flow
(the same step handles both real signing, when a certificate is
configured, and a self-consistency/manifest-embedding pass when none
is) — it does **not** by itself mean a valid signature was produced.
This session's own `packages/fedos-desktop-electron-spike/scripts/lib/signing_readiness.mjs`
(a real, pre-existing, non-secret readiness-inventory module — see
below) independently confirms no certificate is configured, and the
direct Authenticode check above confirms the resulting artifact is
genuinely unsigned. **Do not infer "signed" from a build log alone —
this exact log wording is a known, easy misreading this document
records so it doesn't happen again.**

## Real, current signing-readiness inventory

Ran `inspectFedosSigningToolchain()` (existing code,
`packages/fedos-desktop-electron-spike/scripts/lib/signing_readiness.mjs`
— safe, non-secret: checks only whether `signtool.exe` exists and
whether a certificate/env-var is CONFIGURED, never reads certificate or
key material) against the real `electron_builder.beta.config.json`,
this session, this environment:

```json
{
  "signtoolAvailable": false,
  "configReferencesSigningHook": false,
  "signingEnvVarNamesPresent": [],
  "certificateConfigured": false
}
```

Then `assessFedosSigningReadiness()` (same module, pure function, no
certificate bytes ever touched):

```json
{
  "outcome": "unsigned-allowed-for-beta",
  "reason": "no code-signing certificate is configured; the accepted V1 distribution policy explicitly allows an unsigned Beta 0.1 release"
}
```

**No certificate absence was assumed — it was checked.** No certificate
was purchased, requested, or used to produce this result, consistent
with this Arc's own absolute prohibitions.

## SmartScreen implications

Because the installer is unsigned, Windows SmartScreen will show an
"unrecognized publisher" warning (or, for some SmartScreen reputation
states, a stronger "Windows protected your PC" block requiring
"More info" → "Run anyway") the first time a pilot participant runs it.
This is expected, disclosed behavior for this Closed Beta — not a
malware false positive to instruct participants to blindly dismiss
without understanding, and not something this document instructs
anyone to work around.

## Checksum verification (integrity, not authenticity)

The real release pipeline (see `BUILDING.md`) independently re-derives
SHA-256 checksums for every artifact and re-verifies them against its
own generated `SHA256SUMS.txt` before declaring success — this session's
own real run did so successfully (`[verify-checksums] OK -- 3 file(s)
verified`). **A matching checksum proves the file you have matches the
file that was built — it proves nothing about who built it.** Only a
real code-signing certificate (or an out-of-band, independently
verified provenance channel) can establish authenticity; this Beta has
neither yet.

## Manual download/update policy

There is no automatic update mechanism (a repository-wide absolute
prohibition this Arc did not touch or reconsider) and no signed-update
verification, because there is no signing at all yet. Every new Beta
build must be manually downloaded and installed by each pilot
participant; there is no way to cryptographically verify a downloaded
build actually came from the project maintainers beyond checksum
integrity (see above) and whatever out-of-band trust channel your pilot
coordinator establishes (e.g. handing you the file directly, or a
private, access-controlled distribution channel).

## Exact release provenance (this session's own real build)

- Git commit: `86825157a2340099732b3d3a2547c8f746ca5cc6` (on
  `release/fedos-desktop-beta-0.1`)
- WASM artifact SHA-256: `10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a`
- NSIS installer SHA-256: `a458bdec579f87bcd71fc44b02b7d4122ab87bf87691f46506a9453953ff3f05`
  (101,833,183 bytes)
- Portable ZIP SHA-256: `753904e2a8b4a44299cb740ccae0c39244f3c01a417441f537b156994392486c`
  (368,529,263 bytes)
- `unsigned: true` (release manifest's own field, now independently
  confirmed by direct Authenticode check above, not merely trusted)

## HUMAN DECISION REQUIRED — unsigned Closed Beta vs. signed Public Beta vs. deferring Public Beta

This Arc does not choose between these. A human with the authority to
do so must:

| Option | What it means | Real cost/consequence |
|---|---|---|
| **Ship Closed Beta unsigned, as today** | Pilot participants see a SmartScreen warning and must be told, out-of-band, to trust the specific build they were handed. | No certificate cost. Already the current, accepted state — this Arc changes nothing here, only documents it precisely. Acceptable ONLY for a small, trusted, directly-contacted pilot cohort, not a public download. |
| **Obtain a real code-signing certificate before Public Beta** | Requires purchasing/obtaining a certificate from a real Certificate Authority (a cost and identity-verification process this Arc does not initiate — see absolute prohibitions), configuring `CSC_LINK`/`CSC_KEY_PASSWORD` (or `win.certificateFile`) for `electron-builder`, and a real signed rebuild + re-verification via this same `Get-AuthenticodeSignature` check before any Public Beta release. | Removes the SmartScreen warning (or reduces it, depending on certificate reputation/EV status) and establishes real publisher authenticity. Real budget/vendor decision — explicitly listed as a human-decision boundary this Arc must not make. |
| **Defer Public Beta indefinitely until signing (and the other Public Beta gates — audit, license, legal) are resolved** | Closed Beta continues; no wider release happens. | No new cost. This is the DEFAULT outcome if no explicit decision is made — silence is not consent to ship unsigned at Public Beta scale. |

**Public Beta Go requires an explicit human signing decision, even if
the answer is "ship unsigned with clear disclosure."** This Arc does
not make that decision on anyone's behalf.
