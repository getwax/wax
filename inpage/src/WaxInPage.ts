import EthereumApi from './EthereumApi';

const popupHtml = `
<!DOCTYPE html>
<html>
<head>
</head>
<body>
  <h1>I'm a popup.</h1>
</body>
</html>
`.trim();

const popupUrl = URL.createObjectURL(
  new Blob([popupHtml], { type: 'text/html' }),
);

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
      width: 100,
      height: 100,
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
