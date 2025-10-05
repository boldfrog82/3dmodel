import { SceneManager } from '../core/SceneManager';
import { UndoStack } from '../core/UndoStack';

interface FileMenuDeps {
  sceneManager: SceneManager;
  undoStack: UndoStack;
  onToast: (message: string) => void;
}

export function createFileMenu({ sceneManager, undoStack, onToast }: FileMenuDeps) {
  const panel = document.createElement('div');
  panel.className = 'panel file-menu';

  const title = document.createElement('h2');
  title.textContent = 'Files';
  panel.appendChild(title);

  const newButton = document.createElement('button');
  newButton.textContent = 'New Scene';
  newButton.addEventListener('click', async () => {
    sceneManager.clearScene();
    await undoStack.capture();
    onToast('Scene cleared');
  });
  panel.appendChild(newButton);

  const sampleButton = document.createElement('button');
  sampleButton.textContent = 'Load Sample';
  sampleButton.addEventListener('click', async () => {
    const response = await fetch('/sample.gltf');
    const text = await response.text();
    await sceneManager.importFromString(text);
    await undoStack.capture();
    onToast('Sample scene loaded');
  });
  panel.appendChild(sampleButton);

  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete Selection';
  deleteButton.addEventListener('click', async () => {
    sceneManager.deleteSelected();
    await undoStack.capture();
    onToast('Selection removed');
  });
  panel.appendChild(deleteButton);

  return { element: panel };
}
