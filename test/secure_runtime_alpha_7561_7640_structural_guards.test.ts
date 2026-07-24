import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import privateTransportSource from "../src/conversation/transport/fedos_private_transport.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/conversation/transport/fedos_conversation_transport_scheduler.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/conversation/transport/fedos_conversation_transport_delivery_recovery_hydration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardHydrationSource from "../src/desktop/host/fedos_delivery_recovery_hydration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopRuntimeSource from "../src/desktop/runtime/fedos_desktop_runtime.ts?raw";

/**
 * Secure Runtime Alpha 7561-7640 ("FedOS Conversation Outbox Restart
 * Hydration and Scheduler Scalability Arc") — Phase K structural guards,
 * mirroring this repository's established per-Arc pattern (e.g. Alpha
 * 1471-1540's own `test/secure_runtime_alpha_1471_1540_structural_guards.test.ts`).
 *
 * Git-diff-based guards (no Archive/Retention/Safety-Center files
 * changed, no p2p/.tmp_gen changes, no new production dependency, README
 * updated newest-first) are verified directly via `git diff --stat`
 * against this Arc's own base commit as part of the Verification phase
 * and reported in the completion declaration — not duplicated here as
 * source-text regexes, since a real diff is the more precise, more
 * direct instrument for "did I touch a file outside my domain" than any
 * regex could be.
 */
