import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_330_durable_backend_selection_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrAdapterSource from "../src/board/fedos_board_nostr_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activityPubAdapterSource from "../src/board/activitypub/fedos_activitypub_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import atprotoAdapterSource from "../src/board/atproto/fedos_atproto_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionAdapterSource from "../src/board/session/fedos_session_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistencePortSource from "../src/board/persistence/fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import inMemoryPersistenceSource from "../src/board/persistence/in_memory_fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistedRepositorySource from "../src/board/persistence/persisted_fedos_board_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/board/persistence/fedos_board_hydration.ts?raw";

import * as recordModule from "../src/board/persistence/fedos_persisted_board_post_v1.js";
import * as codecModule from "../src/board/persistence/fedos_board_post_codec.js";
import * as portModule from "../src/board/persistence/fedos_board_persistence.js";
import * as inMemoryPersistenceModule from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import * as persistedRepositoryModule from "../src/board/persistence/persisted_fedos_board_repository.js";
import * as hydrationModule from "../src/board/persistence/fedos_board_hydration.js";
import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";
import { FedosBoardFeed } from "../src/board/repository/fedos_board_feed.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

/**
 * Secure Runtime Alpha 330 -- "Durable Backend Selection Completion":
 * Stage 10, the closing Stage, of the Alpha 321-330 Board Durable
 * Backend Selection & Architecture Arc. Review only. Issues the Arc's
 * own Completion Declaration, confirms the Alpha 311-320 persistence
 * boundary this Arc built no code atop of remains fully functional and
 * untouched, and recommends exactly one next Arc: Desktop Host Runtime
 * Foundation, not Ontology integration.
 */
describe("Secure Runtime Alpha 330 -- Durable Backend Selection Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(designDocSource).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\.\*\*/);
  });

  it("3. the design doc recommends exactly one next Arc: Desktop Host Runtime Foundation, and explicitly not Ontology integration", () => {
    expect(designDocSource).toMatch(/\*\*Desktop Host Runtime Foundation Arc\.\*\*/);
    expect(designDocSource).toMatch(/\*\*Ontology integration is explicitly NOT the next recommended Arc\*\*/);
  });

  it("4. the persistence boundary this Arc reviewed (but did not modify) is still fully functional end to end", () => {
    const input: FedosBoardPostInput = {
      id: "post-330-completion",
      boardId: "board-330-completion",
      threadId: "post-330-completion",
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
      body: "Alpha 330 completion check",
      createdAt: 1_700_001_000,
      source: { protocol: "nostr", reference: "completion-ref-330" },
    };
    const post = validateFedosBoardPost(input)!;

    const persistence = new inMemoryPersistenceModule.InMemoryFedosBoardPersistence();
    expect(persistence.putPost(codecModule.serializeFedosBoardPost(post))).toBe("inserted");

    const result = hydrationModule.hydrateFedosBoardService(persistence);
    expect(result.outcome).toBe("hydrated");

    const feed = new FedosBoardFeed(result.service!);
    expect(feed.listRecentPosts(post.boardId, 10).map((p) => p.id)).toEqual([post.id]);

    const repository = new persistedRepositoryModule.PersistedFedosBoardRepository(persistence);
    expect(repository.findPost(post.id)?.id).toBe(post.id);
  });

  it("5. every production module this Arc reviewed still exports the symbols Alpha 313-318 already froze", () => {
    expect(typeof codecModule.serializeFedosBoardPost).toBe("function");
    expect(typeof codecModule.deserializeFedosBoardPost).toBe("function");
    expect(typeof portModule.fedosPersistedBoardPostRecordsAreEqual).toBe("function");
    expect(typeof inMemoryPersistenceModule.InMemoryFedosBoardPersistence).toBe("function");
    expect(typeof persistedRepositoryModule.PersistedFedosBoardRepository).toBe("function");
    expect(typeof hydrationModule.hydrateFedosBoardService).toBe("function");
    expect(recordModule).toBeDefined();
  });

  it("6. Regression: package.json dependency count remains unchanged at 2 across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("7. Regression: Relay, Runtime, and Worker carry zero reference to src/board/persistence/", () => {
    for (const source of [relaySource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(
        /src\/board\/persistence\/|FedosBoardPersistence|InMemoryFedosBoardPersistence|PersistedFedosBoardRepository|hydrateFedosBoardService/,
      );
    }
  });

  it("8. Regression: none of the four Board Adapters has functional coupling to the Persistence boundary", () => {
    for (const source of [nostrAdapterSource, activityPubAdapterSource, atprotoAdapterSource, sessionAdapterSource]) {
      expect(source).not.toMatch(/from ["'].*\/persistence\/.*["']/i);
      expect(source).not.toMatch(
        /FedosBoardPersistence|InMemoryFedosBoardPersistence|PersistedFedosBoardRepository|hydrateFedosBoardService|FedosPersistedBoardPostRecordV1/,
      );
    }
  });

  it("9. Regression: this Arc left the persistence boundary's own files byte-identical in symbol shape to Alpha 313-318", () => {
    expect(persistencePortSource).toMatch(/export interface FedosBoardPersistence \{/);
    expect(inMemoryPersistenceSource).toMatch(/export class InMemoryFedosBoardPersistence implements FedosBoardPersistence \{/);
    expect(hydrationSource).toMatch(/export function hydrateFedosBoardService/);
  });

  it("10. the design doc's own 'still out of scope' section names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "Ontology integration",
      "SQLite/IndexedDB/D1/filesystem implementation",
      "New dependency of any kind",
      "Protocol adapter changes, Board model changes, Board repository",
      "Runtime, Desktop, Worker, Storage, Observation, GUI, Relay Pool",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("11. the design doc cross-references every prior Stage of this Arc, Alpha 321 through Alpha 329, plus Alpha 320", () => {
    for (let n = 321; n <= 329; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
    expect(designDocSource).toContain("secure_runtime_alpha_320_board_persistence_completion");
  });
});
