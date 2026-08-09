#!/usr/bin/env node
// Secure Runtime Alpha 5321-5400 -- Phase D/E/I: release staging directory
// generation. Assembles the deterministic, human-reviewable staging
// layout from the ALREADY-BUILT, ALREADY-CHECKSUMMED artifacts in
// `release/` (produced by `build_release.mjs`'s own earlier steps) --
// this script performs no build step of its own, only documentation
// generation + a final, curated copy.
//
// Reads the compiled Beta capability manifest / limitations model /
// release configuration from the root `dist/` graph via the SAME dynamic
// `import()` technique `fedos_electron_beta_main.cts` itself already
// uses (never a static import of root `src/`, never a regex re-parse of
// TS source for THESE three modules specifically, since they are pure,
// side-effect-free value objects the compiled `dist/` already exposes
// faithfully once `npm run build:beta-runtime` has run).
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveFedosBetaReleaseIdentity } from "./lib/release_identity.mjs";
import { buildFedosBetaPublicationBundleV1 } from "./lib/publication_bundle.mjs";
import { buildFedosReleaseStatusRecordV1 } from "./lib/revocation_status.mjs";

const PACKAGE_ROOT = process.cwd();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const RELEASE_DIR = join(PACKAGE_ROOT, "release");
const STAGING_DIR = join(PACKAGE_ROOT, "release-staging");
const ROOT_DIST_DIR = join(ROOT, "dist");

/** Phase B — the canonical-host policy this Arc adopts (see the reconciliation report's own Phase B decision): no git remote is configured anywhere in this repository, so `"local-only"` is the honest current state, not a placeholder. */
const CANONICAL_HOST_POLICY = "local-only";

function distUrl(...segments) {
  return pathToFileURL(join(ROOT_DIST_DIR, ...segments)).href;
}

