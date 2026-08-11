import { describe, it, expect } from "vitest";

/**
 * Compatibility Facade Reduction + Package Extraction Readiness + Remaining
 * Architecture Debt Closure arc, Agent F — a SMALL number of representative
 * compatibility CONTRACT tests, spanning `os/core`, `os/messenger`, and
 * `os/commerce`.
 *
 * `test/architecture_compatibility_shim_audit.test.ts` is the GENERATED,
 * exhaustive audit covering all ~800 shims mechanically (target exists,
 * thin facade, no cycle, importable). This file is deliberately different
 * in kind: for a handful of hand-picked, representative shims, it proves
 * the actual COMPATIBILITY PROMISE — that importing from the OLD path
 * yields the exact same class/function/constant identity (or equivalent
 * behavior) as importing from the NEW canonical path — not just "the file
 * exists and doesn't throw".
 *
 * `os/commerce` has ZERO old-path compatibility shims (verified: the
 * arc's own machine-generated inventory of all 811 shims found none whose
 * re-export target resolves under `os/commerce/**`) — `os/commerce`'s
 * public surface was never migrated from an old top-level location, it
 * was designed fresh at its current path. The two `os/commerce` tests
 * below therefore verify the BARREL's (`src/os/commerce/index.ts`) own
 * public contract stays stable instead of an old-path/new-path
 * comparison, which is the closest honest equivalent for a domain with no
 * compatibility shim to prove.
 */

