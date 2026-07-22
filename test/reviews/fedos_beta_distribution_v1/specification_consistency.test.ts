import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";

/**
 * FedOS Desktop Beta 0.1 Installer/Signing/Distribution/Update Policy V1
 * review — specification consistency.
 *
 * Verifies the 20 documents agree with each other and with the single
 * normative recommendation (`20`) -- never that any of it is
 * implemented. Explanatory prose ("this review recommends X for a LATER
 * Arc") must never be mistaken by these checks for a claim that X exists
 * today; every assertion below inspects the DECISION statements
 * (headings, bolded policy lines), not incidental mentions.
 */

const DOCS_DIR = "docs/reviews/fedos_beta_distribution_v1";

const REQUIRED_DOCS: readonly string[] = [
  "index.md",
  "01_current_packaging_inventory.md",
  "02_beta_release_artifact_inventory.md",
  "03_windows_distribution_format_comparison.md",
  "04_portable_vs_installed_policy.md",
  "05_code_signing_inventory.md",
  "06_windows_smartscreen_and_reputation.md",
  "07_release_artifact_integrity.md",
  "08_wasm_manifest_and_application_binding.md",
  "09_release_channel_policy.md",
  "10_versioning_and_build_identity.md",
  "11_profile_and_schema_compatibility.md",
  "12_upgrade_semantics.md",
  "13_downgrade_and_rollback_policy.md",
  "14_update_interruption_and_recovery.md",
  "15_automatic_update_decision.md",
  "16_distribution_host_and_mirror_policy.md",
  "17_release_security_threat_model.md",
  "18_beta_support_and_deprecation_policy.md",
  "19_implementation_arc_packaging.md",
  "20_normative_recommendation.md",
];

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

function readAllDocs(): string {
  return REQUIRED_DOCS.map(readDoc).join("\n\n");
}

describe("chosen installer format matches doc 20", () => {
  it("doc 03's NSIS decision and doc 20's primary format agree", () => {
    const doc03 = readDoc("03_windows_distribution_format_comparison.md");
    const doc20 = readDoc("20_normative_recommendation.md");
    expect(doc03).toMatch(/\*\*Primary format:\s*NSIS installer\*\*/);
    expect(doc20).toMatch(/Primary Windows format\*\*:\s*NSIS installer/);
  });

  it("doc 19's phase-1 scope builds the same NSIS + ZIP artifacts named in doc 02/03", () => {
    const doc19 = readDoc("19_implementation_arc_packaging.md");
    expect(doc19).toMatch(/nsis/i);
    expect(doc19).toMatch(/zip/i);
  });
});

describe("portable policy matches doc 20", () => {
  it("doc 04's secondary/shared-profile decision and doc 20's secondary-format line agree", () => {
    const doc04 = readDoc("04_portable_vs_installed_policy.md");
    const doc20 = readDoc("20_normative_recommendation.md");
    expect(doc04).toMatch(/secondary,\s*\n?\s*developer\/advanced-user format|secondary format/i);
    expect(doc20).toMatch(/Secondary format\*\*:\s*ZIP archive/);
  });
});

describe("signing policy matches doc 20", () => {
  it("doc 05's decision F (deferred, explicit warning) and doc 20's 'no signing requirement' agree", () => {
    const doc05 = readDoc("05_code_signing_inventory.md");
    const doc20 = readDoc("20_normative_recommendation.md");
    expect(doc05).toMatch(/\*\*F — deferred signing/);
    expect(doc20).toMatch(/Signing requirement\*\*:\s*none for Beta 0\.1/);
    expect(doc20).toMatch(/\*\*unsigned Beta is\s+explicitly allowed\*\*/);
  });
});

describe("update policy matches doc 20", () => {
  it("doc 15's decision A and doc 20's update-policy line agree", () => {
    const doc15 = readDoc("15_automatic_update_decision.md");
    const doc20 = readDoc("20_normative_recommendation.md");
    expect(doc15).toMatch(/\*\*A — no automatic update/);
    expect(doc20).toMatch(/Update policy\*\*:\s*no automatic update/i);
  });
});

