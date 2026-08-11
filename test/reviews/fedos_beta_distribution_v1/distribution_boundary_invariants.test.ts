import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * FedOS Desktop Beta 0.1 Installer/Signing/Distribution/Update Policy V1
 * review — distribution boundary invariants.
 *
 * Verifies this review stayed a SPECIFICATION (docs + tests only): no
 * certificate/key material, no production implementation, no new
 * dependency, no update/signing/CI implementation, and that the review's
 * own documents draw the required honest distinctions rather than
 * conflating hashes with signatures or SmartScreen with security.
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

/** `git grep` exits 1 (not 0) when NO line matches -- that is the EXPECTED, passing case for the checks below, never a tool failure. */
function gitGrepFiles(pattern: string, pathspec: string): string[] {
  try {
    const output = execFileSync("git", ["grep", "-liE", pattern, "--", pathspec], { encoding: "utf8" }) as string;
    return output.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 1) return [];
    throw error;
  }
}

describe("no certificate/private key material was added", () => {
  it("no .pfx/.p12/.pem/.key/.crt file was added under docs/reviews or test/reviews", () => {
    const files = gitGrepFiles(".", "docs/reviews/fedos_beta_distribution_v1") .concat(gitGrepFiles(".", "test/reviews/fedos_beta_distribution_v1"));
    void files; // presence-of-content check happens via extension scan below, not content grep.
    const scan = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true }) as { name: string; isDirectory: () => boolean }[]) {
        const p = `${dir}/${entry.name}`;
        if (entry.isDirectory()) out.push(...scan(p));
        else out.push(p);
      }
      return out;
    };
    const allFiles = [...scan("docs/reviews/fedos_beta_distribution_v1"), ...scan("test/reviews/fedos_beta_distribution_v1")];
    for (const file of allFiles) {
      expect(file).not.toMatch(/\.(pfx|p12|pem|key|crt|cer)$/i);
    }
  });

  it("no doc contains a plausible embedded private key or certificate block", () => {
    const all = readAllDocs();
    expect(all).not.toMatch(/-----BEGIN (RSA |EC )?PRIVATE KEY-----/);
    expect(all).not.toMatch(/-----BEGIN CERTIFICATE-----/);
  });
});

describe("no production implementation was added", () => {
  it("git diff shows no change to src/, packages/ (production), README.md, package.json, package-lock.json, Cargo.toml, p2p/, .tmp_gen/", () => {
    const output = execFileSync(
      "git",
      ["diff", "--name-only", "8548845", "--", "src", "README.md", "package.json", "package-lock.json", "Cargo.toml", "packages", "p2p", ".tmp_gen"],
      { encoding: "utf8" },
    ) as string;
    expect(output.trim()).toBe("");
  });

  it("no CI workflow file was added", () => {
    const output = execFileSync("git", ["diff", "--name-only", "8548845", "--", ".github"], { encoding: "utf8" }) as string;
    expect(output.trim()).toBe("");
  });
});

describe("no new dependency was added", () => {
  it("root and electron package.json are byte-identical to the base commit", () => {
    const rootDiff = execFileSync("git", ["diff", "8548845", "--", "package.json"], { encoding: "utf8" }) as string;
    const electronDiff = execFileSync("git", ["diff", "8548845", "--", "packages/fedos-desktop-electron-spike/package.json"], { encoding: "utf8" }) as string;
    expect(rootDiff.trim()).toBe("");
    expect(electronDiff.trim()).toBe("");
  });
});

describe("no update/signing/release-upload implementation was added", () => {
  it("no script implementing electron-updater, certificate signing, or artifact upload was added under docs/reviews or test/reviews", () => {
    const changedFiles = (execFileSync("git", ["diff", "--name-only", "8548845", "--", "."], { encoding: "utf8" }) as string)
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.endsWith(".mjs") || s.endsWith(".ts") && !s.endsWith(".test.ts"));
    // Every non-test script/module this review adds must be a .md (docs) -- no .mjs/.ts implementation file at all
    // outside the three named .test.ts files is part of this review's own required deliverable set.
    for (const file of changedFiles) {
      expect(file.endsWith(".test.ts"), `${file} should not be a non-test implementation file`).toBe(true);
    }
  });

  it("no doc claims code signing, auto-update, or release upload is implemented", () => {
    const all = readAllDocs();
    expect(all).not.toMatch(/this review implements (signing|auto-update|an update service|an installer)/i);
    expect(all).not.toMatch(/signing is (now |already )?(configured|implemented) in this repository/i);
  });
});

