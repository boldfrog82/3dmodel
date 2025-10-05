import { SceneManager } from '../core/SceneManager';
import { RendererManager } from '../core/RendererManager';
import { GestureController } from '../core/GestureController';
import { GizmoManager } from '../core/GizmoManager';
import { UndoStack } from '../core/UndoStack';
import { createToolbar } from './Toolbar';
import { createOutliner } from './Outliner';
import { createMaterialEditor } from './MaterialEditorPanel';
import { createFileMenu } from './FileMenu';

interface AppOptions {
  container: HTMLElement;
  sceneManager: SceneManager;
  rendererManager: RendererManager;
  gestureController: GestureController;
  gizmoManager: GizmoManager;
  undoStack: UndoStack;
}

export function createApp(options: AppOptions) {
  const { container, sceneManager, rendererManager, gestureController, gizmoManager, undoStack } = options;

  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.opacity = '0';
  let toastTimer: number | undefined;

  const showToast = (message: string) => {
    toast.textContent = message;
    toast.style.opacity = '1';
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(() => {
      toast.style.opacity = '0';
    }, 2500);
  };

  const toolbar = createToolbar({
    sceneManager,
    gizmoManager,
    undoStack,
    gestureController,
    onToast: showToast
  }).element;

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';

  const outliner = createOutliner({ sceneManager, gizmoManager }).element;
  const materialEditor = createMaterialEditor(sceneManager, undoStack).element;
  const fileMenu = createFileMenu({ sceneManager, undoStack, onToast: showToast }).element;

  sidebar.append(fileMenu, outliner, materialEditor);

  const viewport = document.createElement('div');
  viewport.className = 'viewport';

  shell.append(toolbar, sidebar, viewport, toast);

  let disposeSelection: (() => void) | undefined;

  const mount = () => {
    container.appendChild(shell);
    rendererManager.mount(viewport);
    disposeSelection = sceneManager.on('selection', (selection) => {
      if (!selection) {
        gizmoManager.detach();
      }
    });
    void sceneManager.loadFromLocalStorage().then(() => undoStack.capture());
  };

  const unmount = () => {
    rendererManager.unmount();
    shell.remove();
    disposeSelection?.();
  };

  return { mount, unmount };
}
