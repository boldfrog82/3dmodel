import { Box3, Mesh, Object3D, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RendererManager } from './RendererManager';
import { GizmoManager } from './GizmoManager';
import { SceneManager } from './SceneManager';

export class GestureController {
  readonly controls: OrbitControls;
  private pointerDown = { x: 0, y: 0, time: 0 };
  private pointerMoved = false;
  private defaultPosition: Vector3;
  private box = new Box3();
  private vec = new Vector3();

  constructor(
    private rendererManager: RendererManager,
    private gizmoManager: GizmoManager,
    private sceneManager: SceneManager
  ) {
    this.defaultPosition = rendererManager.camera.position.clone();
    this.controls = new OrbitControls(rendererManager.camera, rendererManager.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = true;
    this.controls.maxPolarAngle = Math.PI * 0.98;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 200;
    this.controls.target.set(0, 0.5, 0);
    this.controls.update();
    this.rendererManager.onFrame(() => this.controls.update());

    this.rendererManager.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.rendererManager.domElement.addEventListener('pointerup', this.onPointerUp);
    this.rendererManager.domElement.addEventListener('pointermove', this.onPointerMove);
    this.rendererManager.domElement.addEventListener('wheel', () => this.controls.update(), { passive: true });
  }

  dispose() {
    this.controls.dispose();
    this.rendererManager.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.rendererManager.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.rendererManager.domElement.removeEventListener('pointermove', this.onPointerMove);
  }

  resetCamera() {
    const camera = this.rendererManager.camera;
    camera.position.copy(this.defaultPosition);
    this.controls.target.set(0, 0.5, 0);
    this.controls.update();
  }

  focusOn(object?: Object3D | null) {
    if (!object) {
      this.resetCamera();
      return;
    }
    const camera = this.rendererManager.camera;
    this.box.setFromObject(object);
    const center = this.box.getCenter(this.vec);
    if (!isFinite(center.lengthSq())) {
      this.resetCamera();
      return;
    }
    const size = this.box.getSize(this.vec).length();
    const distance = Math.max(size, 1.5) / Math.tan((camera.fov * Math.PI) / 360);
    const direction = camera.position.clone().sub(this.controls.target).normalize();
    if (!isFinite(direction.length())) {
      direction.set(0, 0, 1);
    }
    camera.position.copy(center.clone().add(direction.multiplyScalar(distance)));
    this.controls.target.copy(center);
    this.controls.update();
  }

  private onPointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
    this.pointerMoved = false;
  };

  private onPointerMove = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 6) {
      this.pointerMoved = true;
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.gizmoManager.isTransforming()) {
      return;
    }
    const elapsed = performance.now() - this.pointerDown.time;
    const distance = Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y);
    if (elapsed < 300 && distance < 6 && !this.pointerMoved) {
      const intersections = this.rendererManager.pick(event.clientX, event.clientY);
      const hit = intersections.find((intersection) => intersection.object.visible && intersection.object instanceof Mesh);
      if (hit) {
        this.sceneManager.select(hit.object);
        this.gizmoManager.attach(hit.object);
      } else {
        this.sceneManager.select(null);
        this.gizmoManager.detach();
      }
    }
  };
}
