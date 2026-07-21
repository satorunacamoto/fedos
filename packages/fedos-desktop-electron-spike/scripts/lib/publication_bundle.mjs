// Secure Runtime Alpha 5321-5400 -- Phase B/C: `FedosBetaPublicationBundleV1`.
//
// The ONE versioned publication-bundle descriptor referencing the already
// -built, already-checksummed release artifacts by FILENAME and HASH only
// -- it never embeds installer/ZIP bytes, never carries a credential, and
// never records a local absolute build path. Deterministic field
// ordering (a fixed key order in `buildFedosBetaPublicationBundleV1`'s
// own return object, mirrored by `JSON.stringify(bundle, null, 2)` at the
// call site) and strict, unknown-field-rejecting validation
// (`validateFedosBetaPublicationBundleV1`) mirror every other closed
// record format already accepted in this codebase (e.g.
// `fedos_production_wasm_artifact_manifest.ts`'s own
// `parseFedosProductionWasmArtifactManifest`).

/** Phase B — the CLOSED canonical-host policy vocabulary. `local-only` is the honest, currently-accurate value: no git remote or hosting account is configured anywhere in this repository (verified `git remote -v` returns nothing, this Arc's own reconciliation report). */
export const FEDOS_BETA_CANONICAL_HOST_POLICIES = Object.freeze([
  "local-only",
  "self-hosted-https",
  "github-releases",
  "cloudflare-r2",
  "university-hosted-https",
]);

const REQUIRED_STRING_FIELDS = Object.freeze([
  "productVersion",
  "channel",
  "gitCommit",
  "buildIdentity",
  "releaseDate",
  "canonicalHostPolicy",
  "releaseManifestFilename",
  "checksumFilename",
  "releaseNotesFilename",
  "knownLimitationsFilename",
  "installationGuideFilename",
  "securityNoticeFilename",
  "revocationStatusFilename",
  "minimumWindowsVersion",
  "architecture",
]);

/** Deep-freezes a plain object/array recursively -- mirrors `Object.freeze` usage throughout this codebase's own accepted value objects. */
function deepFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze));
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = deepFreeze(value[key]);
    return Object.freeze(value);
  }
  return value;
}

/**
 * Builds ONE `FedosBetaPublicationBundleV1` from the already-resolved
 * release identity, the already-generated release manifest's own
 * artifact records (filename/type/primary/sizeBytes/sha256Hex -- NEVER
 * bytes), and the fixed set of staging document filenames. Pure --
 * performs no I/O, reads no file, computes no hash itself (the caller
 * supplies already-computed artifact records from
 * `generate_release_manifest.mjs`'s own output, the single source of
 * truth for hashes).
 */
export function buildFedosBetaPublicationBundleV1({
  identity,
  artifacts,
  canonicalHostPolicy,
  releaseDate = new Date().toISOString(),
  releaseManifestFilename = "release-manifest.v1.json",
  checksumFilename = "SHA256SUMS.txt",
  releaseNotesFilename = "RELEASE_NOTES.md",
  knownLimitationsFilename = "KNOWN_LIMITATIONS.md",
  installationGuideFilename = "INSTALL_WINDOWS.md",
  securityNoticeFilename = "SECURITY_NOTICE.md",
  revocationStatusFilename = "REVOCATION_STATUS.json",
}) {
  if (!FEDOS_BETA_CANONICAL_HOST_POLICIES.includes(canonicalHostPolicy)) {
    throw new Error(`[publication-bundle] canonicalHostPolicy must be one of ${FEDOS_BETA_CANONICAL_HOST_POLICIES.join(", ")}, got "${canonicalHostPolicy}"`);
  }
  const seenFilenames = new Set();
  for (const artifact of artifacts) {
    if (seenFilenames.has(artifact.filename)) {
      throw new Error(`[publication-bundle] duplicate artifact filename: ${artifact.filename}`);
    }
    seenFilenames.add(artifact.filename);
  }

  return deepFreeze({
    schemaVersion: 1,
    productVersion: identity.productVersion,
    channel: identity.channel,
    gitCommit: identity.gitCommit,
    buildIdentity: identity.buildIdentity,
    unsigned: identity.unsigned,
    releaseDate,
    canonicalHostPolicy,
    artifacts: artifacts.map((a) => ({
      filename: a.filename,
      type: a.type,
      primary: a.primary,
      sizeBytes: a.sizeBytes,
      sha256Hex: a.sha256Hex,
    })),
    releaseManifestFilename,
    checksumFilename,
    releaseNotesFilename,
    knownLimitationsFilename,
    installationGuideFilename,
    securityNoticeFilename,
    revocationStatusFilename,
    minimumWindowsVersion: "Windows 10 (64-bit)",
    architecture: identity.architecture,
    supportedSchemaVersions: { ...identity.schemaVersions },
  });
}

