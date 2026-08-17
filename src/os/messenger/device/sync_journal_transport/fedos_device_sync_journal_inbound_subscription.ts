/**
 * Own-Device Sync Protocol Final Closure arc — the Journal Batch Inbound
 * Subscription. Mirrors
 * `../archive_suppression_sync/fedos_archive_suppression_inbound_subscription.ts`'s
 * own established idiom EXACTLY (one `FedosRelay.subscribe()` call per
 * Relay in a `FedosConversationRelaySet`, one `onSubscriptionMessage`
 * listener per Relay, `stop()` unsubscribes best-effort from every Relay it
 * opened) — a NEW, small, Sync-Journal-scoped copy of that idiom, not a
 * modification of the Archive Suppression file and not a shared/
 * generalized class, matching this codebase's own "new parallel
 * implementation per domain" discipline.
 *
 * Server-side filter is `kinds: [1]` ONLY (no server-side tag filter
 * anywhere in this repository's Relay boundary) — every other check
 * (marker tag, signature, recipient, account, expiry, source/target Device
 * trust, content-hash binding) happens inside
 * `FedosDeviceSyncJournalInboundHandler.handleIncomingEvent()` itself,
 * unmodified by this file.
 *
 * The ONE thing this file adds beyond the Archive Suppression template: a
 * successful `"imported"` result stages entries into the LOCAL device's
 * own Pending Changes queue (`FedosDeviceSyncJournalInboundHandler`'s own
 * header: "`applyPendingChanges()` remains the caller's own
 * responsibility") but does not itself apply them — this file calls
 * `syncState.applyPendingChanges(localDeviceId, now)` immediately after,
 * mirroring `FedosDeviceSyncImportCoordinator`'s own "post-processing
 * enrichment over an existing apply call" shape one level up, so a real
 * inbound delivery converges into this device's own conversation state
 * without a separate caller having to remember to do so.
 *
 * HARD GUARDRAILS:
 *   - No Relay Pool, no reconnect logic, no new `FedosRelay` implementation.
 *   - `start()` may only be called once per instance — a second call
 *     throws, matching this repository's own established convention.
 *   - `stop()` unsubscribes from every Relay it opened a subscription on;
 *     one Relay's own failure to unsubscribe cleanly never blocks another.
 */

import type { FedosConversationRelaySet } from "../../adapters/nostr/transport/relay/fedos_conversation_relay_set.js";
import type { FedosSubscription } from "../../desktop/fedos_subscription.js";
import { nostrWireEventToFedosEventDescriptor } from "../../board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.js";
import type { FedosDeviceSyncJournalInboundHandler } from "./fedos_device_sync_journal_inbound_handler.js";
import type { FedosDeviceSyncJournalPackageEncryptionAuthority } from "./fedos_device_sync_journal_package_encryption.js";
import type { FedosSyncState, FedosSyncApplyResult } from "../../sync/fedos_sync_state.js";
import type { AeadAlgorithm } from "../../../core/vault/wasm/fedos_wasm_loader.js";

const DEVICE_SYNC_JOURNAL_SUBSCRIPTION_KIND = 1;

interface OpenSubscription {
  readonly relayIndex: number;
  readonly subscription: FedosSubscription;
}

export interface FedosDeviceSyncJournalInboundSubscriptionDeps {
  readonly relaySet: FedosConversationRelaySet;
  readonly handler: FedosDeviceSyncJournalInboundHandler;
  readonly syncState: FedosSyncState;
  readonly encryptionAuthority: FedosDeviceSyncJournalPackageEncryptionAuthority;
  readonly suite: AeadAlgorithm;
  readonly localAccountIndex: number;
  readonly selfAccountPublicKeyHex: string;
  readonly localDeviceId: string;
  readonly now?: () => number;
  /**
   * OPTIONAL, test-injection only -- mirrors this repository's own
   * established "an unset caller-injection point never changes real
   * production behavior" discipline (e.g.
   * `FedosDesktopRuntimeConfig.directRatchetMessageDeliveryRemoteDeviceRef`).
   * `fedos_electron_beta_main.cts` never sets this. The auto-apply this
   * class already performs after every successful `"imported"` delivery
   * (see this file's own header) has no other observable return value --
   * without this hook, a caller/test has no way to see WHICH conflict
   * classification (if any) a given real-time delivery actually received.
   */
  readonly onApplied?: (results: readonly FedosSyncApplyResult[]) => void;
}

export class FedosDeviceSyncJournalInboundSubscription {
  readonly #deps: FedosDeviceSyncJournalInboundSubscriptionDeps;
  readonly #now: () => number;
  #open: readonly OpenSubscription[] | null = null;

  constructor(deps: FedosDeviceSyncJournalInboundSubscriptionDeps) {
    this.#deps = deps;
    this.#now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  }

  isRunning(): boolean {
    return this.#open !== null;
  }

  async start(): Promise<void> {
    if (this.#open !== null) {
      throw new Error("FedosDeviceSyncJournalInboundSubscription.start() may only be called from the stopped state.");
    }

    const relays = this.#deps.relaySet.relays;
    const opened: OpenSubscription[] = [];
    for (let relayIndex = 0; relayIndex < relays.length; relayIndex += 1) {
      const relay = relays[relayIndex]!;
      // Mirrors the Archive Suppression Inbound Subscription's own fix exactly: `relay.subscribe()`
      // throws for a relay that never actually connected, which would otherwise crash this whole
      // subscription's own `start()` for one unreachable relay in the set.
      if (!relay.isConnected()) continue;
      const subscription = await relay.subscribe([{ kinds: [DEVICE_SYNC_JOURNAL_SUBSCRIPTION_KIND] }]);
      relay.onSubscriptionMessage(subscription, (message) => {
        if (message.kind !== "event") return;
        const descriptor = nostrWireEventToFedosEventDescriptor(message.event);
        void this.#handleIncoming(descriptor);
      });
      opened.push({ relayIndex, subscription });
    }
    this.#open = opened;
  }

  async #handleIncoming(descriptor: ReturnType<typeof nostrWireEventToFedosEventDescriptor>): Promise<void> {
    const now = this.#now();
    const result = await this.#deps.handler.handleIncomingEvent({
      descriptor,
      encryptionAuthority: this.#deps.encryptionAuthority,
      suite: this.#deps.suite,
      localAccountIndex: this.#deps.localAccountIndex,
      selfAccountPublicKeyHex: this.#deps.selfAccountPublicKeyHex,
      now,
    });
    if (result.outcome === "imported") {
      const applyResults = this.#deps.syncState.applyPendingChanges(this.#deps.localDeviceId, now);
      this.#deps.onApplied?.(applyResults);
    }
  }

  async stop(): Promise<void> {
    if (this.#open === null) return;
    const open = this.#open;
    this.#open = null;

    const relays = this.#deps.relaySet.relays;
    await Promise.all(
      open.map(async ({ relayIndex, subscription }) => {
        const relay = relays[relayIndex];
        if (relay === undefined) return;
        try {
          await relay.unsubscribe(subscription);
        } catch {
          // Best-effort -- a relay that fails to unsubscribe cleanly never blocks the others.
        }
      }),
    );
  }
}
