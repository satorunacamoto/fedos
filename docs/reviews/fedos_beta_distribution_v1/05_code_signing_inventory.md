# 05 — Code Signing Inventory

## Current signing state — proven current source

Grepped directly (`git grep`, this worktree): no `certificateFile`,
`certificatePassword`, `cscKeyPassword`, `CSC_LINK`, `CSC_KEY_PASSWORD`,
`signtool`, or any `win.sign`/`forceCodeSigning` key exists anywhere in
either `electron_builder.config.json` or `electron_builder.beta.config.json`,
nor in any `.mjs` packaging script, nor in any `package.json`. No
environment-variable hook for a signing secret is referenced anywhere in
this repository. **Conclusion: every packaged artifact ever built from
this repository has been, and remains, completely unsigned.** electron-builder's
own default behavior (no config → skip signing, emit a warning) applies;
prior execution evidence (`01`) of a real `electron-builder` run in this
repository shows exactly that — a real signed `.exe` was produced only
via a SEPARATE, ad hoc, non-repository test-signing step in one prior
session (a locally available `signtool.exe` self-signed the binary for
that session's own local verification only, never a real, evidenced
organizational certificate — see `06` for why this proves nothing about
public reputation).

## Options compared

| | A. Unsigned public Beta | B. Self-signed certificate | C. Standard org code-signing cert | D. EV code-signing cert | E. Microsoft Store signing | F. Deferred signing, explicit warning |
|---|---|---|---|---|---|---|
| What it proves | nothing about publisher identity | a private key was held by SOMEONE at build time; proves nothing about WHO | a CA-vetted organization identity signed the binary | a CA-vetted organization identity, plus stronger identity-proofing at issuance | Microsoft's own Store vetting + a Store-issued identity | nothing; same as A |
| What it does NOT prove | absence of malware; publisher trustworthiness | publisher identity (self-signed certs are NOT chained to a trusted root) | absence of malware (signing != malware scanning) | absence of malware | absence of malware (Store review reduces but does not eliminate risk) | same as A |
| Operational cost | none | low (can be generated locally, e.g. via `New-SelfSignedCertificate` or OpenSSL) | recurring cost (typically annual), identity-verification paperwork, lead time | higher recurring cost, hardware-token custody requirement (most EV issuers require an HSM/USB token) | a Microsoft Developer/Store account, its own review process | none |
| Certificate custody | n/a | whoever generates it (must never be the repository) | an organization officer, outside version control | same, plus physical HSM/token custody | Microsoft-mediated | n/a |
| Build reproducibility implications | fully reproducible (no external secret needed) | requires the signing key to be available at every build — a real secret-management burden | same | same, plus the token must be physically present or remotely accessible at sign time | Store packaging step, different pipeline | fully reproducible |
| Revocation implications | n/a | self-signed certs are typically NOT published to a revocation authority — revocation is meaningless in practice | can be revoked via the issuing CA if compromised | same, generally faster CA response for EV | Microsoft can pull the Store listing | n/a |
| SmartScreen implications | full "Windows protected your PC" warning on first run, until enough real-world reputation accrues (`06`) | SmartScreen still warns — a self-signed cert is NOT trusted by Windows by default | reduces but does not eliminate warnings; reputation still accrues per-binary/per-certificate over time | historically reduced/bypassed the reputation-accrual period more aggressively than standard signing, though Microsoft has adjusted SmartScreen behavior over time and this is NOT guaranteed (`06`) | Store apps bypass SmartScreen (Store's own trust model replaces it) | same as A |

## Decision for Beta 0.1

**F — deferred signing, with an explicit, honest installation-warning
disclosure to every Beta user (`06`).** No certificate of any kind exists
in evidence for this project; none is created, requested, or referenced
by this review (Absolute Prohibition). Standard organization code-signing
(C) is named as the target for a POST-Beta-0.1 milestone once the
project has a real legal/organizational identity to attach a certificate
to — not decided or committed to here.

## Explicit non-recommendations

This review does **not** recommend generating a self-signed certificate
for public distribution (B) — it would give users a false sense of
verified identity while providing none, and Windows will still warn.
This review does **not** recommend EV signing for Beta 0.1 (D) — the cost
and custody burden is disproportionate to a Beta release with no
evidenced revenue/organizational backing. This review does **not**
recommend Microsoft Store distribution for Beta 0.1 (E) — no Store
account, listing, or MSIX packaging work is evidenced (`03`).

**No signing secret, certificate, or private key is created, stored, or
referenced anywhere in this review's own files.**