const ALL_KNOWN_FIELDS = new Set([
  "schemaVersion",
  ...REQUIRED_STRING_FIELDS,
  "artifacts",
  "unsigned",
  "supportedSchemaVersions",
]);

/**
 * Strict validation: rejects an unknown top-level field, a missing
 * required field, a non-hex/wrong-length hash, a duplicate artifact
 * filename, or any artifact record missing a cross-referenced field.
 * Returns `{ok:true}` or `{ok:false, problems}` -- never throws for an
 * ordinary malformed candidate (only a genuinely unexpected shape, e.g.
 * `candidate` not even an object, is treated as a single "malformed"
 * problem).
 */
export function validateFedosBetaPublicationBundleV1(candidate) {
  const problems = [];
  if (typeof candidate !== "object" || candidate === null) {
    return { ok: false, problems: [{ kind: "malformed", detail: "not an object" }] };
  }

  for (const key of Object.keys(candidate)) {
    if (!ALL_KNOWN_FIELDS.has(key)) problems.push({ kind: "unknown-field", field: key });
  }
  if (candidate.schemaVersion !== 1) problems.push({ kind: "unsupported-schema-version", value: candidate.schemaVersion });
  if (typeof candidate.unsigned !== "boolean") problems.push({ kind: "missing-required-field", field: "unsigned" });
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof candidate[field] !== "string" || candidate[field].length === 0) {
      problems.push({ kind: "missing-required-field", field });
    }
  }
  if (typeof candidate.canonicalHostPolicy === "string" && !FEDOS_BETA_CANONICAL_HOST_POLICIES.includes(candidate.canonicalHostPolicy)) {
    problems.push({ kind: "invalid-canonical-host-policy", value: candidate.canonicalHostPolicy });
  }
  if (!Array.isArray(candidate.artifacts) || candidate.artifacts.length === 0) {
    problems.push({ kind: "missing-artifacts" });
  } else {
    const seen = new Set();
    for (const artifact of candidate.artifacts) {
      if (typeof artifact !== "object" || artifact === null) {
        problems.push({ kind: "malformed-artifact-record", artifact });
        continue;
      }
      if (typeof artifact.filename !== "string" || artifact.filename.length === 0) problems.push({ kind: "artifact-missing-filename" });
      if (seen.has(artifact.filename)) problems.push({ kind: "duplicate-artifact", filename: artifact.filename });
      seen.add(artifact.filename);
      if (typeof artifact.sha256Hex !== "string" || !/^[0-9a-f]{64}$/.test(artifact.sha256Hex)) {
        problems.push({ kind: "artifact-invalid-hash", filename: artifact.filename });
      }
      if (typeof artifact.sizeBytes !== "number" || artifact.sizeBytes <= 0) {
        problems.push({ kind: "artifact-invalid-size", filename: artifact.filename });
      }
      if (typeof (artifact.filename ?? "") === "string" && /^[A-Za-z]:\\|^\//.test(artifact.filename ?? "")) {
        problems.push({ kind: "artifact-absolute-path", filename: artifact.filename });
      }
    }
    const primaryCount = candidate.artifacts.filter((a) => a && a.primary === true).length;
    if (primaryCount !== 1) problems.push({ kind: "primary-artifact-count", count: primaryCount });
  }

  return problems.length === 0 ? { ok: true, problems: [] } : { ok: false, problems };
}

/**
 * Cross-validates a publication bundle's own `artifacts` list against a
 * REAL `SHA256SUMS.txt`-parsed record set (`verify_release_checksums.mjs`'s
 * own `parseFedosReleaseChecksumFile` output) -- every bundle artifact
 * must have an identical, matching checksum-file record, and vice versa
 * (Phase C "manifest/checksum cross-validation").
 */
export function crossValidateBundleAgainstChecksums(bundle, checksumRecords) {
  const problems = [];
  const checksumByFilename = new Map(checksumRecords.map((r) => [r.filename, r]));
  const bundleFilenames = new Set(bundle.artifacts.map((a) => a.filename));

  for (const artifact of bundle.artifacts) {
    const checksumRecord = checksumByFilename.get(artifact.filename);
    if (checksumRecord === undefined) {
      problems.push({ kind: "artifact-not-in-checksum-file", filename: artifact.filename });
      continue;
    }
    if (checksumRecord.sha256Hex !== artifact.sha256Hex) {
      problems.push({ kind: "bundle-checksum-mismatch", filename: artifact.filename, bundleHash: artifact.sha256Hex, checksumFileHash: checksumRecord.sha256Hex });
    }
  }
  for (const record of checksumRecords) {
    if (record.filename === bundle.releaseManifestFilename) continue; // the manifest itself is checksummed but is not an "artifact"
    if (!bundleFilenames.has(record.filename)) {
      problems.push({ kind: "checksum-entry-not-in-bundle", filename: record.filename });
    }
  }
  return Object.freeze({ ok: problems.length === 0, problems: Object.freeze(problems) });
}
