import { bgColor, fgColor } from './styleConstants';

const popupHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <style>
    body {
      font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      font-weight: 400;

      color-scheme: light dark;
      color: ${fgColor};
      background-color: ${bgColor};

      font-synthesis: none;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      -webkit-text-size-adjust: 100%;

      margin: 0;
      display: flex;
      place-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
    }

    #root-container {
      display: flex;
      flex-direction: column;
      width: 100vw;
      height: 100%;
      font-size: 1rem;
    }

    #root {
      display: flex;
      flex-grow: 1;
      max-height: 100%;
      overflow: auto;
    }

    #footer {
      background-color: hsla(-20, 100%, 50%, 0.1);
      width: 100vw;
      padding: 1em 2em;
    }

    * {
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div id="root-container">
    <div id="root"></div>
    <div id="footer">
      <b>Note:</b> ${window.location.host} can access your account without this
      dialog. Visit (TBD) to learn about upgrading to a custodial wallet.
    </div>
  </div>
</body>
</html>
`.trim();

const popupUrl = URL.createObjectURL(
  new Blob([popupHtml], { type: 'text/html' }),
);

export default popupUrl;
