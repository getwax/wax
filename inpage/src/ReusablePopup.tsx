import TypedEmitter from '../demo/helpers/TypedEmitter';
import runAsync from '../demo/helpers/runAsync';
import assert from './helpers/assert';
import delay from './helpers/delay';
import popupUrl from './popupUrl';
import sheetsRegistry from './sheetsRegistry';

export default class ReusablePopup {
  events = new TypedEmitter<{
    unload(): void;
  }>();

  useIndex = 0;

  private constructor(public window: Window) {
    window.addEventListener('unload', () => {
      this.events.emit('unload');
    });
  }

  static async create() {
    return new ReusablePopup(await createPopup());
  }

  unload() {
    if (this.window.closed) {
      return;
    }

    this.events.emit('unload');

    const rootEl = this.window.document.getElementById('root');
    assert(rootEl !== null);

    rootEl.innerHTML = '';
  }

  close() {
    if (this.window.closed) {
      return;
    }

    this.unload();

    const expiredUseIndex = this.useIndex;

    console.log(Date.now(), 'soft closed popup');

    runAsync(async () => {
      await delay(1000);

      if (this.useIndex === expiredUseIndex) {
        this.window.close();
        console.log(Date.now(), 'actually closed popup');
      } else {
        console.log(Date.now(), 'popup close canceled due to reuse');
      }
    });
  }

  async reuse() {
    console.log(Date.now(), 'reusing popup');
    this.unload();
    this.useIndex += 1;

    if (this.window.closed) {
      console.log(Date.now(), 'popup was closed, creating a new one');
      this.window = await createPopup();
    } else {
      console.log(Date.now(), 'successfully reused existing popup');
    }
  }
}

async function createPopup() {
  const opt = {
    popup: true,
    width: 400,
    height: 600,
    left: window.screenLeft + window.innerWidth * window.devicePixelRatio - 410,
    top: window.screenTop + 60,
  };

  const popupWindow = window.open(
    popupUrl,
    undefined,
    Object.entries(opt)
      .map(([k, v]) => `${k}=${v.toString()}`)
      .join(', '),
  );

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

  const style = document.createElement('style');
  style.textContent = sheetsRegistry.toString();

  popupWindow.document.head.append(style);

  return popupWindow;
}
