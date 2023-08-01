import assert from './helpers/assert';
import popupUrl from './popupUrl';
import sheetsRegistry from './sheetsRegistry';

export default async function createPopup(): Promise<Window> {
  const opt = {
    popup: true,
    width: 400,
    height: 600,
    left: window.screenLeft + window.innerWidth * window.devicePixelRatio - 410,
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

  return popup;
}
