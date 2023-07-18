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

export default popupUrl;
