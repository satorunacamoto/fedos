/**
 * Secure Runtime Alpha 5061-5160 — FedOS Desktop Beta 0.1 — Phase I: the ONE
 * versioned, NON-SECRET user-visible Beta limitations model.
 *
 * The spec requires these truths to be exposed to the user (onboarding /
 * About / Beta status), NOT hidden in docs only. This module is the single
 * source of that text so onboarding, the Beta home surface, and the About
 * screen all render the SAME honest statements.
 *
 * Pure value object: no Runtime, no Electron, no persistence, no secret. Each
 * statement is a closed, non-secret string safe to render verbatim.
 */

/** The CLOSED limitation-id vocabulary (spec Phase I list). */
export type FedosDesktopBetaLimitationId =
  | "beta-software"
  | "local-data-loss"
  | "forgotten-passphrase-unrecoverable"
  | "relay-retains-ciphertext"
  | "public-nostr-is-public"
  | "private-metadata-observable"
  | "local-malware-out-of-scope"
  | "some-settings-need-restart"
  | "unsupported-settings-stored-not-active"
  | "registry-may-not-auto-sync"
  | "delivery-not-guaranteed"
  | "no-automatic-update"
  | "no-recovery-service"
  | "chat-live-update-is-polled"
  | "identity-replacement-evidence-may-be-incomplete"
  | "relay-has-no-automatic-reconnect"
  | "no-guaranteed-memory-erasure";

/** Where in the product this limitation must be surfaced. Closed vocabulary. */
export type FedosDesktopBetaLimitationSurface = "onboarding" | "about" | "beta-status";

export interface FedosDesktopBetaLimitation {
  readonly limitationId: FedosDesktopBetaLimitationId;
  /** Short label. Non-secret. */
  readonly label: string;
  /** One honest, non-secret sentence the user reads verbatim. */
  readonly statement: string;
  /** The surfaces this limitation must appear on. */
  readonly surfaces: readonly FedosDesktopBetaLimitationSurface[];
}

export interface FedosDesktopBetaLimitationsV1 {
  readonly modelVersion: 1;
  readonly limitations: readonly FedosDesktopBetaLimitation[];
}

function lim(l: FedosDesktopBetaLimitation): FedosDesktopBetaLimitation {
  return Object.freeze({ ...l, surfaces: Object.freeze([...l.surfaces]) });
}

