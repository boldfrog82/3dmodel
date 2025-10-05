import { Object3D } from 'three';
import { SceneManager } from '../core/SceneManager';
import { GizmoManager } from '../core/GizmoManager';

interface OutlinerDeps {
  sceneManager: SceneManager;
  gizmoManager: GizmoManager;
}

export function createOutliner({ sceneManager, gizmoManager }: OutlinerDeps) {
  const panel = document.createElement('div');
  panel.className = 'panel';

  const title = document.createElement('h2');
  title.textContent = 'Outliner';
  panel.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'outliner-list';
  panel.appendChild(list);

  const render = () => {
    list.innerHTML = '';
    const items = sceneManager.getOutlinerItems();
    items.forEach((object) => {
      const item = document.createElement('li');
      item.className = 'outliner-item';
      item.textContent = object.name || object.type;
      if (sceneManager.selection === object) {
        item.classList.add('active');
      }
      item.addEventListener('click', () => {
        sceneManager.select(object);
        gizmoManager.attach(object);
      });
      item.addEventListener('dblclick', () => {
        const next = prompt('Rename object', object.name);
        if (next) {
          sceneManager.rename(object, next);
        }
      });
      list.appendChild(item);
    });
  };

  sceneManager.on('change', render);
  sceneManager.on('selection', render);
  render();

  return { element: panel };
}
