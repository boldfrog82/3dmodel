import { Mesh, MeshStandardMaterial } from 'three';
import { SceneManager } from '../core/SceneManager';
import { UndoStack } from '../core/UndoStack';

export function createMaterialEditor(sceneManager: SceneManager, undoStack: UndoStack) {
  const panel = document.createElement('div');
  panel.className = 'panel material-editor';

  const title = document.createElement('h2');
  title.textContent = 'Material';
  panel.appendChild(title);

  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Color';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = '#60a5fa';
  const handleCapture = () => void undoStack.capture();

  colorInput.addEventListener('input', () => {
    sceneManager.setMaterialProperty('color', colorInput.value);
  });
  colorInput.addEventListener('change', handleCapture);
  colorLabel.appendChild(colorInput);
  panel.appendChild(colorLabel);

  const metalnessLabel = document.createElement('label');
  metalnessLabel.textContent = 'Metalness';
  const metalnessRange = document.createElement('input');
  metalnessRange.type = 'range';
  metalnessRange.min = '0';
  metalnessRange.max = '1';
  metalnessRange.step = '0.01';
  metalnessRange.addEventListener('input', () => {
    sceneManager.setMaterialProperty('metalness', parseFloat(metalnessRange.value));
  });
  metalnessRange.addEventListener('change', handleCapture);
  metalnessLabel.appendChild(metalnessRange);
  panel.appendChild(metalnessLabel);

  const roughnessLabel = document.createElement('label');
  roughnessLabel.textContent = 'Roughness';
  const roughnessRange = document.createElement('input');
  roughnessRange.type = 'range';
  roughnessRange.min = '0';
  roughnessRange.max = '1';
  roughnessRange.step = '0.01';
  roughnessRange.addEventListener('input', () => {
    sceneManager.setMaterialProperty('roughness', parseFloat(roughnessRange.value));
  });
  roughnessRange.addEventListener('change', handleCapture);
  roughnessLabel.appendChild(roughnessRange);
  panel.appendChild(roughnessLabel);

  const update = () => {
    const mesh = sceneManager.selection as Mesh | null;
    const material = mesh?.material instanceof MeshStandardMaterial ? mesh.material : null;
    const enabled = Boolean(material);
    [colorInput, metalnessRange, roughnessRange].forEach((input) => {
      input.disabled = !enabled;
    });
    if (!material) return;
    colorInput.value = `#${material.color.getHexString()}`;
    metalnessRange.value = material.metalness.toFixed(2);
    roughnessRange.value = material.roughness.toFixed(2);
  };

  sceneManager.on('selection', update);
  sceneManager.on('change', update);
  update();

  return { element: panel };
}
