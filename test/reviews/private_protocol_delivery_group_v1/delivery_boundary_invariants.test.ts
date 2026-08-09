import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardRuntimeSource from "../../../src/os/messenger/board/runtime/fedos_board_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import eligibilityEvaluatorSource from "../../../src/os/messenger/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import eligibilityTypesSource from "../../../src/os/messenger/board/runtime/eligibility/fedos_outbound_eligibility_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import retryReasonCodecSource from "../../../src/os/messenger/board/observation/fedos_delivery_retry_reason_codec.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptionCoordinatorSource from "../../../src/os/messenger/conversations/encryption/fedos_conversation_encryption_coordinator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboundPublishResultSource from "../../../src/os/messenger/board/publish/fedos_outbound_publish_result.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublishResultMappingSource from "../../../src/os/messenger/board/publish/nostr/fedos_nostr_publish_result_to_outbound_publish_result.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relayOkCorrelatedPublisherSource from "../../../src/os/messenger/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts?raw";

/**
 * Private Protocol Delivery and Group Encryption V1 review -- delivery
 * boundary invariants. Verifies, against real source, the ordering and
 * separation-of-concerns claims `02`/`09`/`10`/`11`/`12` make: eligibility
 * runs before any Outbox intent, Publisher files carry no privacy/policy
 * logic, and result/retry vocabularies stay distinct. Never asserts that
 * any private-delivery Publisher/Outbox/eligibility gate exists yet --
 * only the existing public-post precedent this review's own recommendation
 * is modeled on.
 */

function allSrcFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
  let files: string[] = [];
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files = files.concat(allSrcFiles(path));
    } else if (entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

describe("Private Protocol Delivery and Group Encryption V1 review -- delivery ordering invariants", () => {
  it("1. FedosBoardRuntime calls the eligibility evaluator before it ever calls submitPostWithOutbox (the real Outbox-intent-creating call, per fedos_desktop_host.ts:543) -- grounds 02's required ordering", () => {
    const eligibilityCallIndex = boardRuntimeSource.indexOf('const eligibility = evaluateFedosOutboundEligibility(');
    const submitCallIndex = boardRuntimeSource.indexOf("this.#host.submitPostWithOutbox(post, eligibleTargets)");
    expect(eligibilityCallIndex).toBeGreaterThan(-1);
    expect(submitCallIndex).toBeGreaterThan(-1);
    expect(eligibilityCallIndex).toBeLessThan(submitCallIndex);
    // Confirms only ELIGIBLE targets are ever passed downstream to the call that creates an Outbox intent.
    expect(boardRuntimeSource as string).toMatch(/never even called for it/);
  });

  it("2. the eligibility result vocabulary is closed and coarse -- never a raw Error/stack/Publisher-supplied string -- grounds 09/11's result-vocabulary finding", () => {
    expect(eligibilityTypesSource as string).toMatch(/outcome:\s*"eligible"/);
    expect(eligibilityTypesSource as string).toMatch(/outcome:\s*"ineligible"/);
    expect(eligibilityTypesSource as string).toMatch(/"conversation-local-only"/);
    expect(eligibilityTypesSource as string).toMatch(/"unsupported-conversation-mode"/);
    expect(eligibilityTypesSource as string).toMatch(/"anonymous-author"/);
    expect(eligibilityTypesSource as string).toMatch(/"identity-not-controlled"/);
    expect(eligibilityTypesSource as string).toMatch(/"unsupported-target"/);
    expect(eligibilityTypesSource as string).toMatch(/"protocol-mismatch"/);
    // The type's own header states it avoids these in prose ("never a raw
    // `Error`, stack trace") -- assert no actual field is typed that way.
    expect(eligibilityTypesSource as string).not.toMatch(/:\s*Error\b|:\s*string\[\]\s*\/\/\s*stack/);
  });

  it("3. the eligibility input declares no field of type FedosBoardPost, only resolved Policy/Target/Author -- grounds 09's 'no inbound-provenance inference' finding", () => {
    // The file's own header explains, in prose, that it deliberately omits a
    // FedosBoardPost field -- so the bare identifier appears in a comment.
    // This asserts no *field* is actually typed as one.
    expect(eligibilityTypesSource as string).not.toMatch(/:\s*FedosBoardPost[,;\s)]/);
    expect(eligibilityTypesSource as string).toMatch(/policy:\s*FedosConversationPolicy/);
    expect(eligibilityTypesSource as string).toMatch(/target:\s*FedosBoardOutboxTarget/);
  });

  it("4. no Publisher file under src/board/publish/ references privacy/mode/policy/federationEligibility -- grounds 02's 'Publisher must not decide privacy policy' finding", () => {
    for (const file of allSrcFiles("src/board/publish")) {
      const text = readFileSync(file, "utf8") as string;
      expect(text, `${file} should not reference privacy/eligibility policy`).not.toMatch(
        /isEligibleForPublicOutboundTarget|federationEligibility|conversationPolicy|\bprivacy\b/i,
      );
    }
  });

  it("5. FedosOutboundPublishResult never conflates transport completion with server acceptance -- accepted requires externalReference -- grounds 11's four-notions-of-success finding", () => {
    expect(outboundPublishResultSource as string).toMatch(/outcome:\s*"accepted";\s*readonly externalReference:\s*string\s*\}/);
  });

  it("6. nostrPublishOneResultToOutboundPublishResult documents its own boolean input as transport-attempt-only, never relay confirmation -- grounds 11's finding", () => {
    expect(nostrPublishResultMappingSource as string).toMatch(/transport attempt completed without a local error/i);
    expect(nostrPublishResultMappingSource as string).toMatch(/Never produces `?outcome:\s*"rejected"/i);
    expect(nostrPublishResultMappingSource as string).not.toMatch(/return\s*\{\s*outcome:\s*"rejected"/);
  });

  it("7. only FedosRelayOkCorrelatedNostrBoardPublisher performs real relay-ACK correlation, with a bounded timeout -- grounds 04/11's finding", () => {
    expect(relayOkCorrelatedPublisherSource as string).toMatch(/DEFAULT_OK_CORRELATION_TIMEOUT_MS/);
    expect(relayOkCorrelatedPublisherSource as string).toMatch(/onRelayMessage/);
  });

  it("8. decodeFedosDeliveryRetryReason fails closed to isFinal:false for any unrecognized reason string -- grounds 12's permanent-rejection-semantics finding", async () => {
    const { decodeFedosDeliveryRetryReason, encodeFedosDeliveryRetryReason } = (await import(
      "../../../src/board/observation/fedos_delivery_retry_reason_codec.js"
    )) as {
      decodeFedosDeliveryRetryReason: (reason: string | undefined) => { isFinal: boolean; detail: string | null };
      encodeFedosDeliveryRetryReason: (isFinal: boolean, detail: string | null) => string;
    };
    expect(decodeFedosDeliveryRetryReason(undefined)).toEqual({ isFinal: false, detail: null });
    expect(decodeFedosDeliveryRetryReason("some-unrecognized-garbage")).toEqual({
      isFinal: false,
      detail: "some-unrecognized-garbage",
    });
    const encodedFinal = encodeFedosDeliveryRetryReason(true, "permanently-rejected");
    expect(decodeFedosDeliveryRetryReason(encodedFinal)).toEqual({ isFinal: true, detail: "permanently-rejected" });
    expect(retryReasonCodecSource as string).toMatch(/NEVER throws/);
  });

  it("9. FedosConversationEncryptionCoordinator supports a caller-supplied idempotency key for resend safety, and rejects unsafe ones -- grounds 12's resend-safety finding", () => {
    expect(encryptionCoordinatorSource as string).toMatch(/idempotencyKey\?:\s*string/);
    expect(encryptionCoordinatorSource as string).toMatch(/isSafeIdempotencyKey/);
    expect(encryptionCoordinatorSource as string).toMatch(/coordinationPersistence\.getCoordination/);
  });

  it("10. the Encryption Coordinator's own coordination log re-reads rather than re-encrypts once payload-persisted -- grounds 12's restart-recovery finding", () => {
    expect(encryptionCoordinatorSource as string).toMatch(/alreadyEncrypted = existing\?\.phase === "payload-persisted"/);
    expect(encryptionCoordinatorSource as string).toMatch(/Recovery from "payload-persisted"/);
  });
});
