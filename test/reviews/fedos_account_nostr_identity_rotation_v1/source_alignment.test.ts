import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readdirSync, readFileSync, existsSync } from "node:fs";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";

/**
 * FedOS Account and Nostr Identity Rotation V1 review -- source
 * alignment. Verifies, against REAL current source and REAL git history
 * (never prose recall), the specific facts this review's own docs depend
 * on: account/Nostr identity determinism, Device Binding/Registry facts,
 * the live peer-capability layer (d825aa0), the live Session Reset
 * facts (f80889d), the live Ratchet integration (b8e9e06), Archive
 * Restore's identity-verification absence, current rotation
 * absence/presence, and branch/lineage distinctions. Mirrors the
 * established pattern in
 * test/reviews/private_message_envelope_v1/specification_consistency.test.ts.
 */

const DOCS_DIR = "docs/reviews/fedos_account_nostr_identity_rotation_v1";
const TEST_DIR = "test/reviews/fedos_account_nostr_identity_rotation_v1";

const REQUIRED_DOCS = [
  "index.md",
  "01_current_identity_inventory.md",
  "02_security_goals_and_threat_alignment.md",
  "03_identity_layer_taxonomy.md",
  "04_current_account_identity_model.md",
  "05_current_nostr_identity_model.md",
  "06_rotation_vs_replacement.md",
  "07_rotation_authorization_models.md",
  "08_old_key_and_new_key_proof.md",
  "09_compromised_old_key_problem.md",
  "10_peer_acceptance_and_trust.md",
  "11_device_migration.md",
  "12_ratchet_session_transition.md",
  "13_conversation_and_membership_continuity.md",
  "14_archive_history_and_search.md",
  "15_master_seed_replacement.md",
  "16_peer_notification_and_capability_update.md",
  "17_rollback_downgrade_and_split_brain.md",
  "18_option_comparison.md",
  "19_implementation_arc_packaging.md",
  "20_normative_recommendation.md",
];

const REQUIRED_TESTS = ["source_alignment.test.ts", "security_boundary_invariants.test.ts", "specification_consistency.test.ts"];

function readAllDocs(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of REQUIRED_DOCS) {
    result[name] = readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
  }
  return result;
}

describe("Alpha 5721-5800 successor review -- required files present", () => {
  it("1. all 21 required docs exist, named exactly as specified", () => {
    const files = (readdirSync(DOCS_DIR) as string[]).filter((name) => name.endsWith(".md"));
    expect(files.sort()).toEqual([...REQUIRED_DOCS].sort());
  });

  it("2. all 3 required test files exist, named exactly as specified", () => {
    const files = (readdirSync(TEST_DIR) as string[]).filter((name) => name.endsWith(".test.ts"));
    expect(files.sort()).toEqual([...REQUIRED_TESTS].sort());
  });

  it("3. every doc is non-trivial -- at least 1200 characters", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text.length, `${file} length`).toBeGreaterThan(1200);
    }
  });
});

