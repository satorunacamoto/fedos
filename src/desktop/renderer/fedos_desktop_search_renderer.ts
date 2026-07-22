/**
 * Secure Runtime Alpha 3401-3480 — Search Renderer.
 *
 * Consumes `FedosDesktopSearchViewModel` ONLY. `query` is always the
 * ViewModel's own CURRENT query text (even before/independent of a
 * `search()` call) so a future UI can render the input box's own value;
 * `results` is the last real search's own render model.
 */

import type { FedosDesktopSearchViewModel } from "../presentation/fedos_desktop_search_view_model.js";
import type { FedosContentAccessorSearchHit } from "../content_accessor/fedos_desktop_conversation_content_accessor_result.js";
import { fedosRenderModel, fedosRenderList, type FedosDesktopRenderModel, type FedosDesktopRenderList } from "./fedos_desktop_render_model.js";

export interface FedosDesktopSearchRenderModel {
  readonly query: string;
  readonly results: FedosDesktopRenderModel<FedosDesktopRenderList<FedosContentAccessorSearchHit>>;
}

export class FedosDesktopSearchRenderer {
  readonly #viewModel: FedosDesktopSearchViewModel;

  constructor(viewModel: FedosDesktopSearchViewModel) {
    this.#viewModel = viewModel;
  }

  render(): FedosDesktopSearchRenderModel {
    return Object.freeze({
      query: this.#viewModel.query,
      results: fedosRenderModel(this.#viewModel.state, (items) => fedosRenderList(items)),
    });
  }
}
