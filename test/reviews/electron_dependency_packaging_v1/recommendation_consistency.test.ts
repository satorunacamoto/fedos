import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const DOCS_DIR = "docs/reviews/electron_dependency_packaging_v1";

const REQUIRED_DOCS: readonly string[] = [
  "index.md",
  "01_current_desktop_stack_inventory.md",
  "02_product_host_requirements.md",
  "03_options_comparison.md",
  "04_electron_dependency_blast_radius.md",
  "05_process_model.md",
  "06_ipc_command_boundary.md",
  "07_ipc_response_boundary.md",
  "08_electron_security_configuration.md",
  "09_filesystem_authority.md",
  "10_secret_input_and_master_seed_unlock.md",
  "11_local_data_location.md",
  "12_packaging.md",
  "13_windows_path_and_onedrive_risks.md",
  "14_code_signing_and_distribution.md",
  "15_updates.md",
  "16_logging_and_crash_reports.md",
  "17_threat_model.md",
  "18_testing_strategy.md",
  "19_implementation_arc_packaging.md",
  "20_final_recommendation.md",
];

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

function readAllDocs(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of REQUIRED_DOCS) result[name] = readDoc(name);
  return result;
}

describe("Electron Dependency and Desktop Packaging V1 review -- no implementation claimed", () => {
  it("1. no doc claims Electron is installed, added, or already implemented by this review", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/this review (installs|adds|implements) electron/i);
      expect(text, file).not.toMatch(/electron (is|has been) (now )?installed/i);
      expect(text, file).not.toMatch(/the electron adapter is implemented/i);
      expect(text, file).not.toMatch(/electron dependency (has been|is) added/i);
    }
  });

  it("2. every doc that discusses a future IPC/main/preload/renderer design frames it as NOT YET BUILT, never as already shipped", () => {
    const docsDiscussingIpc = ["05_process_model.md", "06_ipc_command_boundary.md", "07_ipc_response_boundary.md", "19_implementation_arc_packaging.md"];
    // `\s+` (not a literal space) tolerates this markdown's own line-wrapped prose, where a
    // phrase like "specification only" can legitimately be split across a soft line break.
    // Doc 07 legitimately uses a THIRD honest framing neither "not yet built" nor "specification
    // only" captures: the response vocabulary needs NO new work because it is already reused
    // verbatim from existing, already-real code -- "no new work required" is just as strong a
    // disclaimer against a false implementation claim as "not yet built" is.
    const notYetBuiltPattern =
      /not\s+(yet\s+)?(built|implemented|decided)|specification\s+only|nothing\s+(is\s+)?installed|deliberately\s+not\s+(designed|built)|no\s+new\s+[\s\S]{0,40}?(required|needed)/i;
    for (const file of docsDiscussingIpc) {
      const text = readDoc(file);
      expect(text, file).toMatch(notYetBuiltPattern);
    }
  });

  it("3. this review assigns no Alpha number to itself or to the Arc it recommends", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/this review is (Alpha|alpha) \d+/i);
      expect(text, file).not.toMatch(/recommend(s|ed)? Alpha \d+/i);
    }
  });

  it("4. no doc claims a secure Master Seed unlock boundary already exists", () => {
    const unlockDoc = readDoc("10_secret_input_and_master_seed_unlock.md");
    expect(unlockDoc).toMatch(/no secure passphrase-input boundary exists/i);
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/a secure (passphrase|unlock) (input )?boundary (already exists|is implemented)/i);
    }
  });
});

describe("Electron Dependency and Desktop Packaging V1 review -- recommendation consistency", () => {
  it("5. doc 20 names exactly one chosen option letter", () => {
    const final = readDoc("20_final_recommendation.md");
    expect(final).toMatch(/Chosen option:\s*D\./);
    // Every other lettered option must be explicitly REJECTED in the same document, not silently omitted.
    for (const letter of ["A", "B", "C", "E", "F"]) {
      expect(final, `option ${letter} must be explicitly addressed/rejected`).toMatch(new RegExp(`\\*\\*${letter}[^*]*\\*\\*[\\s\\S]{0,400}rejected`, "i"));
    }
  });

  it("6. doc 20's own 'Recommended next Arc' names the Electron dependency/build spike, matching the chosen option (D)", () => {
    const final = readDoc("20_final_recommendation.md");
    expect(final).toMatch(/Recommended next Arc/i);
    expect(final).toMatch(/Electron Dependency and Build Spike Arc/);
    expect(final).toMatch(/Package A/);
  });

  it("7. index.md's own summary names the SAME recommendation as doc 20 -- no drift between the index and the normative document", () => {
    const index = readDoc("index.md");
    const final = readDoc("20_final_recommendation.md");
    expect(index).toMatch(/build\/tooling SPIKE|Electron dependency\/build spike/i);
    expect(final).toMatch(/Chosen option:\s*D\./);
    // Both documents must agree Electron is not installed by this review.
    expect(index.toLowerCase()).toMatch(/no electron code is installed/);
  });

  it("8. index.md's own navigation table lists all 20 documents in order, matching the required doc list exactly", () => {
    const index = readDoc("index.md");
    for (const doc of REQUIRED_DOCS.filter((d) => d !== "index.md")) {
      expect(index, doc).toContain(doc);
    }
  });

  it("9. the review does not recommend installing Electron directly (option A) -- doc 20 must show A as rejected in its own current form", () => {
    const final = readDoc("20_final_recommendation.md");
    const optionASection = final.split(/##\s*What is NOT decided/i)[0] ?? final;
    expect(optionASection).toMatch(/\*\*A \(Electron now, in full\)\*\*[\s\S]{0,400}rejected/i);
  });
});
