import { Object3D, PerspectiveCamera } from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { TransformControlsEvent } from 'three/examples/jsm/controls/TransformControls.js';
import { SceneManager } from './SceneManager';
import { UndoStack } from './UndoStack';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type TransformMode = 'translate' | 'rotate' | 'scale';

export class GizmoManager {
  private controls: TransformControls;
  private active = false;
  private orbitControls?: OrbitControls;
  private current?: Object3D | null;

  constructor(
    private sceneManager: SceneManager,
    camera: PerspectiveCamera,
    domElement: HTMLElement,
    private undoStack: UndoStack
  ) {
    this.controls = new TransformControls(camera, domElement);
    this.controls.setSize(1.1);
    this.controls.addEventListener('dragging-changed', (event: TransformControlsEvent) => {
      this.active = event.value;
      if (this.orbitControls) {
        this.orbitControls.enabled = !event.value;
      }
      if (!event.value) {
        void this.undoStack.capture();
        this.sceneManager.notifyChange();
      }
    });
    this.controls.addEventListener('mouseDown', () => {
      void this.undoStack.capture();
    });
    this.sceneManager.scene.add(this.controls);
    this.sceneManager.markPersistent(this.controls);
  }

  registerOrbitControls(controls: OrbitControls) {
    this.orbitControls = controls;
  }

  setMode(mode: TransformMode) {
    this.controls.setMode(mode);
  }

  attach(object: Object3D) {
    this.current = object;
    this.controls.attach(object);
  }

  detach() {
    this.current = null;
    this.controls.detach();
  }

  isTransforming() {
    return this.active;
  }

  get currentObject() {
    return this.current;
  }
}
