import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";

/**
 * FedOS Account and Nostr Identity Rotation V1 review -- security
 * boundary invariants. Verifies the DOCS themselves (this review's own
 * deliverable, not the source tree) hold the required security
 * boundaries: passphrase rotation / Master Seed replacement / account
 * rotation / Nostr rotation / Device rotation are kept distinct; old-key
 * signatures are never claimed sufficient for compromised-old-key
 * rotation; existing Ratchet root/chain keys are never rebound to a new
 * identity; historical signed messages are never rewritten; Archive
 * Restore is never treated as identity trust; peer-advertised rotation
 * is never auto-accepted; rollback/conflict handling is required; local
 * manual verification is preserved; the named architecture/threat-model
 * reviews are referenced; no invented NIP number appears anywhere.
 */

const DOCS_DIR = "docs/reviews/fedos_account_nostr_identity_rotation_v1";

const ALL_DOC_NAMES = [
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

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

function allDocsConcatenated(): string {
  return ALL_DOC_NAMES.map((name) => readDoc(name)).join("\n\n");
}

describe("Security boundary invariants -- passphrase rotation / Master Seed replacement / account / Nostr / Device rotation are kept distinct", () => {
  it("1. 06_rotation_vs_replacement.md and 15_master_seed_replacement.md distinguish all five terms explicitly", () => {
    const rotationVsReplacement = readDoc("06_rotation_vs_replacement.md");
    for (const term of ["Rotation", "Replacement", "Recovery", "Migration", "Alias"]) {
      expect(rotationVsReplacement, term).toMatch(new RegExp(`## ${term}`));
    }
    const masterSeed = readDoc("15_master_seed_replacement.md");
    expect(masterSeed.toLowerCase()).toMatch(/passphrase rotation/);
    expect(masterSeed.toLowerCase()).toMatch(/master seed replacement/);
    expect(masterSeed.toLowerCase()).toMatch(/account identity rotation/);
  });

  it("2. no doc conflates passphrase rotation with account/Nostr identity rotation", () => {
    const masterSeed = readDoc("15_master_seed_replacement.md");
    expect(masterSeed.toLowerCase()).toMatch(/genuinely separate|separate,? low-risk|not bundled/);
  });

  it("3. Device key rotation is distinguished from account/Nostr rotation -- Device replacement is its own model (11), never conflated with 06/18's account-level model", () => {
    const deviceMigration = readDoc("11_device_migration.md");
    expect(deviceMigration).toMatch(/Device/);
    expect(deviceMigration.toLowerCase()).not.toMatch(/device rotation is the same as account rotation/);
  });
});

describe("Security boundary invariants -- old-key signature limitation", () => {
  it("4. no doc claims an old-key signature alone solves/proves safety of a compromised-old-key rotation", () => {
    const all = allDocsConcatenated();
    expect(all).not.toMatch(/old[- ]key signature (alone )?(solves|proves|guarantees) (the )?compromis/i);
    expect(all).not.toMatch(/an old[- ]key signature is sufficient/i);
  });

  it("5. 09_compromised_old_key_problem.md explicitly states an old-key signature cannot distinguish the legitimate owner from an attacker", () => {
    const text = readDoc("09_compromised_old_key_problem.md");
    expect(text.toLowerCase()).toMatch(/indistinguishable from the signature alone|proves nothing/);
    expect(text).toMatch(/attacker/i);
  });

  it("6. Option B (old-key-signed rotation) is explicitly rejected as a compromise-recovery mechanism", () => {
    const text = readDoc("18_option_comparison.md");
    expect(text).toMatch(/B\. Old-key-signed Nostr key rotation/);
    expect(text.toLowerCase()).toMatch(/fails exactly when needed most/);
  });
});

describe("Security boundary invariants -- Ratchet root/chain keys and historical messages", () => {
  it("7. 12_ratchet_session_transition.md explicitly forbids rebinding root/chain keys to a new identity", () => {
    const text = readDoc("12_ratchet_session_transition.md");
    expect(text.toLowerCase()).toMatch(/root\/chain keys to a new identity/);
    expect(text.toLowerCase()).toMatch(/explicitly\s+forbids/);
  });

  it("8. no doc anywhere proposes reusing/rebinding an existing session's root or chain key under a new identity", () => {
    const all = allDocsConcatenated();
    expect(all).not.toMatch(/rebinds? (the )?(existing |live )?root\/?chain keys? to (a |the )?new identity/i);
  });

  it("9. historical signed messages/events are never rewritten -- stated explicitly in 14_archive_history_and_search.md", () => {
    const text = readDoc("14_archive_history_and_search.md");
    expect(text.toLowerCase()).toMatch(/old signatures are not rewritten/);
    expect(text.toLowerCase()).toMatch(/never rewrite/);
  });
});

describe("Security boundary invariants -- Archive Restore is never identity trust", () => {
  it("10. 14_archive_history_and_search.md states Archive Restore cannot establish trust in a new identity", () => {
    const text = readDoc("14_archive_history_and_search.md");
    expect(text.toLowerCase()).toMatch(/archive restore cannot establish trust/);
  });
});

describe("Security boundary invariants -- no auto-accept of peer-advertised rotation", () => {
  it("11. 10_peer_acceptance_and_trust.md states self-declared rotation/replacement is not automatic trust", () => {
    const text = readDoc("10_peer_acceptance_and_trust.md");
    expect(text.toLowerCase()).toMatch(/not automatic trust/);
  });

  it("12. the peer acceptance vocabulary includes rejected/conflicting/stale states -- never a boolean", () => {
    const text = readDoc("10_peer_acceptance_and_trust.md");
    for (const state of ["rejected", "conflicting", "stale", "superseded", "unsupported"]) {
      expect(text).toMatch(new RegExp(`"${state}"`));
    }
  });
});

describe("Security boundary invariants -- rollback/conflict handling required", () => {
  it("13. 17_rollback_downgrade_and_split_brain.md defines monotonic revision, previous-transition reference, and no automatic downgrade", () => {
    const text = readDoc("17_rollback_downgrade_and_split_brain.md");
    expect(text.toLowerCase()).toMatch(/monotonic revision/);
    expect(text.toLowerCase()).toMatch(/previous-transition/);
    expect(text.toLowerCase()).toMatch(/no automatic downgrade/);
  });
});

describe("Security boundary invariants -- local manual verification preserved", () => {
  it("14. manual/out-of-band verification is named as an always-available fallback in 08 and 09", () => {
    for (const name of ["08_old_key_and_new_key_proof.md", "09_compromised_old_key_problem.md"]) {
      const text = readDoc(name);
      expect(text.toLowerCase(), name).toMatch(/manual/);
    }
  });
});

describe("Security boundary invariants -- named architecture/threat-model reviews referenced", () => {
  it("15. 02_security_goals_and_threat_alignment.md references Security Goals, Threat Model, Secure Memory, and Crypto Runtime", () => {
    const text = readDoc("02_security_goals_and_threat_alignment.md");
    expect(text).toMatch(/e4bb0b0/);
    expect(text).toMatch(/406c144/);
    expect(text).toMatch(/d227ae4/);
  });

  it("16. index.md lists all five named architecture/predecessor-review commits", () => {
    const index = readDoc("index.md");
    for (const hash of ["e4bb0b0", "406c144", "d227ae4", "d62090f", "b34d608", "3ebfa37"]) {
      expect(index, hash).toMatch(new RegExp(hash));
    }
  });
});

describe("Security boundary invariants -- no invented NIP number", () => {
  it("17. no doc invents a new NIP number anywhere", () => {
    const all = allDocsConcatenated();
    expect(all).not.toMatch(/NIP-\d{3,}/); // no 3+-digit NIP number (real NIPs referenced elsewhere in this repo are NIP-01/17/44/59, all <= 2 digits)
    expect(all.toLowerCase()).not.toMatch(/propose(s|d)? a new nip/);
  });

  it("18. no doc claims the Nostr ecosystem globally recognizes a FedOS-specific rotation mechanism", () => {
    const all = allDocsConcatenated();
    expect(all.toLowerCase()).not.toMatch(/nostr ecosystem (globally )?recognizes/);
  });
});
