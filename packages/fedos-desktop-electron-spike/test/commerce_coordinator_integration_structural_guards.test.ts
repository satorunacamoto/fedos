import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc — COORDINATOR
 * INTEGRATION PASS structural guards.
 *
 * Agents D, M, A and U each worked in a separate worktree off the same base
 * commit and could not see each other's branches. These guards pin the
 * cross-agent reconciliations the Coordinator had to make in
 * `fedos_electron_beta_main.cts` and `fedos_electron_beta_renderer.ts` —
 * decisions that no single agent's own test file covers, precisely because
 * no single agent could observe the conflict. Same source-inspection
 * convention as `commerce_reachable_catalog_phase1_structural_guards.test.ts`.
 */

const REPO_ROOT = process.cwd();

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

const MAIN_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts";
const RENDERER_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts";

describe("Coordinator integration -- Agent D's relay-derived default never silently overrides Agent U's durable explicit choice", () => {
  it("1. initializeCommerceNetworkProfileFromRelayConfig() returns early when a persisted explicit choice exists, BEFORE assigning the relay-derived value", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("function initializeCommerceNetworkProfileFromRelayConfig(): void {");
    expect(start, "expected Agent D's initializer to still exist").toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/if \(hasPersistedCommerceNetworkProfileChoice\(\)\) return;/);
    // Order matters: the guard must precede the assignment, or the override is still clobbered.
    const guardIdx = body.indexOf("hasPersistedCommerceNetworkProfileChoice()");
    const assignIdx = body.indexOf("commerceNetworkProfile = activeRelays.length");
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(assignIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeLessThan(assignIdx);
  });

  it("2. the override signal is sound: persistCommerceNetworkProfile() is only ever called from the explicit user-facing set handler, so a profile file always means a deliberate human choice", () => {
    const source = stripComments(read(MAIN_PATH));
    const callSites = source.match(/persistCommerceNetworkProfile\(/g) ?? [];
    // One definition + exactly one call site.
    expect(callSites.length).toBe(2);
    const setStart = source.indexOf("async function handleCommerceNetworkProfileSet(payload: unknown) {");
    expect(setStart).toBeGreaterThanOrEqual(0);
    const setBody = source.slice(setStart, source.indexOf("\n}", setStart) + 2);
    expect(setBody).toMatch(/persistCommerceNetworkProfile\(commerceNetworkProfile\);/);
  });

  it("3. hasPersistedCommerceNetworkProfileChoice() fails closed -- any read/parse problem reports 'no explicit choice', never fabricates one", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("function hasPersistedCommerceNetworkProfileChoice(): boolean {");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/catch \{\s*return false;/);
    // Only the known-good closed vocabulary counts as a real choice.
    expect(body).toMatch(/COMMERCE_NETWORK_PROFILE_VALUES/);
  });
});

describe("Coordinator integration -- one purchased-content denial vocabulary, covering BOTH agents' outcomes", () => {
  it("4. Agent A's competing commerceMediaGrantRedeemFriendlyReason() is gone, leaving exactly one mapper", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).not.toMatch(/function commerceMediaGrantRedeemFriendlyReason/);
    expect(source).toMatch(/function commercePurchasedContentDenialText\(/);
  });

  it("5. the surviving mapper still covers the states only Agent A's new cross-process release channel can produce -- pending, and the release-specific reasons", () => {
    const source = stripComments(read(RENDERER_PATH));
    const fnStart = source.indexOf("function commercePurchasedContentDenialText(");
    const fnBody = source.slice(fnStart, source.indexOf("\n}", fnStart) + 2);
    // `pending` is an OUTCOME, not a denial reason, so it cannot live in the table.
    expect(fnBody).toMatch(/outcome === "pending"/);

    const tableStart = source.indexOf("const COMMERCE_PURCHASED_CONTENT_DENIAL_TEXT");
    const tableBody = source.slice(tableStart, source.indexOf("\n};", tableStart) + 3);
    for (const key of ["requested-awaiting-seller-response", "content-corrupt"]) {
      expect(tableBody, `expected migrated Agent A reason "${key}"`).toMatch(new RegExp(`"${key}"`));
    }
  });
});

describe("Coordinator integration -- Agent M's real protected-content control makes Agent U's 'no control for that yet' caption obsolete", () => {
  it("6. the image-attach caption still disambiguates itself from deliverable content, but no longer claims the build has no such control", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceMerchantProductImageAttachControls(productId: string): HTMLDivElement {");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 1400);
    // Agent U's disambiguating half is preserved.
    expect(body).toMatch(/not where you attach the digital content buyers will receive/);
    // ...but the now-false parenthetical is gone, because Agent M built exactly that control.
    expect(body).not.toMatch(/this build has no control for that yet/);
    expect(source).toMatch(/function commerceMerchantProductContentAttachControls\(/);
  });
});

describe("Coordinator security review follow-up -- the digital content delivery invariant is checked on BOTH completion paths, not just the local one", () => {
  it("7. applyInboundPrivateOrderSyncNonFatal() re-runs evaluateDigitalContentDeliveryInvariantForOrderCompletion() before saving an inbound transition into \"completed\"", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("function applyInboundPrivateOrderSyncNonFatal(envelope: {");
    expect(start, "expected the inbound private-order-sync apply shell to still exist").toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\napplyInboundPrivateOrderSyncNonFatal", start + 1) || source.indexOf("\n}\n\n", start) + 4);
    expect(body).toMatch(/evaluateDigitalContentDeliveryInvariantForOrderCompletion/);
    // Order matters: the invariant check must run, and on failure return, BEFORE `state.orders.save(result.order)`.
    const invariantIdx = body.indexOf("evaluateDigitalContentDeliveryInvariantForOrderCompletion");
    const saveIdx = body.lastIndexOf("state.orders.save(result.order)");
    expect(invariantIdx).toBeGreaterThan(0);
    expect(saveIdx).toBeGreaterThan(invariantIdx);
    // Only gates a genuine NEW transition into "completed", never re-evaluates an
    // already-completed order or a transition to any other status.
    expect(body).toMatch(/existingOrder\?\.status !== "completed" && result\.order\.status === "completed"/);
    // On failure, the event id is deliberately NOT added to the dedup set (mirrors the
    // pre-existing "retry-later" contract) -- re-verify by checking the early `return`
    // sits before `commercePrivateOrderAppliedEventIds.add(envelope.eventId)`.
    const dedupAddIdx = body.indexOf("commercePrivateOrderAppliedEventIds.add(envelope.eventId)");
    const invariantBlockEnd = body.indexOf("}", body.indexOf("if (!deliveryInvariant.satisfied)", invariantIdx));
    expect(dedupAddIdx).toBeGreaterThan(invariantBlockEnd);
  });
});