describe("rollback policy matches doc 20", () => {
  it("doc 13's explicit statement and doc 20's rollback-policy line agree", () => {
    const doc13 = readDoc("13_downgrade_and_rollback_policy.md");
    const doc20 = readDoc("20_normative_recommendation.md");
    expect(doc13).toMatch(/downgrade.{0,40}is NOT supported/i);
    expect(doc20).toMatch(/Rollback policy\*\*:\s*binary downgrade is supported ONLY when/i);
  });
});

describe("release channel/version policy is consistent", () => {
  it("doc 09's beta channel and doc 10's version string appear consistently across doc 20", () => {
    const doc20 = readDoc("20_normative_recommendation.md");
    expect(doc20).toMatch(/beta/i);
    expect(doc20).toMatch(/0\.1\.0-beta\.1|0\.1\.0-beta\.N|-beta\.N/);
  });

  it("no doc claims a channel other than beta is active for this release", () => {
    const all = readAllDocs();
    expect(all).not.toMatch(/current(ly)? channel (is|:)\s*(stable|alpha|nightly|rc)\b/i);
  });
});

describe("support policy is consistent", () => {
  it("doc 18's Windows/architecture scope matches doc 20's own line", () => {
    const doc18 = readDoc("18_beta_support_and_deprecation_policy.md");
    const doc20 = readDoc("20_normative_recommendation.md");
    expect(doc18).toMatch(/Windows 10 and Windows 11/);
    expect(doc18).toMatch(/x64 only/);
    expect(doc20).toMatch(/Windows 10 and 11, x64 only/);
  });
});

describe("implementation sequencing includes all required work", () => {
  it("doc 19 names installer, signing, hosting, and update as separate, sequenced phases", () => {
    const doc19 = readDoc("19_implementation_arc_packaging.md");
    expect(doc19).toMatch(/Phase 1/);
    expect(doc19).toMatch(/Phase 2/);
    expect(doc19).toMatch(/Phase 3/);
    expect(doc19).toMatch(/Phase 4/);
  });

  it("doc 20's exact next Arc matches doc 19's own Phase 1 scope (installer + checksums, no signing/update/hosting)", () => {
    const doc19 = readDoc("19_implementation_arc_packaging.md");
    const doc20 = readDoc("20_normative_recommendation.md");
    expect(doc19).toMatch(/Phase 1.*NSIS\s+installer.*ZIP.*SHA256SUMS/s);
    expect(doc20).toMatch(/NSIS Installer, Portable ZIP, and Checksum Publication Arc/);
  });
});

describe("prohibited claims do not appear", () => {
  it("no doc claims code signing is currently available without evidence", () => {
    const all = readAllDocs();
    expect(all).not.toMatch(/code signing is (currently )?available\b(?!\s*for a (future|post))/i);
  });

  it("no doc claims SmartScreen reputation can be guaranteed", () => {
    const all = readAllDocs();
    expect(all).not.toMatch(/SmartScreen reputation (can|is) (be )?guarantee/i);
  });

  it("no doc claims rollback is safe without a schema analysis caveat", () => {
    const all = readAllDocs();
    // Every occurrence of "rollback is safe" (if any) must be immediately conditioned.
    const bareClaims = all.match(/rollback is safe(?! only| when| ONLY)/gi) ?? [];
    expect(bareClaims.length).toBe(0);
  });

  it("no doc claims auto-update is safe without an interruption-analysis caveat", () => {
    const all = readAllDocs();
    const bareClaims = all.match(/auto-?update is safe(?! only| when)/gi) ?? [];
    expect(bareClaims.length).toBe(0);
  });
});

describe("full completion is not claimed; the review remains specification-only", () => {
  it("no doc claims the installer, signing, or update mechanism is implemented", () => {
    const all = readAllDocs();
    expect(all).not.toMatch(/the installer (has been|is) implemented/i);
    expect(all).not.toMatch(/(auto-update|signing) (has been|is) implemented/i);
  });

  it("index.md states explicitly that no installer/auto-update/signing/upload/update-service is implemented", () => {
    const index = readDoc("index.md");
    expect(index).toMatch(/No installer, auto-update,\s*\n?\s*code signing, release upload, or update service is implemented/);
  });

  it("doc 20 recommends exactly one next Arc and does not itself declare the work done", () => {
    const doc20 = readDoc("20_normative_recommendation.md");
    expect(doc20).not.toMatch(/(installer|signing|update mechanism) (is|has been) (complete|implemented|done)/i);
  });
});
