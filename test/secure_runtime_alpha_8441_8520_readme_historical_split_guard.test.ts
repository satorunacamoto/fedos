import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Secure Runtime Alpha 8441-8520 (FedOS Public Beta Governance, Audit
 * Handoff, and Final Technical Closure Arc) — Phase B structural guard.
 *
 * README.md used to carry the ORIGINAL "nostr-window" prototype's own
 * ~1,500-line reference section (including an old "Security scope"
 * heading describing an entirely different, unencrypted product) at the
 * same heading level as the current product's own real status —
 * letting long-obsolete claims read as equally authoritative as current
 * ones. This Arc moved that section, unmodified in content, to
 * `docs/fedos_original_prototype_reference_historical.md` with explicit
 * historical framing. This test prevents it from silently reappearing
 * in README.md.
 */
describe("Alpha 8441-8520 -- README/historical-doc split guard", () => {
  it("README.md no longer carries the old prototype's own 'Security scope' heading", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).not.toMatch(/^## Security scope \(read before trusting anything here\)/m);
  });

  it("README.md no longer carries the old prototype's own 'What is implemented' / 'Roadmap (stages)' headings", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).not.toMatch(/^## What is implemented/m);
    expect(readme).not.toMatch(/^## Roadmap \(stages\)/m);
  });

  it("README.md points to the historical doc instead", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toMatch(/docs\/fedos_original_prototype_reference_historical\.md/);
  });

  it("the historical doc exists, is explicitly labeled HISTORICAL, and carries the moved content", () => {
    const doc = readFileSync("docs/fedos_original_prototype_reference_historical.md", "utf8");
    expect(doc).toMatch(/HISTORICAL/);
    expect(doc).toMatch(/## Security scope \(read before trusting anything here\)/);
    expect(doc).toMatch(/## What is implemented/);
    expect(doc).toMatch(/## Roadmap \(stages\)/);
  });

  it("the historical doc explicitly disclaims bearing on the current product's real security posture", () => {
    const doc = readFileSync("docs/fedos_original_prototype_reference_historical.md", "utf8");
    expect(doc).toMatch(/no bearing/i);
    expect(doc).toMatch(/SECURITY\.md/);
  });

  it("SECURITY.md (the current, real security status) does not itself get shadowed by the historical doc's own old claims", () => {
    const security = readFileSync("SECURITY.md", "utf8");
    // The current SECURITY.md must not describe the old prototype's own
    // unencrypted-chat, NIP-07-signer world -- it describes the real
    // shipped Desktop product's own current status instead.
    expect(security).not.toMatch(/DMs are \*\*not\*\* encrypted/);
    expect(security).toMatch(/No external security audit has been performed/);
  });
});
