# 3dmodel

codex/create-ci-workflow-and-deployment-instructions
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

A lightweight 3D model viewer intended for quick prototyping and demonstrations. The project focuses on delivering an interactive scene that works well across desktop and touch devices while keeping the build pipeline simple.

## Tech Stack
- **Vite + React** for a fast development server and component-driven UI composition.
- **TypeScript** to provide static typing and safer refactoring as the viewer grows.
- **Three.js** for rendering WebGL scenes and handling camera, lighting, and mesh utilities.
- **ESLint & Prettier** (optional) for consistent formatting and linting when added to the toolchain.

## License
This project is intended to be released under the MIT License. Add a `LICENSE` file with the full text before distributing binaries or builds.

## Getting Started
Install dependencies, start the development server, or build the optimized production bundle:

```bash
npm install
npm run dev
npm run build
```

## Usage Notes
- Load supported `.glb`/`.gltf` assets through the UI or by updating the default asset path.
- Use the camera controls below to inspect geometry from multiple angles.
- Ensure textures are hosted alongside models when deploying to avoid CORS errors.

### Touch Gesture Guide
- **Single finger drag**: Orbit around the focal point.
- **Two finger drag**: Pan across the scene.
- **Pinch**: Zoom in or out, matching mouse scroll behavior.

### Keyboard Shortcuts
- `W` / `S`: Dolly the camera forward or backward.
- `A` / `D`: Strafe left or right.
- `Q` / `E`: Roll the camera counterclockwise or clockwise.
- `R`: Reset the camera to its default position.
- `Space`: Toggle animation playback.

## Architecture Overview
```
+---------------------+
|  React Components   |  UI panels, loaders, overlays
+----------+----------+
           |
           v
+----------+----------+
| Scene Controller    |  Hooks binding UI state to Three.js scene
+----------+----------+
           |
           v
+----------+----------+
| Three.js Renderer   |  Cameras, lights, and render loop
+----------+----------+
           |
           v
+---------------------+
| Asset Pipeline      |  Loader utilities for GLTF/texture assets
+---------------------+
```

## Deployment
The project is designed for static hosting, such as GitHub Pages or Netlify. Run `npm run build` to produce the `dist/` directory, then upload the contents to your hosting provider. Set the base path appropriately (e.g., `vite.config.ts > base`) when deploying to a subdirectory.

### Automation & Workflows
At present there are no CI/CD pipelines or deployment workflows defined in this repository. If you adopt GitHub Pages, consider adding a GitHub Actions workflow (for example, `.github/workflows/deploy.yml`) that runs `npm install`, `npm run build`, and publishes the `dist/` folder automatically.

## Manual Testing

### Drag Selection Workflow
1. Select a mesh and switch the edit mode to **Vertex**. Drag with the primary pointer to draw the marquee and confirm that every vertex inside the rectangle is highlighted and that the gizmo snaps to the averaged pivot. Repeat the test while holding **Shift** (add) and **Ctrl/Cmd** (toggle removal).
2. Switch to **Edge** mode and marquee-select across multiple edges. Verify that moving the transform gizmo translates the entire edge selection and that releasing the drag keeps the pivot centered on the group.
3. Switch to **Face** mode, marquee-select several faces, and translate them as a group. Confirm that a marquee that captures no handles falls back to single-click behavior so a lone face can still be selected.
4. For each mode, drag-select while holding **Ctrl/Cmd** to remove handles from an existing selection and ensure the gizmo updates or detaches when no handles remain.

## Roadmap
- [ ] Add automated GitHub Actions build-and-deploy pipeline.
- [ ] Provide drag-and-drop asset upload directly in the UI.
- [ ] Expand material editing panel with presets and real-time previews.
- [ ] Integrate unit tests for scene helpers and UI state management.
- [ ] Document environment configuration for bundling large assets.

main
