// Secure Runtime Alpha 5321-5400 -- Phase J: the ONE versioned release-
// status / revocation-advisory record. Pure value object -- no network
// call, no remote kill-switch, no application dependency on live status
// (Phase J's own Absolute Prohibitions: "do not implement remote kill
// switches", "do not make an installed application dependent on live
// revocation checks" -- this record is a PUBLISHED, human-authored
// artifact staged alongside a release for informational/advisory
// purposes only; nothing in the packaged application ever reads it).

/** Phase J — the CLOSED release-status vocabulary. */
export const FEDOS_RELEASE_STATUSES = Object.freeze(["candidate", "published", "deprecated", "revoked", "superseded"]);

/** Severity vocabulary for an advisory (mirrors this repository's own established Alpha-arc blocker-severity convention). */
export const FEDOS_ADVISORY_SEVERITIES = Object.freeze(["release-blocking", "high", "medium", "low", "accepted-beta-limitation"]);

const REQUIRED_FIELDS = Object.freeze(["schemaVersion", "status", "affectedVersion", "publicationTimestamp", "canonicalAdvisoryLocationPolicy"]);

/**
 * Builds one closed revocation/status record. `status: "candidate"` (this
 * Arc's own default) means "built and staged, not yet published" -- the
 * honest state every artifact this Arc produces is actually in. An
 * advisory's extra fields (`severity`/`reason`/etc.) are REQUIRED only
 * when `status` is `"deprecated"` or `"revoked"` — a plain `"candidate"`/
 * `"published"`/`"superseded"` record needs none of them.
 */
export function buildFedosReleaseStatusRecordV1({
  status,
  affectedVersion,
  affectedArtifacts = [],
  severity,
  reason,
  securityImpact,
  dataLossImpact,
  recommendedAction,
  replacementVersion = null,
  profileCompatibilityWarning,
  publicationTimestamp = new Date().toISOString(),
  canonicalAdvisoryLocationPolicy,
}) {
  if (!FEDOS_RELEASE_STATUSES.includes(status)) {
    throw new Error(`[revocation-status] status must be one of ${FEDOS_RELEASE_STATUSES.join(", ")}, got "${status}"`);
  }
  const isAdvisory = status === "deprecated" || status === "revoked";
  if (isAdvisory) {
    if (!FEDOS_ADVISORY_SEVERITIES.includes(severity)) {
      throw new Error(`[revocation-status] an advisory (status="${status}") requires severity to be one of ${FEDOS_ADVISORY_SEVERITIES.join(", ")}`);
    }
    for (const [name, value] of Object.entries({ reason, securityImpact, dataLossImpact, recommendedAction })) {
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`[revocation-status] an advisory (status="${status}") requires a non-empty "${name}"`);
      }
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    status,
    affectedVersion,
    affectedArtifacts: Object.freeze([...affectedArtifacts]),
    severity: isAdvisory ? severity : null,
    reason: isAdvisory ? reason : null,
    securityImpact: isAdvisory ? securityImpact : null,
    dataLossImpact: isAdvisory ? dataLossImpact : null,
    recommendedAction: isAdvisory ? recommendedAction : null,
    replacementVersion,
    profileCompatibilityWarning: profileCompatibilityWarning ?? null,
    publicationTimestamp,
    canonicalAdvisoryLocationPolicy,
  });
}

/** Strict validation mirroring every other closed record's own "reject unknown/missing field" discipline. */
export function validateFedosReleaseStatusRecordV1(candidate) {
  const problems = [];
  if (typeof candidate !== "object" || candidate === null) return { ok: false, problems: [{ kind: "malformed" }] };
  if (candidate.schemaVersion !== 1) problems.push({ kind: "unsupported-schema-version", value: candidate.schemaVersion });
  if (!FEDOS_RELEASE_STATUSES.includes(candidate.status)) problems.push({ kind: "invalid-status", value: candidate.status });
  for (const field of REQUIRED_FIELDS) {
    if (candidate[field] === undefined || candidate[field] === null || candidate[field] === "") {
      problems.push({ kind: "missing-required-field", field });
    }
  }
  const isAdvisory = candidate.status === "deprecated" || candidate.status === "revoked";
  if (isAdvisory && !FEDOS_ADVISORY_SEVERITIES.includes(candidate.severity)) {
    problems.push({ kind: "advisory-missing-severity" });
  }
  return problems.length === 0 ? { ok: true, problems: [] } : { ok: false, problems };
}
