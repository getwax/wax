const popupHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <style>
    body {
      margin: 0;
      display: flex;
      place-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
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