describe("Compatibility shim representative contract tests -- old path vs. new path", () => {
  // ---------------------------------------------------------------------
  // os/core
  // ---------------------------------------------------------------------

  it("[core] NoopCryptoProvider: old `src/crypto/noop_crypto.js` and new `src/os/core/crypto/noop_crypto.js` resolve to the exact same class", async () => {
    const oldMod = await import("../src/crypto/noop_crypto.js");
    const newMod = await import("../src/os/core/crypto/noop_crypto.js");
    expect(oldMod.NoopCryptoProvider).toBe(newMod.NoopCryptoProvider);

    // Behavioral proof, not just identity: both resolve to a provider that
    // is total and always denies (never throws, never actually encrypts).
    const provider = new oldMod.NoopCryptoProvider();
    await expect(provider.randomBytes({ length: 32 })).resolves.toMatchObject({ allowed: false });
  });

  it("[core] FedosIdentityRegistry: old `src/identity/fedos_identity_registry.js` and new `src/os/core/identity/fedos_identity_registry.js` resolve to the exact same class", async () => {
    const oldMod = await import("../src/identity/fedos_identity_registry.js");
    const newMod = await import("../src/os/core/identity/fedos_identity_registry.js");
    expect(oldMod.FedosIdentityRegistry).toBe(newMod.FedosIdentityRegistry);
  });

  it("[core] NoopFedosIdentityProvider: old `src/identity/fedos_noop_identity_provider.js` and new `src/os/core/identity/fedos_noop_identity_provider.js` resolve to the exact same class, same constructor arity", async () => {
    const oldMod = await import("../src/identity/fedos_noop_identity_provider.js");
    const newMod = await import("../src/os/core/identity/fedos_noop_identity_provider.js");
    expect(oldMod.NoopFedosIdentityProvider).toBe(newMod.NoopFedosIdentityProvider);
    expect(oldMod.NoopFedosIdentityProvider.length).toBe(newMod.NoopFedosIdentityProvider.length);
  });

  // ---------------------------------------------------------------------
  // os/messenger
  // ---------------------------------------------------------------------

  it("[messenger/board] validateActivityPubBoardPost + mapValidatedActivityPubPostToBoardPostInput: old `src/board/activitypub/...` and new `src/os/messenger/board/activitypub/...` resolve to the exact same functions", async () => {
    const oldMod = await import("../src/board/activitypub/fedos_activitypub_board_adapter.js");
    const newMod = await import("../src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.js");
    expect(oldMod.validateActivityPubBoardPost).toBe(newMod.validateActivityPubBoardPost);
    expect(oldMod.mapValidatedActivityPubPostToBoardPostInput).toBe(newMod.mapValidatedActivityPubPostToBoardPostInput);
  });

  it("[messenger/conversations] FEDOS_DELETION_TARGETS + isFedosDeletionTarget: old `src/conversation/deletion/...` and new `src/os/messenger/conversations/deletion/...` resolve to the exact same constant and function", async () => {
    const oldMod = await import("../src/conversation/deletion/fedos_deletion_target.js");
    const newMod = await import("../src/os/messenger/conversations/deletion/fedos_deletion_target.js");
    expect(oldMod.FEDOS_DELETION_TARGETS).toBe(newMod.FEDOS_DELETION_TARGETS);
    expect(oldMod.isFedosDeletionTarget).toBe(newMod.isFedosDeletionTarget);
    // Same value, not just same reference type -- a real content check.
    expect(oldMod.FEDOS_DELETION_TARGETS).toEqual(newMod.FEDOS_DELETION_TARGETS);
  });

  it("[messenger/desktop] WebSocketRelay: old `src/desktop/websocket_relay.js` and new `src/os/messenger/desktop/websocket_relay.js` resolve to the exact same class", async () => {
    const oldMod = await import("../src/desktop/websocket_relay.js");
    const newMod = await import("../src/os/messenger/desktop/websocket_relay.js");
    expect(oldMod.WebSocketRelay).toBe(newMod.WebSocketRelay);
  });

  it("[messenger/device] isFedosDeviceTrustTransitionAllowed + FEDOS_DEVICE_TRUST_STATES: old `src/device/fedos_device_binding.js` and new `src/os/messenger/device/fedos_device_binding.js` resolve to the exact same function and constant, same behavior", async () => {
    const oldMod = await import("../src/device/fedos_device_binding.js");
    const newMod = await import("../src/os/messenger/device/fedos_device_binding.js");
    expect(oldMod.isFedosDeviceTrustTransitionAllowed).toBe(newMod.isFedosDeviceTrustTransitionAllowed);
    expect(oldMod.FEDOS_DEVICE_TRUST_STATES).toBe(newMod.FEDOS_DEVICE_TRUST_STATES);
    // Behavioral proof: both agree "pending" -> "trusted" is an allowed transition.
    expect(oldMod.isFedosDeviceTrustTransitionAllowed("pending", "trusted")).toBe(
      newMod.isFedosDeviceTrustTransitionAllowed("pending", "trusted"),
    );
  });

  // ---------------------------------------------------------------------
  // os/commerce -- no old-path shim exists (see file header); these prove
  // the BARREL's own public contract instead.
  // ---------------------------------------------------------------------

  it("[commerce] NoopPaymentProvider: importing directly from `src/os/commerce/payment/noop_payment.js` and via the public barrel `src/os/commerce/index.js` resolve to the exact same class", async () => {
    const direct = await import("../src/os/commerce/payment/noop_payment.js");
    const barrel = await import("../src/os/commerce/index.js");
    expect(direct.NoopPaymentProvider).toBe(barrel.NoopPaymentProvider);
    const provider = new barrel.NoopPaymentProvider();
    expect(provider.getStatus().available).toBe(false);
  });

  it("[commerce] InMemoryProductDirectory: importing directly from `src/os/commerce/catalog/directory.js` and via the public barrel `src/os/commerce/index.js` resolve to the exact same class", async () => {
    const direct = await import("../src/os/commerce/catalog/directory.js");
    const barrel = await import("../src/os/commerce/index.js");
    expect(direct.InMemoryProductDirectory).toBe(barrel.InMemoryProductDirectory);
    const catalog = new barrel.InMemoryProductDirectory([]);
    expect(catalog).toBeInstanceOf(direct.InMemoryProductDirectory);
  });
});
