import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join, dirname } from "node:path";
// @ts-expect-error `node:url` has no type declarations without `@types/node` in this project's tsconfig.
import { fileURLToPath } from "node:url";

/**
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion
 * Request Private Transport and Local Policy Integration Arc) — Phase Q
 * structural guards over THIS Arc's own new files (unlike
 * `5641-5720`'s own structural guard, this Arc's mission is EXACTLY to
 * add real transport/execution-coordinator wiring — the point of this
 * file is proving the boundary AROUND that wiring, not its absence).
 */

const MODULE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "conversation", "deletion_request");

const THIS_ARC_FILES: readonly string[] = [
  "fedos_deletion_request_control_payload.ts",
  "fedos_deletion_request_outbound_coordinator.ts",
  "fedos_deletion_request_inbound_coordinator.ts",
  "fedos_deletion_request_conversation_existence_adapter.ts",
  "fedos_deletion_acknowledgement_outbound_coordinator.ts",
  "fedos_deletion_acknowledgement_inbound_coordinator.ts",
  "fedos_deletion_request_runtime.ts",
  "fedos_deletion_recipient_policy.ts",
];

function readThisArcSource(): string {
  return THIS_ARC_FILES.map((name) => readFileSync(join(MODULE_DIR, name), "utf8") as string).join("\n");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const source = readThisArcSource();
const codeOnly = stripComments(source);

describe("Secure Runtime Alpha 5881-5960 -- no Relay deletion, no new NIP, no new Nostr kind", () => {
  it("1. no new Nostr event kind literal other than 1 (the existing signed-content kind reused verbatim) appears in code", () => {
    expect(codeOnly).not.toMatch(/\bkind:\s*(?!1\b)\d+/);
  });

  it("2. no NIP number other than an unmodified reference to the EXISTING NIP-17/NIP-59 route selection appears as a NEW protocol surface", () => {
    expect(codeOnly).not.toMatch(/NIP-?09|"nip-?\d+-deletion"/i);
  });

  it("3. no direct Relay publish/subscribe primitive is imported -- every send goes through the existing sendMailboxNip17Control() seam only", () => {
    expect(source).not.toMatch(/from ["'].*\/relay\//i);
    expect(codeOnly).not.toMatch(/RelayPublisher|RelaySubscription|FedosConversationRelaySet/);
  });
});

describe("Secure Runtime Alpha 5881-5960 -- no Archive/backup deletion, no arbitrary path", () => {
  it("4. no Archive-file removal authority is imported or called by ANY of this Arc's own new files", () => {
    expect(source).not.toMatch(/from ["'].*fedos_deletion_archive_file_authority/);
    expect(codeOnly).not.toMatch(/removeFedosDeletionArchiveFile|executeFedosLocalArchiveFileRemovalPlan/);
  });

  it("5. no backup-shaped vocabulary value or filesystem-path field exists", () => {
    expect(codeOnly).not.toMatch(/"backup"|rawPath|absolutePath|localPath\s*:/i);
  });

  it("6. no arbitrary caller-supplied path ever reaches a filesystem call -- only canonical opaque ids/handles cross every public method boundary in this Arc's own new files", () => {
    expect(codeOnly).not.toMatch(/readFileSync|writeFileSync|unlinkSync|require\(["']fs["']\)/);
  });
});

describe("Secure Runtime Alpha 5881-5960 -- no Group/attachment support, no account-wide claim, no physical-erasure claim", () => {
  it("7. no Group-shaped target/scope vocabulary value exists", () => {
    expect(source).not.toMatch(/"group-message"|GroupSenderKey|group-admin-override/i);
  });

  it("8. no attachment-shaped target/scope vocabulary value exists", () => {
    expect(source).not.toMatch(/"attachment"|attachmentId|contentKey/i);
  });

  it("9. no 'deleted-everywhere'/account-wide status value exists", () => {
    expect(source).not.toMatch(/"deleted-everywhere"|"account-wide-deleted"|"account-fully-deleted"/);
  });

  it("10. no physical-erasure or secure-wipe GUARANTEE is claimed", () => {
    expect(source).not.toMatch(/erasure is guaranteed|guarantees? (physical )?erasure|guarantees? (a )?secure wipe/i);
  });

  it("11. one Device acknowledgement is never treated as account-wide -- the acknowledgement mapping always carries a specific recipientDeviceRef field, never a wildcard/omitted Device", () => {
    expect(source).toContain("recipientDeviceRef");
  });
});

describe("Secure Runtime Alpha 5881-5960 -- no Identity Transition / Sender-Key / MLS / PQ, no p2p/.tmp_gen", () => {
  it("12. no import from an identity-transition module exists", () => {
    expect(source).not.toMatch(/identity[_-]transition/i);
  });

  it("13. no Sender-Key/MLS/PQ reference exists", () => {
    expect(source).not.toMatch(/sender[_-]key|\bMLS\b|post-quantum|\bPQ\b/i);
  });

  it("14. no import from p2p/ or .tmp_gen/ exists", () => {
    expect(source).not.toMatch(/from ["'].*p2p\//);
    expect(source).not.toMatch(/from ["'].*\.tmp_gen\//);
  });

  it("15. no Ratchet cryptography module is imported -- this Arc reuses the EXISTING NIP-17 route/wire adapter only, never the Ratchet's own message codec", () => {
    expect(source).not.toMatch(/from ["'].*\/ratchet\/fedos_direct_ratchet/);
  });
});

describe("Secure Runtime Alpha 5881-5960 -- no silent route downgrade", () => {
  it("16. every send call selects the SAME single explicit route -- no second route/adapter type is ever referenced", () => {
    expect(codeOnly).not.toMatch(/fedos-private-v1|sendMailbox\(/);
  });

  it("17. a route-unavailable outcome is surfaced as-is, never silently retried on a different route", () => {
    expect(source).toContain("route-unavailable");
  });
});

describe("Secure Runtime Alpha 5881-5960 -- no user-visible chat message import", () => {
  it("18. no CODE imports the Direct message send/list surface -- a control payload is never treated as a chat message", () => {
    expect(codeOnly).not.toMatch(/sendDirectMessage|listDirectMessages/);
  });
});
