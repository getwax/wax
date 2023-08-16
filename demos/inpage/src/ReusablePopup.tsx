import TypedEmitter from '../demo/helpers/TypedEmitter';
import assert from './helpers/assert';
import popupUrl from './popupUrl';
import sheetsRegistry from './sheetsRegistry';

export default class ReusablePopup {
  events = new TypedEmitter<{
    unload(): void;
  }>();

  useIndex = 0;

  private constructor(public iframe: HTMLIFrameElement) {
    window.addEventListener('unload', () => {
      this.events.emit('unload');
    });
  }

  static async create() {
    return new ReusablePopup(await createPopup());
  }

  getWindow() {
    const w = this.iframe.contentWindow;
    assert(w !== null);

    return w;
  }

  unload() {
    if (this.iframe.contentWindow === null) {
      return;
    }

    this.events.emit('unload');

    const rootEl = this.getWindow().document.getElementById('root');
    assert(rootEl !== null && rootEl !== undefined);

    rootEl.innerHTML = '';
  }

  close() {
    this.unload();
    this.iframe.remove();
  }

  async reuse() {
    this.unload();
    this.iframe = await createPopup();
  }
}

async function createPopup() {
  const iframe = document.createElement('iframe');
  iframe.src = popupUrl;
  iframe.style.opacity = '0';
  iframe.style.zIndex = '100';
  iframe.style.background = 'transparent';
  iframe.style.position = 'absolute';
  iframe.style.right = '20px';
  iframe.style.top = '20px';
  iframe.style.width = '400px';
  iframe.style.height = '650px';
  iframe.style.border = '3px solid grey';
  iframe.style.borderTop = '18px solid grey';
  iframe.style.borderRadius = '5px';
  iframe.style.boxShadow = '5px 5px 10px black';

  document.body.append(iframe);

  const popupWindow = iframe.contentWindow;

  assert(
    popupWindow !== null,
    [
      'Failed to create popup. The browser may have blocked this due to not',
      'being triggered by user input.',
    ].join(' '),
  );

  await new Promise((resolve) => {
    popupWindow.addEventListener('load', resolve);
  });

  iframe.style.opacity = '1';

  const style = document.createElement('style');
  style.textContent = sheetsRegistry.toString();

  popupWindow.document.head.append(style);

  return iframe;
}
