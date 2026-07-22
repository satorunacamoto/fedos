/**
 * Secure Runtime Alpha 4581–4660 ("Desktop Device Registration, Pairing, and
 * Durable Sync Journal Arc") — Phase I: Device Pairing ViewModel.
 *
 * Wraps `FedosDesktopApplicationShell.devicePairingCreate()`/
 * `devicePairingsList()`/`devicePairingInspect()`/`devicePairingApprove()`/
 * `devicePairingComplete()`/`deviceRevoke()`/`deviceRegistrationStatus()`
 * ONLY — owns no cryptographic implementation or Registry logic of its own.
 * Mirrors `FedosDesktopDeviceInventoryViewModel`'s own exact "thin
 * Shell-wrapping state holder" shape (Alpha 3801-3880) — this file is the
 * SEVENTH such ViewModel, following the SAME pattern the other six already
 * established.
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type {
  FedosDevicePairingApprovalOutcomeView,
  FedosDevicePairingBindingView,
  FedosDevicePairingRequestInspectionView,
  FedosDevicePairingRequestSummary,
} from "../runtime/fedos_device_pairing_facade.js";
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopDevicePairingViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #createdState: FedosDesktopViewModelState<{ readonly pairingId: string; readonly encoded: string }> = fedosViewModelIdle();
  #pendingListState: FedosDesktopViewModelState<readonly FedosDevicePairingRequestSummary[]> = fedosViewModelIdle();
  #inspectionState: FedosDesktopViewModelState<FedosDevicePairingRequestInspectionView> = fedosViewModelIdle();
  #approvalState: FedosDesktopViewModelState<FedosDevicePairingApprovalOutcomeView> = fedosViewModelIdle();
  #completionState: FedosDesktopViewModelState<FedosDevicePairingBindingView> = fedosViewModelIdle();
  #revocationState: FedosDesktopViewModelState<FedosDevicePairingBindingView> = fedosViewModelIdle();
  #statusState: FedosDesktopViewModelState<FedosDevicePairingBindingView> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get createdState(): FedosDesktopViewModelState<{ readonly pairingId: string; readonly encoded: string }> {
    return this.#createdState;
  }
  get pendingListState(): FedosDesktopViewModelState<readonly FedosDevicePairingRequestSummary[]> {
    return this.#pendingListState;
  }
  get inspectionState(): FedosDesktopViewModelState<FedosDevicePairingRequestInspectionView> {
    return this.#inspectionState;
  }
  get approvalState(): FedosDesktopViewModelState<FedosDevicePairingApprovalOutcomeView> {
    return this.#approvalState;
  }
  get completionState(): FedosDesktopViewModelState<FedosDevicePairingBindingView> {
    return this.#completionState;
  }
  get revocationState(): FedosDesktopViewModelState<FedosDevicePairingBindingView> {
    return this.#revocationState;
  }
  get statusState(): FedosDesktopViewModelState<FedosDevicePairingBindingView> {
    return this.#statusState;
  }

  async createPairingRequest(deviceId: string, expectedAccountRef: FedosDeviceBindingAccountRef): Promise<FedosDesktopViewModelState<{ readonly pairingId: string; readonly encoded: string }>> {
    this.#createdState = fedosViewModelLoading();
    this.#createdState = fedosViewModelFromShellResult(this.#shell.devicePairingCreate(deviceId, expectedAccountRef));
    return this.#createdState;
  }

  async refreshPendingList(): Promise<FedosDesktopViewModelState<readonly FedosDevicePairingRequestSummary[]>> {
    this.#pendingListState = fedosViewModelLoading();
    this.#pendingListState = fedosViewModelFromShellResult(this.#shell.devicePairingsList());
    return this.#pendingListState;
  }

  async inspectPairingRequest(encodedRequest: string): Promise<FedosDesktopViewModelState<FedosDevicePairingRequestInspectionView>> {
    this.#inspectionState = fedosViewModelLoading();
    this.#inspectionState = fedosViewModelFromShellResult(this.#shell.devicePairingInspect(encodedRequest));
    return this.#inspectionState;
  }

  async approvePairingRequest(encodedRequest: string): Promise<FedosDesktopViewModelState<FedosDevicePairingApprovalOutcomeView>> {
    this.#approvalState = fedosViewModelLoading();
    this.#approvalState = fedosViewModelFromShellResult(await this.#shell.devicePairingApprove(encodedRequest));
    return this.#approvalState;
  }

  async completePairing(pairingId: string, encodedApproval: string): Promise<FedosDesktopViewModelState<FedosDevicePairingBindingView>> {
    this.#completionState = fedosViewModelLoading();
    this.#completionState = fedosViewModelFromShellResult(await this.#shell.devicePairingComplete(pairingId, encodedApproval));
    return this.#completionState;
  }

  async revokeDevice(deviceId: string, devicePublicKeyHex: string): Promise<FedosDesktopViewModelState<FedosDevicePairingBindingView>> {
    this.#revocationState = fedosViewModelLoading();
    this.#revocationState = fedosViewModelFromShellResult(await this.#shell.deviceRevoke(deviceId, devicePublicKeyHex));
    return this.#revocationState;
  }

  async refreshStatus(deviceId: string): Promise<FedosDesktopViewModelState<FedosDevicePairingBindingView>> {
    this.#statusState = fedosViewModelLoading();
    this.#statusState = fedosViewModelFromShellResult(this.#shell.deviceRegistrationStatus(deviceId));
    return this.#statusState;
  }
}
