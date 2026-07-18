import { describe, it, expect } from "vitest";
import {
  bindFedosSyncDevice,
  unbindFedosSyncDevice,
  revokeFedosSyncDeviceBinding,
  isFedosSyncDeviceBindingActive,
} from "../src/sync/fedos_sync_device_binding.js";
import { FedosSyncDeviceRegistry } from "../src/sync/fedos_sync_device_registry.js";

describe("Secure Runtime Alpha 2421-2500 -- Device Binding", () => {
  it("binds a device in the 'bound' state, with boundAt fixed and updatedAt following it", () => {
    const binding = bindFedosSyncDevice("dev-A", "acct-1", 100);
    expect(binding).toEqual({ deviceRef: "dev-A", accountRef: "acct-1", state: "bound", boundAt: 100, updatedAt: 100 });
    expect(isFedosSyncDeviceBindingActive(binding)).toBe(true);
  });

  it("unbind/revoke transition state but never mutate boundAt/deviceRef/accountRef", () => {
    const bound = bindFedosSyncDevice("dev-A", "acct-1", 100);
    const unbound = unbindFedosSyncDevice(bound, 200);
    expect(unbound.state).toBe("unbound");
    expect(unbound.boundAt).toBe(100);
    expect(unbound.updatedAt).toBe(200);
    expect(isFedosSyncDeviceBindingActive(unbound)).toBe(false);

    const revoked = revokeFedosSyncDeviceBinding(bound, 300);
    expect(revoked.state).toBe("revoked");
    expect(revoked.boundAt).toBe(100);
    expect(isFedosSyncDeviceBindingActive(revoked)).toBe(false);
  });

  it("never mutates its input binding (pure functions)", () => {
    const bound = bindFedosSyncDevice("dev-A", "acct-1", 100);
    const frozen = { ...bound };
    unbindFedosSyncDevice(bound, 200);
    expect(bound).toEqual(frozen);
  });
});

describe("Secure Runtime Alpha 2421-2500 -- Device Registry", () => {
  it("registers a brand-new device", () => {
    const registry = new FedosSyncDeviceRegistry();
    expect(registry.registerDevice("dev-A", "acct-1", 100)).toBe("registered");
    expect(registry.getDevice("dev-A", "acct-1")?.state).toBe("bound");
  });

  it("re-registering an already-bound device is idempotent", () => {
    const registry = new FedosSyncDeviceRegistry();
    registry.registerDevice("dev-A", "acct-1", 100);
    expect(registry.registerDevice("dev-A", "acct-1", 150)).toBe("already-registered");
    expect(registry.getDevice("dev-A", "acct-1")?.boundAt).toBe(100);
  });

  it("re-registering a revoked device rebinds it", () => {
    const registry = new FedosSyncDeviceRegistry();
    registry.registerDevice("dev-A", "acct-1", 100);
    expect(registry.revokeDevice("dev-A", "acct-1", 200)).toBe(true);
    expect(registry.getDevice("dev-A", "acct-1")?.state).toBe("revoked");
    expect(registry.registerDevice("dev-A", "acct-1", 300)).toBe("registered");
    expect(registry.getDevice("dev-A", "acct-1")?.state).toBe("bound");
  });

  it("registering the same deviceRef under a DIFFERENT account is a conflict, and mutates nothing", () => {
    const registry = new FedosSyncDeviceRegistry();
    registry.registerDevice("dev-A", "acct-1", 100);
    expect(registry.registerDevice("dev-A", "acct-2", 150)).toBe("conflict");
    expect(registry.getDevice("dev-A", "acct-2")).toBeNull();
    expect(registry.getDevice("dev-A", "acct-1")?.accountRef).toBe("acct-1");
  });

  it("revokeDevice reports false for an unknown device or an already-revoked one, never throws", () => {
    const registry = new FedosSyncDeviceRegistry();
    expect(registry.revokeDevice("dev-ghost", "acct-1", 100)).toBe(false);
    registry.registerDevice("dev-A", "acct-1", 100);
    registry.revokeDevice("dev-A", "acct-1", 200);
    expect(registry.revokeDevice("dev-A", "acct-1", 300)).toBe(false);
  });

  it("listDevices/listActiveDevices reflect exactly the bound-vs-revoked distinction", () => {
    const registry = new FedosSyncDeviceRegistry();
    registry.registerDevice("dev-A", "acct-1", 100);
    registry.registerDevice("dev-B", "acct-1", 100);
    registry.registerDevice("dev-C", "acct-1", 100);
    registry.revokeDevice("dev-B", "acct-1", 200);

    expect(registry.listDevices("acct-1").length).toBe(3);
    expect(registry.listActiveDevices("acct-1").map((d) => d.deviceRef).sort()).toEqual(["dev-A", "dev-C"]);
  });

  it("independent registry instances never share state", () => {
    const a = new FedosSyncDeviceRegistry();
    const b = new FedosSyncDeviceRegistry();
    a.registerDevice("dev-A", "acct-1", 100);
    expect(b.getDevice("dev-A", "acct-1")).toBeNull();
  });
});
