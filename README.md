# 3dmodel

This repository now ships with a minimal Node-based toolchain so you can automate
builds and deployment while the actual 3D experience is under construction.

## Continuous integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs `npm install` and
`npm run build` on every push and pull request. Use this to keep the build
healthy as new assets and code are added.

## Building locally

```bash
npm install
npm run build
```

The default build script writes a placeholder HTML file to `dist/index.html`.
Swap `scripts/build.js` for your real bundler when the project is ready.

## One-click deployment

Deploy to GitHub Pages with a single command once you have committed your
changes:

```bash
npm run deploy
```

The deploy script rebuilds the site and publishes the contents of `dist/` to the
`gh-pages` branch via the [`gh-pages`](https://www.npmjs.com/package/gh-pages)
CLI.

> **Tip:** Update the build script or replace it with your production build
> pipeline before your first deployment so the published site reflects the real
> project output.
