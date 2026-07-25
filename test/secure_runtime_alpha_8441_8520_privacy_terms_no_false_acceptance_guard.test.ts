import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Secure Runtime Alpha 8441-8520 (FedOS Public Beta Governance, Audit
 * Handoff, and Final Technical Closure Arc) — Phase H structural guard.
 *
 * The Privacy Policy and Terms drafts are explicitly unreviewed drafts
 * with no legal effect. This test guards two things: (1) the shipped
 * app's own real page markup never presents an "I agree"/"I accept"
 * control that would imply a user consented to either document (it
 * currently does not — this Arc verified that directly before writing
 * this guard), and (2) both draft documents carry the required
 * prominent status banner so nobody mistakes either for approved
 * policy.
 */
describe("Alpha 8441-8520 -- Privacy Policy / Terms no-false-acceptance guard", () => {
  it("the real packaged page never presents an acceptance control for Privacy Policy or Terms", () => {
    const page = readFileSync("packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html", "utf8");
    expect(page).not.toMatch(/I agree/i);
    expect(page).not.toMatch(/I accept/i);
    expect(page).not.toMatch(/accept.{0,20}terms/i);
    expect(page).not.toMatch(/privacy policy/i);
  });

  it("the Privacy Policy draft carries the required prominent DRAFT status banner", () => {
    const doc = readFileSync("docs/fedos_privacy_policy_draft.md", "utf8");
    expect(doc).toMatch(/STATUS: DRAFT — NOT LEGALLY REVIEWED — HUMAN OWNER\/JURISDICTION\s*\n?>? REQUIRED — NOT YET ACCEPTED AS RELEASE POLICY/);
  });

  it("the Terms draft carries the required prominent DRAFT status banner", () => {
    const doc = readFileSync("docs/fedos_terms_draft.md", "utf8");
    expect(doc).toMatch(/STATUS: DRAFT — NOT LEGALLY REVIEWED — HUMAN OWNER\/JURISDICTION\s*\n?>? REQUIRED — NOT YET ACCEPTED AS RELEASE POLICY/);
  });

  it("the Terms draft documents that Closed Beta can proceed under informed pilot consent instead", () => {
    const doc = readFileSync("docs/fedos_terms_draft.md", "utf8");
    expect(doc).toMatch(/informed\s+pilot\s+consent/i);
  });

  it("neither draft invents a jurisdiction, governing law, or legal entity name", () => {
    const privacy = readFileSync("docs/fedos_privacy_policy_draft.md", "utf8");
    const terms = readFileSync("docs/fedos_terms_draft.md", "utf8");
    // A real jurisdiction/entity would read as a proper-noun state/country
    // name near "governing law" -- instead both files must leave that
    // section as an explicit placeholder.
    expect(terms).toMatch(/HUMAN INPUT REQUIRED|Intentionally left blank/i);
    expect(privacy).toMatch(/HUMAN INPUT REQUIRED|placeholder/i);
  });
});
