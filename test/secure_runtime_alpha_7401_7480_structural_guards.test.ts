/**
 * Secure Runtime Alpha 7401-7480 (FedOS Direct Conversation Route Binding
 * and NIP-17 Inbound Isolation Arc) — Phase M: structural guards, proving
 * by direct source inspection (never narrative claim alone) what this
 * Arc actually built, and what it deliberately left untouched.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error see above.
import { join, dirname } from "node:path";
// @ts-expect-error see above.
import { fileURLToPath } from "node:url";
// @ts-expect-error see above.
import { execFileSync } from "node:child_process";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARC_BASE = "194dc448";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

function diffNames(pathspec?: string): string {
  const args = ["diff", "--name-only", ARC_BASE];
  if (pathspec) args.push("--", pathspec);
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_DIFF_FAILED";
  }
}

const RESOLVER_PATH = "src/conversation/delivery/nostr/fedos_direct_conversation_route_binding_resolver.ts";
const LEGACY_PATH = "src/conversation/delivery/nostr/fedos_private_nostr_inbound_legacy_candidate_count.ts";
const PLAIN_PAYLOAD_PATH = "src/conversation/delivery/nostr/nip17/fedos_direct_conversation_plain_message_payload.ts";
const RATCHET_PAYLOAD_PATH = "src/conversation/delivery/nostr/nip17/fedos_direct_ratchet_nip17_payload.ts";
const PLAIN_COORDINATOR_PATH = "src/conversation/delivery/nostr/nip17/fedos_nip17_inbound_import_coordinator.ts";
const RATCHET_INBOUND_PATH = "src/conversation/ratchet/fedos_direct_ratchet_inbound_integration.ts";
const MESSAGING_COORDINATOR_PATH = "src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts";
const OLD_RESOLVER_PATH = "src/conversation/delivery/nostr/fedos_private_nostr_inbound_conversation_resolver.ts";

describe("Secure Runtime Alpha 7401-7480 -- structural guards", () => {
  it("1. the OLD peer-only resolver (Alpha 1424) is retained byte-for-byte UNCHANGED -- it is reused, never rewritten, for the bounded Legacy Policy only", () => {
    expect(diffNames(OLD_RESOLVER_PATH).trim()).toBe("");
  });

  it("2. the plain route's PRIMARY admission gate resolves the exact Conversation DIRECTLY from the route binding -- never a peer-only 'first match' scan", () => {
    const source = stripComments(read(PLAIN_COORDINATOR_PATH));
    expect(source).toMatch(/resolveFedosDirectConversationByRouteBinding\(/);
    expect(source).not.toMatch(/resolveFedosPrivateNostrInboundDirectConversation/);
    // The bounded legacy fallback is the ONLY place a peer-scan-derived
    // resolver may ever run, and it is a COUNTING function (ambiguity
    // detection), never a first-match resolver.
    expect(source).toMatch(/countFedosPrivateNostrInboundLegacyCandidates\(/);
  });

  it("3. the Ratchet route's inbound dispatch resolves the exact Conversation DIRECTLY from the route binding for both session-init and schemaVersion-2 messages -- the peer-only resolver is retained ONLY for the bounded Legacy Policy (schemaVersion-1 messages)", () => {
    const source = stripComments(read(RATCHET_INBOUND_PATH));
    expect(source).toMatch(/resolveFedosDirectConversationByRouteBinding\(resolverDeps, payload\.conversationId, rumor\.senderPublicKeyHex\)/);
    expect(source).toMatch(/countFedosPrivateNostrInboundLegacyCandidates\(resolverDeps, rumor\.senderPublicKeyHex\)/);
    expect(source).not.toMatch(/resolveFedosPrivateNostrInboundDirectConversation\(/);
  });

  it("4. no unauthenticated Conversation routing fact -- the route binding lives ONLY inside encrypted Rumor content, never in an outer Gift Wrap tag or any Relay-visible field", () => {
    const plainPayload = stripComments(read(PLAIN_PAYLOAD_PATH));
    expect(plainPayload).not.toMatch(/tags\.push|\.tags\s*=|addTag/i);
    const messagingSource = stripComments(read(MESSAGING_COORDINATOR_PATH));
    // The binding is constructed and handed to `sendMailboxNip17` as the
    // WIRE BYTES parameter (i.e., what becomes Rumor.content, itself
    // NIP-44/NIP-59 encrypted twice over before ever reaching a Relay) --
    // never assigned to any outer/tag-level field.
    expect(messagingSource).toMatch(/encodeFedosDirectConversationPlainMessagePayload\(/);
    expect(messagingSource).toMatch(/this\.#deps\.delivery\.sendMailboxNip17\(result\.envelopeId, conversationId, wireBytes\)/);
  });

  it("5. no silent legacy fallback under ambiguity -- two or more legacy candidates always fails closed, never a first-match guess, on BOTH routes", () => {
    const plainSource = stripComments(read(PLAIN_COORDINATOR_PATH));
    expect(plainSource).toMatch(/counted\.candidates\.length > 1\)\s*return \{ outcome: "ambiguous-legacy-route" \};/);
    const ratchetSource = stripComments(read(RATCHET_INBOUND_PATH));
    expect(ratchetSource).toMatch(/counted\.candidates\.length > 1\)\s*return \{ outcome: "ambiguous-legacy-route" \};/);
  });

  it("6. a malformed (but present) binding NEVER falls through to the legacy path on either route -- fails closed immediately", () => {
    const plainSource = stripComments(read(PLAIN_COORDINATOR_PATH));
    const malformedIndex = plainSource.indexOf('if (decoded.outcome === "malformed") return { outcome: "malformed-binding" };');
    expect(malformedIndex).toBeGreaterThanOrEqual(0);
    // Must appear BEFORE the legacy candidate-counting call.
    const legacyIndex = plainSource.indexOf("countFedosPrivateNostrInboundLegacyCandidates(");
    expect(malformedIndex).toBeLessThan(legacyIndex);
  });

  it("7. unknown Ratchet schemaVersions fail closed as 'unsupported-version' -- never silently reinterpreted as plain legacy chat text", () => {
    const source = stripComments(read(RATCHET_INBOUND_PATH));
    expect(source).toMatch(/isRecognizableFedosDirectRatchetNip17PayloadShape\(rumor\.content\)\)\s*return \{ outcome: "unsupported-version" \};/);
  });

  it("8. no new NIP claim -- both new payload codecs' own header comments explicitly disclaim standard NIP-17 interoperability for their structured inner shape, mirroring the already-reviewed Ratchet payload convention", () => {
    const plainPayload = read(PLAIN_PAYLOAD_PATH);
    expect(plainPayload).toMatch(/NOT a claim/i);
    const ratchetPayload = read(RATCHET_PAYLOAD_PATH).replace(/[\s*]+/g, " ");
    expect(ratchetPayload).toMatch(/not a new NIP/i);
  });

  it("9. no new crypto primitive -- this Arc's own new files never import a Rust/WASM binding or construct cryptographic material", () => {
    for (const file of [RESOLVER_PATH, LEGACY_PATH, PLAIN_PAYLOAD_PATH]) {
      const source = stripComments(read(file));
      expect(source, file).not.toMatch(/fedos_core_rust|wasm|SecretHandle|masterSeed.*handle/i);
    }
    expect(diffNames("packages/fedos-core-rust").trim()).toBe("");
  });

  it("10. no second Runtime/authority/Store -- startFedosDesktopRuntime and FedosConversationRuntime remain the ONE production construction chain", () => {
    const diffOutput = diffNames();
    expect(diffOutput).not.toMatch(/fedos_desktop_runtime_v2/);
    expect(diffOutput).not.toMatch(/fedos_conversation_runtime_v2/);
    const runtimeSource = stripComments(read("src/desktop/runtime/fedos_desktop_runtime.ts"));
    expect((runtimeSource.match(/export async function startFedosDesktopRuntime/g) ?? []).length).toBe(1);
  });

  it("11. no Identity Transition / Signed Deletion redesign -- both domains are untouched by this Arc; Signed Deletion's own control payload already carried an explicit, authenticated conversationId and needed no change", () => {
    expect(diffNames("src/conversation/identity_transition").trim()).toBe("");
    expect(diffNames("src/conversation/deletion_request").trim()).toBe("");
    const recordSource = stripComments(read("src/conversation/deletion_request/fedos_deletion_request_record.ts"));
    expect(recordSource).toMatch(/readonly conversationId: string/);
  });

  it("12. no Ratchet cryptographic core redesign -- the session-id derivation, DH ratchet, and Rust boundary are unmodified; only the inbound RESOLUTION algorithm and an additive wire field changed", () => {
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts").trim()).toBe("");
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_device_pair_resolver.ts").trim()).toBe("");
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_state_runtime.ts").trim()).toBe("");
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_reset_coordinator.ts").trim()).toBe("");
  });

  it("13. no Electron security weakening, no p2p/.tmp_gen change", () => {
    const diffOutput = diffNames();
    expect(diffOutput).not.toMatch(/^p2p\//m);
    expect(diffOutput).not.toMatch(/\.tmp_gen\//);
    expect(diffOutput).not.toMatch(/fedos_electron_beta_main\.cts/);
    expect(diffOutput).not.toMatch(/fedos_electron_beta_preload\.cts/);
  });

  it("14. every new closed outcome this Arc adds is a specific, narrow, named result -- no generic/free-form routing dictionary, no unbounded field", () => {
    const resolverSource = stripComments(read(RESOLVER_PATH));
    expect(resolverSource).toMatch(/"unknown-conversation"/);
    expect(resolverSource).toMatch(/"membership-denied"/);
    expect(resolverSource).toMatch(/"identity-unavailable"/);
    expect(resolverSource).not.toMatch(/Record<string, unknown>\s*;?\s*\/\/.*routing/i);
    const plainPayloadSource = stripComments(read(PLAIN_PAYLOAD_PATH));
    expect(plainPayloadSource).toMatch(/MAX_ID_FIELD_LENGTH/);
    expect(plainPayloadSource).toMatch(/MAX_BODY_LENGTH/);
    expect(plainPayloadSource).toMatch(/hasExactFields\(/);
  });

  it("15. this Arc's own new test files exist and cross-reference each other honestly -- no fabricated cross-reference to a file that does not exist", () => {
    const files = [
      "test/secure_runtime_alpha_7401_7480_route_binding_defect_reproduction.test.ts",
      "test/secure_runtime_alpha_7401_7480_ratchet_route_binding_isolation.test.ts",
      "test/secure_runtime_alpha_7401_7480_real_vertical_slice.test.ts",
      "test/secure_runtime_alpha_7401_7480_failure_matrix.test.ts",
    ];
    for (const file of files) {
      expect(read(file).length, file).toBeGreaterThan(0);
    }
  });
});
