import EthereumApi from './EthereumApi';
import popupUrl from './popupUrl';

export default class WaxInPage {
  private constructor(public ethereum: EthereumApi) {}

  static create(): WaxInPage {
    return new WaxInPage(new EthereumApi());
  }

  static global() {
    const waxInPage = new WaxInPage(new EthereumApi());

    const global = globalThis as Record<string, unknown>;

    global.waxInPage = waxInPage;
    global.ethereum = waxInPage.ethereum;
  }

  popup() {
    // eslint-disable-next-line no-unused-expressions
    this;

    const opt = {
      popup: true,
      width: 400,
      height: 600,
      left: window.screenLeft + window.innerWidth - 410,
      top: window.screenTop + 60,
    };

    window.open(
      popupUrl,
      undefined,
      Object.entries(opt)
        .map(([k, v]) => `${k}=${v.toString()}`)
        .join(', '),
    );
  }
}