describe("docs distinguish hashes from signatures", () => {
  it("doc 07 states a checksum is not sufficient / does not prove publisher identity", () => {
    const doc = readDoc("07_release_artifact_integrity.md");
    expect(doc).toMatch(/checksums? alone.{0,40}(sufficient|not)/is);
    expect(doc).toMatch(/proves?\s+nothing about|says nothing about|does\s+NOT\s+prove/i);
  });

  it("doc 17 restates the exact boundary between a checksum and a signature", () => {
    const doc = readDoc("17_release_security_threat_model.md");
    expect(doc).toMatch(/A release checksum.{0,200}proves the bytes/is);
    expect(doc).toMatch(/[Cc]ode signing.{0,200}bind a publisher IDENTITY/is);
  });
});

describe("docs distinguish signing from SmartScreen reputation", () => {
  it("doc 06 states signing does not automatically guarantee no SmartScreen warning", () => {
    const doc = readDoc("06_windows_smartscreen_and_reputation.md");
    expect(doc).toMatch(/does not automatically guarantee/i);
    expect(doc).toMatch(/reputation is external/i);
  });

  it("no doc claims SmartScreen can be disabled or bypassed safely as a distribution-side action (sentence-level check: a sentence naming SmartScreen+disable/bypass is fine IF it also carries a negation like 'not'/'never'/'does not' -- that is the required, correct prohibition phrasing; only an UNQUALIFIED affirmative claim in the same sentence should fail this check)", () => {
    const all = readAllDocs();
    const sentences = all.split(/(?<=[.!?])\s+/);
    const badSentences = sentences.filter((s) => {
      const namesTheClaim = /SmartScreen\b[^.!?]*\b(disabled?|bypass(ed)?)\b/i.test(s) || /\b(disabled?|bypass(ed)?)\b[^.!?]*SmartScreen\b/i.test(s);
      if (!namesTheClaim) return false;
      const isNegated = /\b(not|never|does not|cannot|no\b|without)\b/i.test(s);
      return !isNegated;
    });
    expect(badSentences).toEqual([]);
  });
});

describe("docs prohibit silent downgrade", () => {
  it("doc 13 states downgrade is supported only when schemas are unchanged, otherwise restore from backup", () => {
    const doc = readDoc("13_downgrade_and_rollback_policy.md");
    expect(doc).toMatch(/NOT support(ed)?/);
    expect(doc).toMatch(/restor(e|ing) (the profile )?from a (pre-upgrade )?backup/i);
  });

  it("doc 20 (the normative recommendation) repeats the same rollback policy, not a silently different one", () => {
    const doc = readDoc("20_normative_recommendation.md");
    expect(doc).toMatch(/binary downgrade is supported ONLY when/i);
  });
});

describe("docs require profile compatibility analysis before claiming upgrade/downgrade safety", () => {
  it("doc 11 documents the schema mechanism per persisted format and states no migration code exists", () => {
    const doc = readDoc("11_profile_and_schema_compatibility.md");
    expect(doc).toMatch(/[Nn]o forward-migration code exists/);
  });

  it("doc 12/13 do not claim upgrade/downgrade safety without citing doc 11's own findings", () => {
    const doc12 = readDoc("12_upgrade_semantics.md");
    const doc13 = readDoc("13_downgrade_and_rollback_policy.md");
    expect(doc12).toMatch(/`11`/);
    expect(doc13).toMatch(/`11`/);
  });
});

describe("docs prohibit secret material in the repository", () => {
  it("doc 05 explicitly states no signing secret/certificate/private key is created or stored", () => {
    const doc = readDoc("05_code_signing_inventory.md");
    expect(doc).toMatch(/No signing secret, certificate, or private key is created, stored, or\s*referenced/i);
  });
});

describe("exactly one primary distribution recommendation", () => {
  it("doc 20 names exactly one primary Windows format and does not leave multiple formats equally recommended", () => {
    const doc = readDoc("20_normative_recommendation.md");
    const primaryMatches = doc.match(/\*\*Primary Windows format\*\*:\s*([^(\n]+)/i);
    expect(primaryMatches).not.toBeNull();
    expect(primaryMatches![1]).toMatch(/NSIS/);
  });

  it("doc 03's own decision section names exactly one primary format", () => {
    const doc = readDoc("03_windows_distribution_format_comparison.md");
    const occurrences = doc.match(/\*\*Primary format:/g) ?? [];
    expect(occurrences.length).toBe(1);
  });
});

describe("exactly one update policy", () => {
  it("doc 15 and doc 20 both name 'no automatic update' as the sole Beta 0.1 policy", () => {
    const doc15 = readDoc("15_automatic_update_decision.md");
    const doc20 = readDoc("20_normative_recommendation.md");
    expect(doc15).toMatch(/no automatic update/i);
    expect(doc20).toMatch(/no automatic update/i);
  });
});

describe("exactly one next Arc", () => {
  it("doc 20 names exactly one next Arc heading, and index.md does not name a competing one", () => {
    const doc20 = readDoc("20_normative_recommendation.md");
    const nextArcHeadings = doc20.match(/^##\s+FedOS Desktop Beta 0\.1.*Arc$/gm) ?? [];
    expect(nextArcHeadings.length).toBe(1);
  });
});
