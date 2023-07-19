import ReactDOM from 'react-dom/client';
import React from 'react';

import EthereumApi from './EthereumApi';
import assert from './helpers/assert';
import popupUrl from './popupUrl';
import PermissionPopup from './PermissionPopup';
import sheetsRegistry from './sheetsRegistry';

export default class WaxInPage {
  private constructor(public ethereum: EthereumApi) {}

  static create(): WaxInPage {
    const wax: WaxInPage = new WaxInPage(
      new EthereumApi((message) => wax.requestPermission(message)),
    );

    return wax;
  }

  static global() {
    WaxInPage.create().attachGlobals();
  }

  attachGlobals() {
    const global = globalThis as Record<string, unknown>;

    global.waxInPage = this;
    global.ethereum = this.ethereum;
  }

  static addStylesheet() {
    queueMicrotask(() => {
      const style = document.createElement('style');
      style.textContent = sheetsRegistry.toString();
      document.head.append(style);
    });
  }

  async requestPermission(message: string) {
    // eslint-disable-next-line no-unused-expressions
    this;

    const opt = {
      popup: true,
      width: 400,
      height: 600,
      left: window.screenLeft + window.innerWidth - 410,
      top: window.screenTop + 60,
    };

    const popup = window.open(
      popupUrl,
      undefined,
      Object.entries(opt)
        .map(([k, v]) => `${k}=${v.toString()}`)
        .join(', '),
    );

    assert(popup !== null);

    await new Promise((resolve) => {
      popup.addEventListener('load', resolve);
    });

    const style = document.createElement('style');
    style.textContent = sheetsRegistry.toString();

    popup.document.head.append(style);

    const response = await new Promise<boolean>((resolve) => {
      ReactDOM.createRoot(popup.document.getElementById('root')!).render(
        <React.StrictMode>
          <PermissionPopup message={message} respond={resolve} />
        </React.StrictMode>,
      );

      popup.addEventListener('unload', () => resolve(false));
    });

    popup.close();

    return response;
  }
}
