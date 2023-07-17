import EthereumApi from './EthereumApi';

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
}
