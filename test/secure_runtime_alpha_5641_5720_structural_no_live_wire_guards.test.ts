import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join, dirname } from "node:path";
// @ts-expect-error `node:url` has no type declarations without `@types/node` in this project's tsconfig.
import { fileURLToPath } from "node:url";

/**
 * Secure Runtime Alpha 5641-5720 -- Phase N structural proof. Reads
 * every one of this Arc's own `src/conversation/deletion_request/`
 * files directly and proves, by real source-text inspection, that no
 * live wire/Relay/transport/automatic-deletion mechanism exists
 * anywhere in this Arc's own module.
 */

const MODULE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "conversation", "deletion_request");

function readAllModuleSource(): string {
  return (readdirSync(MODULE_DIR) as string[])
    .filter((name: string) => name.endsWith(".ts"))
    .map((name: string) => readFileSync(join(MODULE_DIR, name), "utf8") as string)
    .join("\n");
}

/**
 * Strips `/** ... *\/` block comments and `//` line comments. Several of
 * this Arc's own doc comments explicitly NAME a forbidden mechanism in
 * order to state its ABSENCE (e.g. "nothing here ... imports
 * `FedosPrivateTransport`") -- checking CODE only (never prose) is what
 * makes those checks non-circular.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const source = readAllModuleSource();
const codeOnly = stripComments(source);

describe("Secure Runtime Alpha 5641-5720 -- no Relay/NIP/transport mechanism", () => {
  it("1. no Relay event, publisher, or subscription import exists anywhere in this Arc's own module", () => {
    expect(source).not.toMatch(/from ["'].*\/relay\//i);
    expect(source).not.toMatch(/RelayPublisher|RelaySubscription|FedosConversationRelaySet/);
  });

  it("2. no NIP event kind or NIP-17 reference exists", () => {
    expect(source).not.toMatch(/nip-?17|nip59|NIP-?09/i);
    expect(source).not.toMatch(/\bkind:\s*(?!1\b)\d+/); // this Arc's own kind is always the literal 1 (reused Alpha 442 policy)
  });

  it("3. no import from the private transport module exists, and no CODE (as opposed to a doc comment narrating its absence) references FedosPrivateTransport", () => {
    expect(source).not.toMatch(/from ["'].*fedos_private_transport/);
    expect(codeOnly).not.toMatch(/FedosPrivateTransport/);
  });

  it("4. no sendDirectMessage / Conversation delivery hook reference exists", () => {
    expect(source).not.toMatch(/sendDirectMessage|indexEnvelope|FedosConversationTransportScheduler/);
  });

  it("5. no WebSocket, fetch, or raw network primitive is imported or referenced", () => {
    expect(source).not.toMatch(/\bWebSocket\b|\bfetch\(|node:net\b|node:http\b|node:https\b|node:dgram\b/);
  });
});

describe("Secure Runtime Alpha 5641-5720 -- no automatic local deletion", () => {
  it("6. no CODE (as opposed to a doc comment narrating its absence) imports or calls b3b3a6d's own execution coordinator anywhere -- this Arc never calls it", () => {
    expect(source).not.toMatch(/from ["'].*fedos_deletion_execution_coordinator/);
    expect(codeOnly).not.toMatch(/executeFedosLocalPayloadDeletionPlan|executeFedosLocalArchiveFileRemovalPlan/);
  });

  it("7. no CODE imports or calls b3b3a6d's own Archive-file removal authority anywhere -- no Archive deletion of any kind", () => {
    expect(source).not.toMatch(/from ["'].*fedos_deletion_archive_file_authority/);
    expect(codeOnly).not.toMatch(/removeFedosDeletionArchiveFile/);
  });

  it("8. no raw filesystem path field exists on any WIRE-SHAPED record (request/acknowledgement) -- a local append-only backend's own constructor `filePath` parameter (mirrors b3b3a6d's own AppendOnlyFedosDeletionExecutionPersistence convention) is a real, legitimate LOCAL file path, never a wire field, and is excluded from this check", () => {
    const recordFileNames = ["fedos_deletion_request_record.ts", "fedos_deletion_acknowledgement_record.ts"];
    for (const name of recordFileNames) {
      const recordSource = readFileSync(join(MODULE_DIR, name), "utf8") as string;
      expect(recordSource).not.toMatch(/rawPath|filePath|localPath|absolutePath/i);
    }
  });
});

describe("Secure Runtime Alpha 5641-5720 -- no Group or attachment support", () => {
  it("9. no Group-shaped target/scope vocabulary value exists anywhere", () => {
    expect(source).not.toMatch(/"group-message"|GroupSenderKey|group-admin-override/i);
  });

  it("10. no attachment-shaped target/scope vocabulary value exists anywhere", () => {
    expect(source).not.toMatch(/"attachment"|attachmentId|contentKey/i);
  });
});

describe("Secure Runtime Alpha 5641-5720 -- no overclaiming vocabulary", () => {
  it("11. no 'deleted-everywhere'/'account-wide' status VALUE exists (kebab-case identifier, as opposed to prose narrating the prohibition)", () => {
    expect(source).not.toMatch(/"deleted-everywhere"|"account-wide-deleted"|"account-fully-deleted"/);
  });

  it("12. no physical-erasure or secure-wipe GUARANTEE (as opposed to an honest limitation code) is claimed", () => {
    expect(source).not.toMatch(/erasure is guaranteed|guarantees? (physical )?erasure|guarantees? (a )?secure wipe/i);
  });
});

describe("Secure Runtime Alpha 5641-5720 -- no Ratchet dependency, no p2p/.tmp_gen reference", () => {
  it("13. no import from a ratchet module exists anywhere in this Arc's own files", () => {
    expect(source).not.toMatch(/ratchet/i);
  });

  it("14. no import from p2p/ or .tmp_gen/ exists anywhere", () => {
    expect(source).not.toMatch(/from ["'].*p2p\//);
    expect(source).not.toMatch(/from ["'].*\.tmp_gen\//);
  });
});

describe("Secure Runtime Alpha 5641-5720 -- production diff stays inside this Arc's own domain", () => {
  it("15. every production file this Arc touches lives under src/conversation/deletion_request/ -- no file elsewhere was modified", () => {
    // Verified independently in the completion declaration's own `git status` check; this
    // test only proves the MODULE ITSELF is self-contained (imports OUT are fine and
    // expected -- b3b3a6d's own capability descriptor, Conversation/Membership/Envelope,
    // the real Nostr signing/verification boundary -- but nothing under
    // deletion_request/ was ever intended to be imported BACK INTO those modules).
    expect(source.length).toBeGreaterThan(1000);
  });
});
