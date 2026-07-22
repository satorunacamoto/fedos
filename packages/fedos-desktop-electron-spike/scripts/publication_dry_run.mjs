#!/usr/bin/env node
// Secure Runtime Alpha 5321-5400 -- Phase G/O: the ONE zero-side-effect
// manual publication dry run. Prints/returns exactly what a human would
// need to do to publish manually -- filenames, MIME types, a release
// title, a tag, a release body, canonical URL templates, upload order,
// and a post-upload verification plan. Absolute Prohibitions restated as
// real guarantees here: this module performs NO authentication, opens NO
// browser, creates NO release, uploads NOTHING, pushes NO tag, and never
// mutates any remote or local git state. It fails closed (throws a
// closed, typed error) if the publication bundle it is given is invalid
// -- a dry run must never fabricate a plan for a release that does not
// actually validate.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { validateFedosBetaPublicationBundleV1 } from "./lib/publication_bundle.mjs";
import { fedosBetaTagForVersion, validateFedosBetaTagFormat } from "./lib/tag_format.mjs";

const MIME_TYPES = Object.freeze({
  ".exe": "application/vnd.microsoft.portable-executable",
  ".zip": "application/zip",
  ".json": "application/json",
  ".txt": "text/plain",
  ".md": "text/markdown",
});

function mimeTypeFor(filename) {
  const dot = filename.lastIndexOf(".");
  return MIME_TYPES[filename.slice(dot)] ?? "application/octet-stream";
}

/** Canonical URL TEMPLATES, not live URLs -- honestly parameterized by `canonicalHostPolicy`, never fabricated (Phase B/G's own "do not fabricate a live URL" prohibition). */
const CANONICAL_URL_TEMPLATES = Object.freeze({
  "local-only": (filename) => `file://<local-release-directory>/${filename}`,
  "self-hosted-https": (filename) => `https://<self-hosted-domain>/releases/<productVersion>/${filename}`,
  "github-releases": (filename) => `https://github.com/<org>/<repo>/releases/download/<tag>/${filename}`,
  "cloudflare-r2": (filename) => `https://<r2-public-bucket-domain>/releases/<productVersion>/${filename}`,
  "university-hosted-https": (filename) => `https://<university-domain>/fedos/releases/<productVersion>/${filename}`,
});

/**
 * Fails closed with a typed error if `bundle` does not validate --
 * a dry run must never describe a plan for an unpublishable bundle.
 */
export function buildFedosPublicationDryRunPlan({ bundle, releaseManifest, checksumRecords }) {
  const bundleResult = validateFedosBetaPublicationBundleV1(bundle);
  if (!bundleResult.ok) {
    throw Object.assign(new Error("[publication-dry-run] refusing to plan: publication bundle is invalid"), { problems: bundleResult.problems });
  }

  const tag = fedosBetaTagForVersion(bundle.productVersion);
  const tagResult = validateFedosBetaTagFormat(tag, bundle.productVersion);
  if (!tagResult.ok) {
    throw Object.assign(new Error("[publication-dry-run] refusing to plan: derived tag is invalid"), { problem: tagResult.problem });
  }

  const urlFor = CANONICAL_URL_TEMPLATES[bundle.canonicalHostPolicy];
  if (typeof urlFor !== "function") {
    throw new Error(`[publication-dry-run] refusing to plan: unknown canonicalHostPolicy "${bundle.canonicalHostPolicy}"`);
  }

  // Upload order: primary artifact first, then remaining artifacts, then integrity/manifest files, then human-readable docs last.
  const primaryArtifacts = bundle.artifacts.filter((a) => a.primary).map((a) => a.filename);
  const secondaryArtifacts = bundle.artifacts.filter((a) => !a.primary).map((a) => a.filename);
  const integrityFiles = ["release-manifest.v1.json", "SHA256SUMS.txt", "publication-bundle.json", "REVOCATION_STATUS.json"];
  const humanDocs = ["RELEASE_NOTES.md", "KNOWN_LIMITATIONS.md", "INSTALL_WINDOWS.md", "VERIFY_DOWNLOAD.md", "SECURITY_NOTICE.md", "RELEASE_ANNOUNCEMENT.md"];
  const uploadOrder = [...primaryArtifacts, ...secondaryArtifacts, ...integrityFiles, ...humanDocs];

  const uploadPlan = uploadOrder.map((filename) => ({
    filename,
    mimeType: mimeTypeFor(filename),
    canonicalUrlTemplate: urlFor(filename),
  }));

  return Object.freeze({
    schemaVersion: 1,
    dryRun: true,
    performedNoSideEffects: true,
    releaseTitle: `FedOS Desktop Beta ${bundle.productVersion}`,
    tag,
    tagPolicyReminder: "annotated tag, exact release commit, never retag an existing tag",
    releaseBodyTemplate:
      "See RELEASE_NOTES.md for full details. This is an UNSIGNED Beta build -- verify SHA256SUMS.txt before running. " +
      "Manual verification instructions: VERIFY_DOWNLOAD.md.",
    canonicalHostPolicy: bundle.canonicalHostPolicy,
    uploadOrder,
    uploadPlan: Object.freeze(uploadPlan),
    postUploadVerificationPlan: Object.freeze([
      "re-download every uploaded file from its published canonical URL",
      "recompute SHA-256 of each re-downloaded file",
      "compare each recomputed hash against SHA256SUMS.txt and publication-bundle.json",
      "confirm release-manifest.v1.json productVersion/channel/gitCommit match the intended release",
      "confirm no certificate/signature file was inadvertently uploaded",
    ]),
  });
}

function main() {
  const stagingDir = join(process.cwd(), "release-staging");
  if (!existsSync(join(stagingDir, "publication-bundle.json"))) {
    console.error("[publication-dry-run] no publication-bundle.json in release-staging/ -- run generate_release_staging.mjs first.");
    process.exit(1);
  }
  const bundle = JSON.parse(readFileSync(join(stagingDir, "publication-bundle.json"), "utf8"));
  const plan = buildFedosPublicationDryRunPlan({ bundle });
  console.log(JSON.stringify(plan, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith("publication_dry_run.mjs")) {
  main();
}
