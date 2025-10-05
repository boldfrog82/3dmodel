const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>3dmodel</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #ffffff, #dfe4ea);
        color: #1f2933;
      }
      main {
        padding: 3rem;
        max-width: 48rem;
        text-align: center;
        background: rgba(255, 255, 255, 0.85);
        border-radius: 1rem;
        box-shadow: 0 1.5rem 3rem rgba(15, 23, 42, 0.1);
      }
      h1 {
        font-size: clamp(2.5rem, 6vw, 3.5rem);
        margin-bottom: 1rem;
      }
      p {
        font-size: clamp(1rem, 2.5vw, 1.125rem);
        line-height: 1.6;
      }
      code {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 0.5rem;
        background-color: rgba(59, 130, 246, 0.1);
        color: #2563eb;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>3dmodel</h1>
      <p>
        The build pipeline is ready! Replace <code>scripts/build.js</code> with your
        actual application bundler so that <code>npm run build</code> exports the
        production-ready site to <code>dist/</code>.
      </p>
    </main>
  </body>
</html>`;

fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');

console.log('dist/index.html generated. Replace scripts/build.js with your actual build.');
