# Disclosure Policy

This document consolidates the repository's current, real disclosure
posture (`SECURITY.md`), the draft disclosure material produced by the
Public Docs Security-Claims Audit (deliberately left as placeholders, not
invented), and the release-governance findings of the Closed Beta
Operations and Audit Readiness review. It does not invent any contact
detail, SLA, or process that does not already exist — every placeholder
below is named as a placeholder, not silently filled in.

## 1. Current reporting channel (as of `master` today)

From `SECURITY.md` directly: **"If you find a security issue, please open
a private report through whatever channel the maintainers of this
repository currently designate for that purpose."** No email address, PGP
key, or response-SLA is published — `SECURITY.md`'s own source comment
states this is deliberate: "Contact details intentionally left as a
placeholder: this file does not invent an email address, response SLA, or
bug-bounty program that does not yet exist." **Do not open a public issue
for an unpatched vulnerability.**

This is named, independently, as the single most directly pilot-blocking
gap by the Closed Beta Operations and Audit Readiness review (item 40 of
its 45-item matrix, classified **BLOCKED**) — the security-report template
that review drafted (item 13, also BLOCKED for the same underlying reason)
has nowhere to route to without this being filled in first.

**Recommended action (a human decision, not performed by this bundle):**
designate a real reporting channel (email/PGP or a private-issue mechanism)
and fill this in. This alone would close two of the nine BLOCKED items in
the Closed Beta Operations review's own matrix.

## 2. Placeholder roles (named, not filled in)

The Closed Beta Operations review names four roles whose absence blocks
several of its own matrix items — this bundle restates them, does not
invent names for them:

- **Release approver** (blocks item 36 — who must approve release
  artifacts)
- **Security reviewer** (blocks disclosure coordination, item 33)
- **Pilot coordinator** (blocks pilot scope/eligibility human-input items)
- **Audit commissioner** (blocks the actual commissioning of an
  independent audit using this bundle)

## 3. Draft public-safe security statement (from the Public Docs
   Security-Claims Audit, not yet formally adopted)

Structured as: protects / partially protects / does not protect / cannot
prove / has tested / has not externally audited. On the last point, the
audit's own finding, quoted verbatim: **"Nothing."** — no external audit
reference was found anywhere in the repository at the time of that review,
and none exists today. `SECURITY.md`'s current "Current status" section is
this project's adopted, real version of this same discipline — treat it as
authoritative over the audit's own draft where the two differ, since
`SECURITY.md` is the merged, current document.

## 4. Severity rubric (from the audit-prep base package, `8e730f25` §18)

CRITICAL / HIGH / MEDIUM / LOW / INFORMATIONAL, with worked examples
already anchored to this codebase: **HIGH** = the `fedos-acceptance:*`
surface (a live, unauthenticated-beyond-process-boundary trust boundary
today); **LOW** = lack of OS-level memory-page-locking (`mlock`/
`VirtualLock`). An external finding should be triaged against
[`05_known_issues.md`](05_known_issues.md) first — restating an
already-known, already-disclosed item should be labeled **CONFIRMED**, not
**NEW**, in a formal audit report; this is the audit-prep package's own
explicit requirement (§19), reused here.

## 5. Remediation / retest / disclosure-coordination workflow

Drafted by the Closed Beta Operations review (its docs 13, items 30-33):
expected deliverable format, a remediation workflow, retest requirements,
and disclosure coordination — the last of these is currently **BLOCKED**
for the same reason as §1 above (no real reporting channel exists yet to
coordinate through). Evidence-retention requirements and audit-completion
criteria (its doc 14, items 34-35) are drafted and rated READY / READY
WITH HUMAN INPUT respectively — see the source document for the full text
(Evidence Index).

## 6. Incident severity vocabulary (already real, reused, not re-derived)

The existing Closed Pilot Runbook's SEV-1..4 vocabulary and pilot exit
criteria (`docs/secure_runtime_alpha_8121_8200_closed_pilot_runbook.md`)
are already correct and already in real use — this disclosure policy
reuses them rather than defining a competing vocabulary. Use SEV-1..4 for
any finding severity classification arising from an external audit, not a
new scale.

## 7. What this bundle deliberately does not do

Consistent with every prior review's own discipline on this point, this
bundle does not fabricate a contact email, a PGP key, a response-time SLA,
a bug-bounty program, or named individuals for the four placeholder roles
in §2. Filling these in requires a real decision by whoever currently
maintains this repository, not invented content — inventing them here
would make this bundle less trustworthy to an external auditor, not more.