async function loadBetaValueObjects() {
  const capabilityModule = await import(distUrl("os", "messenger", "desktop", "beta", "fedos_desktop_beta_capability_manifest.js"));
  const limitationsModule = await import(distUrl("os", "messenger", "desktop", "beta", "fedos_desktop_beta_limitations.js"));
  const releaseConfigModule = await import(distUrl("os", "messenger", "desktop", "beta", "fedos_desktop_beta_release_configuration.js"));
  return {
    capabilities: capabilityModule.fedosDesktopBetaCapabilityManifestV1().capabilities,
    limitations: limitationsModule.fedosDesktopBetaLimitationsV1().limitations,
    releaseConfig: releaseConfigModule.fedosDesktopBetaReleaseConfigurationV1(),
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// ---------------------------------------------------------------------
// Phase E — deterministic release notes.
// ---------------------------------------------------------------------

export function generateFedosBetaReleaseNotes({ identity, capabilities, limitations }) {
  const included = capabilities.filter((c) => c.betaIncluded);
  const usable = included.filter((c) => c.status === "available" || c.status === "available-local-only");
  const developmentOnly = included.filter((c) => c.status === "available-development-only");
  const blocked = included.filter((c) => c.status === "blocked");

  const lines = [];
  lines.push(`# FedOS Desktop Beta ${identity.productVersion}`);
  lines.push("");
  lines.push(`**Channel:** ${identity.channel} · **Build:** \`${identity.buildIdentity}\` · **Commit:** \`${identity.gitCommit}\``);
  lines.push("");
  lines.push("> This is Beta software. It is functional but incomplete; behavior and data formats may change before a stable release.");
  lines.push("");
  lines.push("## What this release includes");
  lines.push("");
  for (const c of usable) lines.push(`- **${c.userVisibleLabel}** — ${c.coarseLimitation}`);
  if (developmentOnly.length > 0) {
    lines.push("");
    lines.push("The following are real, tested, but not yet reachable from the packaged application in every path:");
    for (const c of developmentOnly) lines.push(`- ${c.userVisibleLabel} — ${c.coarseLimitation}`);
  }
  if (blocked.length > 0) {
    lines.push("");
    lines.push("The following are honestly blocked in this environment/build:");
    for (const c of blocked) lines.push(`- ${c.userVisibleLabel} — ${c.coarseLimitation}`);
  }
  lines.push("");
  lines.push("## Known limitations");
  lines.push("");
  for (const l of limitations) lines.push(`- **${l.label}.** ${l.statement}`);
  lines.push("");
  lines.push("## Security and distribution");
  lines.push("");
  lines.push("- **This build is unsigned.** Windows SmartScreen may show a warning on first run — this is expected for unsigned software; see `SECURITY_NOTICE.md`.");
  lines.push("- **Verify the SHA-256 checksum** of any downloaded artifact against `SHA256SUMS.txt` before running it — see `VERIFY_DOWNLOAD.md`.");
  lines.push("- **Back up your profile** before installing over an existing one — see `INSTALL_WINDOWS.md`.");
  lines.push("- **No automatic update.** This release does not check for or install updates on its own; download new versions manually from the canonical source.");
  lines.push("- **No recovery service.** There is no cloud account or password-recovery service; all recovery depends on your own local backups.");
  lines.push("");
  lines.push(`## Schema compatibility (this build: settings=${identity.schemaVersions.settings}, profile=${identity.schemaVersions.profile}, archive=${identity.schemaVersions.archive}, capabilityManifest=${identity.schemaVersions.capabilityManifest})`);
  lines.push("");
  lines.push("An in-place upgrade is supported only between releases that report the identical schema versions above. A release that changes any schema version will state so explicitly and requires a fresh profile or a restore from a pre-upgrade backup — never an automatic migration (none is implemented).");
  lines.push("");
  lines.push("## Downgrading");
  lines.push("");
  lines.push("Installing an older build over a newer one is supported only when every schema version above is unchanged between the two builds; otherwise, restore your profile from a pre-upgrade backup.");
  lines.push("");
  lines.push("## Support and reporting");
  lines.push("");
  lines.push("This is a Beta release with no enterprise-grade support commitment. Report issues through the project's own canonical channel (see the release announcement for the current reporting location).");
  lines.push("");
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------
// Phase D — supporting documents.
// ---------------------------------------------------------------------

function generateKnownLimitations(limitations) {
  const lines = ["# FedOS Desktop Beta — Known Limitations", ""];
  for (const l of limitations) {
    lines.push(`## ${l.label}`);
    lines.push("");
    lines.push(l.statement);
    lines.push("");
  }
  return lines.join("\n");
}

function generateInstallWindows(identity) {
  return [
    "# Installing FedOS Desktop Beta on Windows",
    "",
    `1. Download \`FedOS-Desktop-Beta-Setup-${identity.productVersion}.exe\` (recommended) or the portable ZIP.`,
    "2. Verify its SHA-256 checksum against `SHA256SUMS.txt` — see `VERIFY_DOWNLOAD.md`.",
    "3. If your existing profile is important, back it up now (copy your FedOS Desktop user-data folder before installing).",
    "4. Run the installer. Windows SmartScreen may warn that this is an unrecognized app — see `SECURITY_NOTICE.md` for why, and how to proceed.",
    "5. The installer does not require administrator privileges and installs per-user by default.",
    "6. Your profile is stored outside the install directory and is never deleted by an uninstall unless you remove it yourself.",
    "7. The installer does not launch the application automatically — start it from the Start Menu when ready.",
    "",
    "## Uninstalling",
    "",
    "Use \"Add or remove programs\" as with any Windows application. Your profile data is preserved unless you delete it manually.",
    "",
    "## Upgrading",
    "",
    "Close the application, back up your profile, install the new version over the old one, then launch it. See the release notes for schema-compatibility limits before upgrading across versions.",
    "",
  ].join("\n");
}

function generateVerifyDownload(identity) {
  return [
    "# Verifying Your Download",
    "",
    "Every FedOS Desktop Beta release publishes a `SHA256SUMS.txt` alongside its artifacts. Verify your download BEFORE running it.",
    "",
    "## PowerShell",
    "",
    "```powershell",
    "Get-FileHash .\\FedOS-Desktop-Beta-Setup-<version>.exe -Algorithm SHA256",
    "```",
    "",
    "Compare the printed hash against the matching line in `SHA256SUMS.txt`. They must match exactly.",
    "",
    "## What this proves, and what it does not",
    "",
    "A matching checksum proves the file you downloaded matches what was published under that filename — it does NOT prove who published it, or that the publishing channel itself was not compromised. This build is unsigned (see `SECURITY_NOTICE.md`); a checksum is not a substitute for a publisher signature.",
    "",
    `Build identity for this release: \`${identity.buildIdentity}\`, commit \`${identity.gitCommit}\`.`,
    "",
  ].join("\n");
}

function generateSecurityNotice(identity) {
  return [
    "# Security Notice — FedOS Desktop Beta",
    "",
    "- **This build is unsigned.** No code-signing certificate is currently configured for this project. Windows SmartScreen may show a \"Windows protected your PC\" warning the first time you run the installer or the application. This is expected for unsigned software and does not by itself indicate a specific problem with this release.",
    "- **Only download from the canonical source** named in the release announcement. Do not trust copies from unrelated sites.",
    "- **Verify the SHA-256 checksum** (see `VERIFY_DOWNLOAD.md`) before proceeding past any warning.",
    "- **A checksum match does not prove publisher identity.** It proves the bytes you downloaded match what was published under that filename.",
    "- **No automatic update** exists in this release — you must download new versions manually.",
    "- **No recovery service** exists — all recovery depends on your own local backups; a forgotten passphrase is unrecoverable.",
    "- **Local malware already running on your machine is outside this application's protection boundary.**",
    `- Unsigned build identity: \`${identity.buildIdentity}\`.`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------
// Phase I — release announcement template.
// ---------------------------------------------------------------------

function generateReleaseAnnouncement(identity) {
  return [
    `# FedOS Desktop Beta ${identity.productVersion} is available`,
    "",
    "This is a Beta release — functional but incomplete; see the known limitations below.",
    "",
    "**Download:** <canonical release location — see the project's own current distribution policy; not yet configured for this build>",
    "",
    "**Artifacts:**",
    `- \`FedOS-Desktop-Beta-Setup-${identity.productVersion}.exe\` (installer, recommended)`,
    `- \`FedOS Desktop Beta-${identity.productVersion}-win.zip\` (portable, secondary)`,
    "",
    "**Before you run it:** verify the published SHA-256 checksum (`SHA256SUMS.txt`) against your download. This build is unsigned — Windows SmartScreen may warn on first run; this is expected.",
    "",
    "**Major capabilities:** see `RELEASE_NOTES.md` in this release's own staging bundle for the full, honest list.",
    "",
    "**Major limitations:** Beta software; local data can be lost without your own backup; a forgotten passphrase is unrecoverable; no automatic update; no recovery service.",
    "",
    "**Back up your profile** before installing over an existing one.",
    "",
    "**Updates:** manual download only — this release does not check for or install updates automatically.",
    "",
    "**Support / reporting:** <canonical reporting location placeholder — set when a support channel is established>",
    "",
    `**Build identity:** \`${identity.buildIdentity}\` · **Commit:** \`${identity.gitCommit}\``,
    "",
    "---",
    "",
    "_If this announcement is also posted to Nostr or another public channel, that channel is an ANNOUNCEMENT of where to find the release — it does not itself authenticate the downloaded binary. Always verify the SHA-256 checksum against the canonical release page._",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------
// Orchestration.
// ---------------------------------------------------------------------

async function main() {
  const identity = resolveFedosBetaReleaseIdentity({ requireClean: true });
  const { capabilities, limitations } = await loadBetaValueObjects();

  const releaseManifest = readJson(join(RELEASE_DIR, "release-manifest.v1.json"));

  const bundle = buildFedosBetaPublicationBundleV1({
    identity,
    artifacts: releaseManifest.artifacts,
    canonicalHostPolicy: CANONICAL_HOST_POLICY,
  });

  rmSync(STAGING_DIR, { recursive: true, force: true });
  mkdirSync(STAGING_DIR, { recursive: true });

  // Copy the already-checksummed public artifacts + the manifest + the checksum file verbatim.
  for (const filename of readdirSync(RELEASE_DIR)) {
    copyFileSync(join(RELEASE_DIR, filename), join(STAGING_DIR, filename));
  }

  writeFileSync(join(STAGING_DIR, "publication-bundle.json"), JSON.stringify(bundle, null, 2) + "\n", "utf8");
  writeFileSync(join(STAGING_DIR, bundle.releaseNotesFilename), generateFedosBetaReleaseNotes({ identity, capabilities, limitations }), "utf8");
  writeFileSync(join(STAGING_DIR, bundle.knownLimitationsFilename), generateKnownLimitations(limitations), "utf8");
  writeFileSync(join(STAGING_DIR, bundle.installationGuideFilename), generateInstallWindows(identity), "utf8");
  writeFileSync(join(STAGING_DIR, "VERIFY_DOWNLOAD.md"), generateVerifyDownload(identity), "utf8");
  writeFileSync(join(STAGING_DIR, bundle.securityNoticeFilename), generateSecurityNotice(identity), "utf8");
  writeFileSync(join(STAGING_DIR, "RELEASE_ANNOUNCEMENT.md"), generateReleaseAnnouncement(identity), "utf8");
  writeFileSync(
    join(STAGING_DIR, bundle.revocationStatusFilename),
    JSON.stringify(
      buildFedosReleaseStatusRecordV1({
        status: "candidate",
        affectedVersion: identity.productVersion,
        canonicalAdvisoryLocationPolicy: CANONICAL_HOST_POLICY,
      }),
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(`[release-staging] wrote ${STAGING_DIR}`);
  for (const filename of readdirSync(STAGING_DIR).sort()) console.log(`  ${filename}`);
}

if (process.argv[1] && process.argv[1].endsWith("generate_release_staging.mjs")) {
  main();
}
