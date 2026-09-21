import {
  LitElement,
  css,
  html,
  customElement,
  state,
} from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin } from "@umbraco-cms/backoffice/element-api";
import { UUIButtonElement } from "@umbraco-cms/backoffice/external/uui";
// NOTE: placeholder import - regenerate the client (`npm run generate-client` against a running
// DemoSite) and verify this name matches the real generated ../api/index.ts before relying on it.
import { ping } from "../api/index.js";

// Minimal starting point - replace with your package's real dashboard content. See
// https://docs.umbraco.com/umbraco-cms/customizing/overview for the extension patterns available.
@customElement("umbraco-community-tip-top-tip-tap-dashboard")
export class UmbracoCommunityTipTopTipTapDashboardElement extends UmbElementMixin(LitElement) {
  @state()
  private _response?: string;

  #onClickPing = async (ev: Event) => {
    const buttonElement = ev.target as UUIButtonElement;
    buttonElement.state = "waiting";

    const { data, error } = await ping();

    if (error) {
      buttonElement.state = "failed";
      console.error(error);
      return;
    }

    this._response = data;
    buttonElement.state = "success";
  };

  render() {
    return html`
      <uui-box headline="Crumpled Package Template">
        <h2>${this._response ?? "Press the button!"}</h2>
        <uui-button color="default" look="primary" @click=${this.#onClickPing}>
          Ping the server
        </uui-button>
        <p>Calls the UmbracoCommunityTipTopTipTapApiController's Ping endpoint via the generated SDK client.</p>
      </uui-box>
    `;
  }

  static styles = [
    css`
      :host {
        display: block;
        padding: var(--uui-size-layout-1);
      }
    `,
  ];
}

export default UmbracoCommunityTipTopTipTapDashboardElement;

declare global {
  interface HTMLElementTagNameMap {
    "umbraco-community-tip-top-tip-tap-dashboard": UmbracoCommunityTipTopTipTapDashboardElement;
  }
}