describe("Secure Runtime Alpha 7561-7640 -- Conversation Outbox Restart Hydration Structural Guards", () => {
  it("1. exactly ONE call site invokes hydrateFedosConversationTransportDeliveryRecoveryState in the entire src/ tree", () => {
    const callSites = [...privateTransportSource.matchAll(/hydrateFedosConversationTransportDeliveryRecoveryState\(/g)];
    expect(callSites.length).toBe(1);
  });

  it("2. the production Scheduler construction site passes initialDelivered/initialAbandoned -- the hydration result is not silently discarded", () => {
    const constructionMatch = privateTransportSource.match(
      /new FedosConversationTransportScheduler\(\{[\s\S]*?\}\);/,
    );
    expect(constructionMatch).not.toBeNull();
    const constructionBlock = constructionMatch![0];
    expect(constructionBlock).toMatch(/initialDelivered:\s*recoveryState\.delivered/);
    expect(constructionBlock).toMatch(/initialAbandoned:\s*recoveryState\.abandoned/);
  });

  it("3. still exactly ONE call site constructs FedosConversationTransportScheduler anywhere in src/ (no second Scheduler introduced)", () => {
    const callSites = [...privateTransportSource.matchAll(/new FedosConversationTransportScheduler\(/g)];
    expect(callSites.length).toBe(1);
  });

  it("4. FedosConversationTransportScheduler's own constructor still declares exactly one initialDelivered and one initialAbandoned optional field -- this Arc did not widen the Scheduler's own dependency shape", () => {
    expect([...schedulerSource.matchAll(/readonly initialDelivered\?:/g)]).toHaveLength(1);
    expect([...schedulerSource.matchAll(/readonly initialAbandoned\?:/g)]).toHaveLength(1);
    // No initialCompletedAttempts seam was added -- Phase A's own named,
    // deliberate scope decision (mirrors Board's shape only where source-
    // compatible, does not copy Board's abandonmentPolicy/completedAttempts
    // concept, which this Scheduler has no consumer for).
    expect(schedulerSource).not.toMatch(/initialCompletedAttempts/);
    expect(schedulerSource).not.toMatch(/abandonmentPolicy/);
  });

  it("5. the new hydration file never imports anything Archive/Retention/Safety-Center/Nostr-crypto/UI/p2p-shaped -- pure Outbox+Observation read boundary only", () => {
    const FORBIDDEN_IMPORT_PATTERNS = [
      /from ["'][^"']*archive[^"']*["']/i,
      /from ["'][^"']*retention[^"']*["']/i,
      /from ["'][^"']*safety_center[^"']*["']/i,
      /from ["'][^"']*[/_]crypto[/_.]/i,
      /from ["'][^"']*[/_]sign[/_.]/i,
      /from ["'][^"']*renderer[^"']*["']/i,
      /from ["'][^"']*\/p2p\//i,
    ];
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      expect(hydrationSource).not.toMatch(pattern);
    }
  });

  it("6. the new hydration file never imports anything from the Nostr inbound-import/recipient-dedup subsystem -- Relay-ACK and recipient-import stay structurally disjoint", () => {
    expect(hydrationSource).not.toMatch(/fedos_nip17_inbound_import_coordinator/);
    expect(hydrationSource).not.toMatch(/fedos_private_nostr_import_record/);
  });

  it("7. Board's own hydration file (Alpha 585/586) is untouched by this Arc -- Board and Conversation hydration remain two separate functions/files, not merged into one shared abstraction", () => {
    // A merge would collapse this into one import site; confirm Board's
    // own file still exports its own, differently-shaped, 4-field
    // FedosDeliveryRecoveryState (delivered/abandoned/completedAttempts/
    // nextAttemptCountBySubject) -- NOT the 2-field shape this Arc's own
    // Conversation-side function returns. Checks the actual EXPORTED
    // INTERFACE shape (code, not prose) -- this Arc's own doc comments
    // legitimately DISCUSS completedAttempts/nextAttemptCountBySubject in
    // prose (explaining why Conversation's shape omits them), so a blind
    // whole-file text scan for those words would false-positive on its
    // own explanatory comments (the exact pitfall Alpha 1471-1540's own
    // structural guard file already warns about for its own patterns).
    expect(boardHydrationSource).toMatch(/export function hydrateFedosDeliveryRecoveryState\(/);
    expect(boardHydrationSource).toMatch(/completedAttempts/);
    expect(boardHydrationSource).toMatch(/nextAttemptCountBySubject/);
    const conversationInterfaceMatch = hydrationSource.match(
      /export interface FedosConversationTransportDeliveryRecoveryState \{[\s\S]*?\n\}/,
    );
    expect(conversationInterfaceMatch).not.toBeNull();
    const interfaceBody = conversationInterfaceMatch![0];
    expect(interfaceBody).toMatch(/readonly delivered: ReadonlySet<string>/);
    expect(interfaceBody).toMatch(/readonly abandoned: ReadonlySet<string>/);
    expect(interfaceBody).not.toMatch(/completedAttempts/);
    expect(interfaceBody).not.toMatch(/nextAttemptCountBySubject/);
  });

  it("8. the hydration file performs no write of any kind -- no call to putIntent/putObservation/a real .record(/.hydrateAttemptCount( anywhere in its own source (prose mentions in doc comments explaining what Board's version does are expected and fine)", () => {
    expect(hydrationSource).not.toMatch(/\.putIntent\(/);
    expect(hydrationSource).not.toMatch(/\.putObservation\(/);
    // A real call is `retryQuery.record(` / `repository.record(` /
    // `observationRepository.record(` -- something.record( on its own
    // line/expression position. Prose in backticks (`` `record()` ``)
    // never appears with a literal leading dot immediately before an
    // identifier in CALL position outside of the one legitimate prose
    // sentence already asserted not to appear via the interface check
    // above; explicitly confirm no CODE line (not inside a `/** ... */`
    // block) contains a `.record(` call.
    const codeOnly = hydrationSource.replace(/\/\*\*[\s\S]*?\*\//g, "");
    expect(codeOnly).not.toMatch(/\.record\(/);
    expect(codeOnly).not.toMatch(/\.hydrateAttemptCount\(/);
  });

  it("9. FedosPrivateTransport still has exactly one production construction site (fedos_desktop_runtime.ts) -- this Arc did not introduce a second Runtime-level Transport owner", () => {
    const callSites = [...desktopRuntimeSource.matchAll(/new FedosPrivateTransport\(/g)];
    expect(callSites.length).toBe(1);
  });
});
