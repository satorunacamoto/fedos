// Secure Runtime Alpha 5321-5400 -- Phase H: the ONE closed Beta tag
// format. Pure validation only -- this Arc creates no real tag (a LOCAL,
// TEMPORARY test tag may be used only to exercise this validator, then
// deleted before commit, per this Arc's own instruction).

/** `fedos-desktop-v<major>.<minor>.<patch>-beta.<N>` -- matches the accepted product version literal's own `-beta.N` shape (`fedos_desktop_beta_release_configuration.ts`). */
export const FEDOS_BETA_TAG_PATTERN = /^fedos-desktop-v(\d+\.\d+\.\d+-beta\.\d+)$/;

/** Derives the expected tag string for a given product version (e.g. `"0.1.0-beta.1"` -> `"fedos-desktop-v0.1.0-beta.1"`). */
export function fedosBetaTagForVersion(productVersion) {
  return `fedos-desktop-v${productVersion}`;
}

/**
 * Validates a candidate tag string against the closed format AND (when
 * `expectedProductVersion` is supplied) against the exact current release
 * version -- a tag naming a DIFFERENT version than the release actually
 * being published is rejected (Phase H "version agreement checks"), never
 * silently accepted.
 */
export function validateFedosBetaTagFormat(tag, expectedProductVersion) {
  const match = FEDOS_BETA_TAG_PATTERN.exec(tag);
  if (match === null) {
    return { ok: false, problem: { kind: "malformed-tag-format", tag } };
  }
  if (typeof expectedProductVersion === "string" && match[1] !== expectedProductVersion) {
    return { ok: false, problem: { kind: "version-mismatch", tag, tagVersion: match[1], expectedProductVersion } };
  }
  return { ok: true, problem: null };
}

/**
 * Phase H policy, restated as closed, testable facts (no git operation
 * performed here):
 *   - annotated tags only (`git tag -a`), never lightweight -- an
 *     annotated tag carries its own tagger identity + message, a real
 *     record of WHO cut the release and WHY, unlike a lightweight tag.
 *   - tag target: the exact release commit used to build the artifacts
 *     (never a branch tip that could move after tagging).
 *   - dirty-tree prohibition: a tag must never be created against an
 *     uncommitted working tree (mirrors `resolveFedosBetaReleaseIdentity`'s
 *     own "dirty-tree public release artifacts are forbidden").
 *   - retagging prohibition: an EXISTING tag name is never force-moved to
 *     a new commit -- a corrected release gets a NEW version/tag, the old
 *     tag is marked `"superseded"` (see `revocation_status.mjs`), never
 *     silently repointed (a moved tag is indistinguishable from a
 *     supply-chain attack to anyone who already fetched it).
 *   - revoked-release behavior: the tag itself is NEVER deleted (deleting
 *     a public tag breaks anyone who already fetched it and looks like
 *     evidence-destruction); the accompanying revocation-status record
 *     (`revocation_status.mjs`) is what communicates the revocation.
 *   - replacement-release behavior: a NEW tag/version is cut; the
 *     superseded record's own `replacementVersion` field names it.
 */
export const FEDOS_BETA_TAG_POLICY = Object.freeze({
  tagKind: "annotated",
  tagTarget: "exact-release-commit",
  dirtyTreeAllowed: false,
  allowRetagging: false,
  onRevocation: "keep-tag-publish-advisory",
  onReplacement: "new-tag-new-version",
});