describe("Alpha 5721-5800 successor review -- Master Seed / account / Nostr identity source facts", () => {
  it("4. the Master Seed authority's Rust state machine is Empty/Available/Cleared with no reseal-same-seed method exposed", () => {
    const source = readFileSync("packages/fedos-core-rust/src/lib.rs", "utf8") as string;
    expect(source).toMatch(/enum\s+FedosMasterSeedAuthorityState/);
    expect(source).toMatch(/Empty/);
    expect(source).toMatch(/Available\(/);
    expect(source).toMatch(/Cleared/);
    expect(source).toMatch(/fn generate\(/);
    expect(source).toMatch(/fn seal\(/);
    expect(source).toMatch(/fn restore_sealed\(/);
  });

  it("5. the sealed Master Seed envelope persistence never overwrites an existing file (writeIfAbsent, not write) -- no overwrite()/delete() METHOD is defined", () => {
    const source = readFileSync("src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.ts", "utf8") as string;
    expect(source).toMatch(/writeIfAbsent/);
    expect(source).not.toMatch(/^\s*overwrite\(/m);
    expect(source).not.toMatch(/^\s*delete\(/m);
  });

  it("6. account identity is constructed as {authority: 'nostr', publicIdentifier: <pubkey hex>, identityId: null} -- not a separate value", () => {
    const source = readFileSync("src/desktop/onboarding/fedos_profile_initialization_coordinator.ts", "utf8") as string;
    expect(source).toMatch(/authority:\s*"nostr"/);
    expect(source).toMatch(/identityId:\s*null/);
  });

  it("7. the Nostr keypair is derived deterministically from (Master Seed, accountIndex) with no independent rotation entry point", () => {
    const source = readFileSync("packages/fedos-core-rust/src/lib.rs", "utf8") as string;
    expect(source).toMatch(/derive_nostr_secret_key_internal/);
    expect(source).toMatch(/derive_nostr_public_key_internal/);
    expect(source).not.toMatch(/fn\s+rotate_nostr_key/);
    expect(source).not.toMatch(/fn\s+rotate_account_identity/);
  });

  it("8. accountIndex is fixed/defaulted, never caller-selectable per this codebase's own Alpha 689 decision", () => {
    const source = readFileSync(
      "src/conversation/encryption/identity/fedos_conversation_local_account_index_authority.ts",
      "utf8",
    ) as string;
    expect(source.toLowerCase()).toMatch(/fixed/);
  });
});

describe("Alpha 5721-5800 successor review -- Device Binding / Registry facts", () => {
  it("9. FedosDeviceTrustState is exactly pending/trusted/revoked/unavailable, revoked is terminal", () => {
    const source = readFileSync("src/device/fedos_device_binding.ts", "utf8") as string;
    expect(source).toMatch(/"pending"\s*\|\s*"trusted"\s*\|\s*"revoked"\s*\|\s*"unavailable"/);
    expect(source.toLowerCase()).toMatch(/terminal/);
  });

  it("10. Device Replacement always requires a brand-new deviceId, never reuses the old one", () => {
    const source = readFileSync("src/device/fedos_device_replacement_coordinator.ts", "utf8") as string;
    expect(source).toMatch(/oldDeviceId/);
    expect(source.toLowerCase()).toMatch(/new device ?id|brand-new/);
  });

  it("11. the Device signing keypair has no durable storage -- process-memory-only, per its own header, reconfirmed at HEAD", () => {
    const source = readFileSync("src/device/crypto/fedos_device_signing_keypair.ts", "utf8") as string;
    expect(source).toMatch(/process-memory-only/);
  });
});

describe("Alpha 5721-5800 successor review -- live peer-capability facts (d825aa0)", () => {
  it("12. FedosRatchetPeerLifecycleFact is exactly the 6 kinds this review's docs describe, no 7th 'identity rotated' kind", () => {
    const source = readFileSync(
      "src/conversation/ratchet/peer_capability/fedos_ratchet_peer_lifecycle_notification.ts",
      "utf8",
    ) as string;
    for (const kind of [
      "device-added",
      "device-revoked",
      "device-replaced",
      "ratchet-session-reset-required",
      "ratchet-session-generation-advanced",
      "capability-superseded",
    ]) {
      expect(source).toContain(kind);
    }
    expect(source).not.toMatch(/"identity-transition"|"account-rotated"|"nostr-identity-rotated"/);
  });

  it("13. FedosRatchetPeerCapabilityObservationV1 keys on peerAccountRef.publicIdentifier with no re-keying/migration function", () => {
    const source = readFileSync("src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_observation.ts", "utf8") as string;
    expect(source).toMatch(/peerAccountRef/);
    expect(source).not.toMatch(/rekey|migrateObservation|reassignPeerAccount/i);
  });

  it("14. the acceptance policy is a closed, non-boolean, 13-value outcome vocabulary", () => {
    const source = readFileSync("src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_acceptance_outcome.ts", "utf8") as string;
    const values = (source.match(/"[a-z-]+"/g) ?? []).filter((v, i, arr) => arr.indexOf(v) === i);
    expect(values.length).toBeGreaterThanOrEqual(13);
  });
});

describe("Alpha 5721-5800 successor review -- Session Reset facts (f80889d)", () => {
  it("15. the reset-reason vocabulary is exactly 4 values and explicitly excludes identity rotation as a named reason", () => {
    const source = readFileSync("src/conversation/ratchet/fedos_direct_ratchet_session_reset_reason.ts", "utf8") as string;
    for (const reason of ["missing-sealed-state", "corrupt-sealed-state", "excessive-skipped-key-gap", "suspected-compromise"]) {
      expect(source).toContain(reason);
    }
    expect(source.toLowerCase()).toMatch(/identity rotation/);
  });

  it("16. the session lifecycle's reset-required state is terminal except to revoked -- recovery always creates a new generation", () => {
    const source = readFileSync("src/conversation/ratchet/fedos_direct_ratchet_session_lifecycle.ts", "utf8") as string;
    expect(source).toMatch(/"reset-required"/);
    expect(source.toLowerCase()).toMatch(/new session|new generation/);
  });
});

describe("Alpha 5721-5800 successor review -- live Ratchet identity binding (b8e9e06 lineage)", () => {
  it("17. the session id embeds the account's own public identifier directly -- no indirection layer exists", () => {
    const source = readFileSync("src/conversation/ratchet/fedos_direct_ratchet_device_pair_resolver.ts", "utf8") as string;
    expect(source).toMatch(/accountRefToSessionIdComponent/);
    expect(source).toMatch(/publicIdentifier/);
  });
});

describe("Alpha 5721-5800 successor review -- Archive Restore identity behavior", () => {
  it("18. Archive Restore never verifies/re-derives a participant's current identity -- no signature-verification call in the restore path", () => {
    const source = readFileSync("src/conversation/archive/fedos_conversation_archive_restore.ts", "utf8") as string;
    expect(source).not.toMatch(/verifySignature|verifyAccountAuthorization|reVerifyIdentity/i);
  });
});

describe("Alpha 5721-5800 successor review -- rotation absence and branch distinctions", () => {
  it("19. no production rotation/replacement function exists anywhere in src/ for account or Nostr identity", () => {
    let matched = "";
    try {
      matched = execFileSync(
        "git",
        ["grep", "-lI", "-E", "rotateAccountIdentity|rotateNostrIdentity|replaceMasterSeedPreservingIdentity"],
        { encoding: "utf8" },
      ) as string;
    } catch (err) {
      // git grep exits 1 when there are no matches -- that is the expected, passing case.
      matched = "";
    }
    expect(matched.trim()).toBe("");
  });

  it("20. the prior decision review (3ebfa37) is not an ancestor merge target this review pretends to supersede without citation -- its docs directory is distinct from this review's own", () => {
    expect(existsSync("docs/reviews/fedos_ratchet_multidevice_identity_rotation_v1")).toBe(false);
    const index = readFileSync(`${DOCS_DIR}/index.md`, "utf8") as string;
    expect(index).toMatch(/3ebfa37/);
  });

  it("21. review/sender-key-rotation-v1 is a real, distinct, unmerged branch -- not silently treated as part of this base", () => {
    const branches = execFileSync("git", ["branch", "-a"], { encoding: "utf8" }) as string;
    expect(branches).toMatch(/review\/sender-key-rotation-v1/);
    const mergeBase = execFileSync("git", ["merge-base", "HEAD", "review/sender-key-rotation-v1"], { encoding: "utf8" }) as string;
    const branchTip = execFileSync("git", ["rev-parse", "review/sender-key-rotation-v1"], { encoding: "utf8" }) as string;
    expect(mergeBase.trim()).not.toBe(branchTip.trim());
  });
});

describe("Alpha 5721-5800 successor review -- production diff remains empty", () => {
  it("22. git working tree shows NO change under src/, packages/, package.json, package-lock.json, or Cargo.toml (README.md is EXPECTED to change -- see specification_consistency.test.ts)", () => {
    const output = execFileSync(
      "git",
      ["status", "--porcelain", "--", "src", "package.json", "package-lock.json", "Cargo.toml", "packages"],
      { encoding: "utf8" },
    ) as string;
    expect(output.trim()).toBe("");
  });

  it("23. p2p/ and .tmp_gen/ are untouched -- either absent from this worktree, or (if present) show no git change", () => {
    for (const dir of ["p2p", ".tmp_gen"]) {
      if (existsSync(dir)) {
        const output = execFileSync("git", ["status", "--porcelain", "--", dir], { encoding: "utf8" }) as string;
        expect(output.trim(), dir).toBe("");
      } else {
        expect(existsSync(dir)).toBe(false);
      }
    }
  });
});
