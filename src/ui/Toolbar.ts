import { SceneManager, PrimitiveType, EditMode } from '../core/SceneManager';
import { GizmoManager, TransformMode } from '../core/GizmoManager';
import { UndoStack } from '../core/UndoStack';
import { GestureController } from '../core/GestureController';

interface ToolbarDeps {
  sceneManager: SceneManager;
  gizmoManager: GizmoManager;
  undoStack: UndoStack;
  gestureController: GestureController;
  onToast: (message: string) => void;
}

export function createToolbar(deps: ToolbarDeps) {
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  const makeButton = (label: string, onClick: () => void, capture = true) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', async () => {
      onClick();
      if (capture) {
        await deps.undoStack.capture();
      }
    });
    return button;
  };

  const primitiveButtons: { type: PrimitiveType; label: string }[] = [
    { type: 'box', label: 'Cube' },
    { type: 'sphere', label: 'Sphere' },
    { type: 'plane', label: 'Plane' }
  ];

  const primitiveGroup = document.createElement('div');
  primitiveButtons.forEach(({ type, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', async () => {
      const mesh = deps.sceneManager.createPrimitive(type);
      deps.sceneManager.select(mesh);
      deps.gizmoManager.attach(mesh);
      deps.gestureController.focusOn(mesh);
      await deps.undoStack.capture();
    });
    primitiveGroup.appendChild(button);
  });
  toolbar.appendChild(primitiveGroup);

  const editModeGroup = document.createElement('div');
  editModeGroup.className = 'mode-toggle-group';
  const editModes: { mode: EditMode; label: string }[] = [
    { mode: 'object', label: 'Object' },
    { mode: 'vertex', label: 'Vertex' },
    { mode: 'edge', label: 'Edge' },
    { mode: 'face', label: 'Face' }
  ];
  const editButtons = new Map<EditMode, HTMLButtonElement>();
  editModes.forEach(({ mode, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      deps.sceneManager.setEditMode(mode);
      if (mode === 'object') {
        const selected = deps.sceneManager.getSelectedMesh();
        if (selected) {
          deps.gizmoManager.attach(selected);
        }
      } else if (!deps.sceneManager.getSelectedMesh()) {
        deps.onToast('Select a mesh to edit');
      }
    });
    editButtons.set(mode, button);
    editModeGroup.appendChild(button);
  });
  toolbar.appendChild(editModeGroup);

  const updateEditModeButtons = () => {
    const current = deps.sceneManager.getEditMode();
    editButtons.forEach((button, mode) => {
      button.classList.toggle('active', mode === current);
    });
  };
  updateEditModeButtons();
  deps.sceneManager.on('editMode', () => updateEditModeButtons());

  const modeSelect = document.createElement('select');
  const modes: { value: TransformMode; label: string }[] = [
    { value: 'translate', label: 'Move' },
    { value: 'rotate', label: 'Rotate' },
    { value: 'scale', label: 'Scale' }
  ];
  modes.forEach((mode) => {
    const option = document.createElement('option');
    option.value = mode.value;
    option.textContent = mode.label;
    modeSelect.appendChild(option);
  });
  modeSelect.addEventListener('change', () => {
    deps.gizmoManager.setMode(modeSelect.value as TransformMode);
  });
  toolbar.appendChild(modeSelect);

  const undoButton = makeButton('Undo', () => {
    void deps.undoStack.undo();
  }, false);
  const redoButton = makeButton('Redo', () => {
    void deps.undoStack.redo();
  }, false);
  toolbar.append(undoButton, redoButton);

  const focusButton = document.createElement('button');
  focusButton.textContent = 'Focus';
  focusButton.addEventListener('click', () => {
    deps.gestureController.focusOn(deps.sceneManager.selection);
  });
  toolbar.appendChild(focusButton);

  const resetCameraButton = document.createElement('button');
  resetCameraButton.textContent = 'Reset Camera';
  resetCameraButton.addEventListener('click', () => deps.gestureController.resetCamera());
  toolbar.appendChild(resetCameraButton);

  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save';
  saveButton.addEventListener('click', async () => {
    await deps.sceneManager.saveToLocalStorage();
    deps.onToast('Scene saved to local storage');
  });
  toolbar.appendChild(saveButton);

  const loadButton = document.createElement('button');
  loadButton.textContent = 'Load';
  loadButton.addEventListener('click', async () => {
    await deps.sceneManager.loadFromLocalStorage();
    deps.onToast('Scene loaded');
  });
  toolbar.appendChild(loadButton);

  const exportButton = document.createElement('button');
  exportButton.textContent = 'Export GLB';
  exportButton.addEventListener('click', async () => {
    const blob = await deps.sceneManager.exportScene(true);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'scene.glb';
    anchor.click();
    URL.revokeObjectURL(url);
    deps.onToast('Exported GLB');
  });
  toolbar.appendChild(exportButton);

  const importLabel = document.createElement('label');
  importLabel.textContent = 'Import';
  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = '.gltf,.glb';
  importInput.addEventListener('change', async () => {
    if (!importInput.files?.length) return;
    await deps.sceneManager.importFromFile(importInput.files[0]);
    deps.onToast('File imported');
    await deps.undoStack.capture();
    importInput.value = '';
  });
  importLabel.appendChild(importInput);
  toolbar.appendChild(importLabel);

  return { element: toolbar };
}
