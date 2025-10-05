import './style.css';
import { createApp } from './ui/Layout';
import { SceneManager } from './core/SceneManager';
import { RendererManager } from './core/RendererManager';
import { GestureController } from './core/GestureController';
import { GizmoManager } from './core/GizmoManager';
import { UndoStack } from './core/UndoStack';

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) {
  throw new Error('App container not found');
}

const sceneManager = new SceneManager();
const rendererManager = new RendererManager(sceneManager);
const undoStack = new UndoStack();
undoStack.bind(sceneManager);
const gizmoManager = new GizmoManager(sceneManager, rendererManager.camera, rendererManager.domElement, undoStack);
const gestureController = new GestureController(rendererManager, gizmoManager, sceneManager);
gizmoManager.registerOrbitControls(gestureController.controls);

const app = createApp({
  container,
  sceneManager,
  rendererManager,
  gestureController,
  gizmoManager,
  undoStack
});
app.mount();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL ?? '/';
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    const swPath = `${normalizedBase}sw.js`.replace(/\/{2,}/g, '/');
    navigator.serviceWorker.register(swPath).catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}