const FEDOS_DESKTOP_BETA_LIMITATIONS_V1: FedosDesktopBetaLimitationsV1 = Object.freeze({
  modelVersion: 1,
  limitations: Object.freeze([
    lim({
      limitationId: "beta-software",
      label: "This is Beta software",
      statement: "FedOS Desktop 0.1 is Beta software; behavior and data formats may change before a stable release.",
      surfaces: ["onboarding", "about", "beta-status"],
    }),
    lim({
      limitationId: "local-data-loss",
      label: "Local data can be lost",
      statement: "Your data is stored locally. Without your own backup it can be lost if the device or profile is damaged.",
      surfaces: ["onboarding", "about"],
    }),
    lim({
      limitationId: "forgotten-passphrase-unrecoverable",
      label: "Forgotten passphrase is unrecoverable",
      statement: "There is no passphrase recovery. If you forget your passphrase, the sealed profile cannot be unlocked.",
      surfaces: ["onboarding", "about"],
    }),
    lim({
      limitationId: "relay-retains-ciphertext",
      label: "Relays may retain ciphertext",
      statement: "Relay operators may retain the encrypted messages they relay; encryption protects contents, not their existence.",
      surfaces: ["about", "beta-status"],
    }),
    lim({
      limitationId: "public-nostr-is-public",
      label: "Public Nostr data is public",
      statement: "Anything published to public Nostr is public and cannot be recalled.",
      surfaces: ["about", "beta-status"],
    }),
    lim({
      limitationId: "private-metadata-observable",
      label: "Private messaging metadata may be observable",
      statement: "Private messaging hides contents, but some metadata (such as timing and size) may remain observable to relays.",
      surfaces: ["about", "beta-status"],
    }),
    lim({
      limitationId: "local-malware-out-of-scope",
      label: "Local malware is out of scope",
      statement: "Malware already running on your computer is outside this application's protection boundary.",
      surfaces: ["about"],
    }),
    lim({
      limitationId: "some-settings-need-restart",
      label: "Some settings need a restart",
      statement: "Some settings (relays, default relay, archive directory) only take effect after a confirmed Runtime restart.",
      surfaces: ["about", "beta-status"],
    }),
    lim({
      limitationId: "unsupported-settings-stored-not-active",
      label: "Some settings are stored but not active",
      statement: "Language, auto-start, and auto-lock are stored but not yet applied — no accepted application boundary exists for them in Beta 0.1.",
      surfaces: ["about", "beta-status"],
    }),
    lim({
      limitationId: "registry-may-not-auto-sync",
      label: "Devices may not sync automatically",
      statement: "Cross-device registry state may not synchronize automatically; device pairing and sync may need manual steps.",
      surfaces: ["about", "beta-status"],
    }),
    lim({
      limitationId: "delivery-not-guaranteed",
      label: "Delivery is not guaranteed",
      statement: "Network delivery of messages is best-effort and not guaranteed.",
      surfaces: ["about", "beta-status"],
    }),
    lim({
      limitationId: "no-automatic-update",
      label: "No automatic updates",
      statement: "This Beta does not update itself; you install new versions manually.",
      surfaces: ["about"],
    }),
    lim({
      limitationId: "no-recovery-service",
      label: "No recovery service",
      statement: "There is no cloud account or recovery service; all recovery depends on your own local backups.",
      surfaces: ["onboarding", "about"],
    }),
    // Secure Runtime Alpha 8121-8200 -- two real, disclosed boundaries
    // introduced by the Desktop Beta User-Facing Product UI Completion
    // Arc's own real screens (Alpha 8041-8120), reconciling the
    // release-claims patch plan's own finding that this closed
    // vocabulary under-discloses relative to what the shipped product
    // now actually does.
    lim({
      limitationId: "chat-live-update-is-polled",
      label: "New messages may take a few seconds to appear",
      statement: "An open conversation checks for new messages periodically (about every two seconds), not instantly — this is not a live push connection.",
      surfaces: ["about", "beta-status"],
    }),
    lim({
      limitationId: "identity-replacement-evidence-may-be-incomplete",
      label: "Some Identity Replacement items cannot yet be opened",
      statement: "An Identity Replacement item with no matching known Device evidence is shown but cannot be opened for a decision yet — it is never silently hidden or auto-decided.",
      surfaces: ["about", "beta-status"],
    }),
    // Secure Runtime Alpha 8121-8200 -- Phase L closed-pilot safety
    // controls; both entries reconcile a real finding from this Arc's
    // own external security audit delta / reproducibility review work.
    lim({
      limitationId: "relay-has-no-automatic-reconnect",
      label: "A disconnected Relay does not reconnect on its own",
      statement: "If a Relay connection drops, this Beta does not retry automatically — lock and unlock again to reconnect. The nav bar's own status text always shows current Relay connectivity honestly.",
      surfaces: ["about", "beta-status"],
    }),
    lim({
      limitationId: "no-guaranteed-memory-erasure",
      label: "Locking clears visible content, not guaranteed memory erasure",
      statement: "Locking removes messages, search results, and other content from the screen and from this app's own in-memory state, but does not guarantee the underlying memory pages are erased at the operating-system level.",
      surfaces: ["about", "beta-status"],
    }),
  ]),
});

/** Returns the ONE frozen Beta 0.1 limitations model. */
export function fedosDesktopBetaLimitationsV1(): FedosDesktopBetaLimitationsV1 {
  return FEDOS_DESKTOP_BETA_LIMITATIONS_V1;
}

/** Returns exactly the limitations that must be surfaced on a given surface. */
export function fedosDesktopBetaLimitationsForSurface(
  surface: FedosDesktopBetaLimitationSurface,
): readonly FedosDesktopBetaLimitation[] {
  return Object.freeze(
    FEDOS_DESKTOP_BETA_LIMITATIONS_V1.limitations.filter((l) => l.surfaces.includes(surface)),
  );
}
