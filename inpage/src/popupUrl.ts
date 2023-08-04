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

    #root {
      width: 100vw;
      font-size: 1rem;
    }

    * {
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`.trim();

const popupUrl = URL.createObjectURL(
  new Blob([popupHtml], { type: 'text/html' }),
);

export default popupUrl;
