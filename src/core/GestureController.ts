import { Box3, Mesh, Object3D, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RendererManager } from './RendererManager';
import { GizmoManager } from './GizmoManager';
import { SceneManager } from './SceneManager';
import { EditableMeshController } from './EditableMeshController';

export class GestureController {
  readonly controls: OrbitControls;
  private pointerDown = { x: 0, y: 0, time: 0 };
  private pointerMoved = false;
  private pointerDownButton = 0;
  private defaultPosition: Vector3;
  private box = new Box3();
  private vec = new Vector3();
  private marqueeActive = false;
  private marqueeStart = { x: 0, y: 0 };
  private marqueeElement?: HTMLDivElement;

  constructor(
    private rendererManager: RendererManager,
    private gizmoManager: GizmoManager,
    private sceneManager: SceneManager,
    private editableMeshController: EditableMeshController
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
    this.pointerDownButton = event.button;
    this.marqueeActive = false;
  };

  private onPointerMove = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 6) {
      this.pointerMoved = true;
    }
    if (this.marqueeActive) {
      this.updateMarquee(event);
      event.preventDefault();
      return;
    }
    if (
      event.buttons === 1 &&
      this.pointerDownButton === 0 &&
      this.sceneManager.getEditMode() !== 'object' &&
      !this.gizmoManager.isTransforming() &&
      !this.editableMeshController.isTransforming()
    ) {
      const distance = Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y);
      if (distance > 6) {
        this.beginMarquee(event);
        this.updateMarquee(event);
        event.preventDefault();
      }
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.marqueeActive) {
      const selected = this.completeMarqueeSelection(event);
      if (selected === 0 && this.sceneManager.getEditMode() !== 'object') {
        const intersections = this.rendererManager.pick(event.clientX, event.clientY);
        this.editableMeshController.handlePointer(intersections, event);
      }
      return;
    }
    if (this.gizmoManager.isTransforming()) {
      return;
    }
    const elapsed = performance.now() - this.pointerDown.time;
    const distance = Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y);
    if (elapsed < 300 && distance < 6 && !this.pointerMoved) {
      const intersections = this.rendererManager.pick(event.clientX, event.clientY);
      if (this.sceneManager.getEditMode() !== 'object') {
        this.editableMeshController.handlePointer(intersections, event);
        return;
      }
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

  private beginMarquee(event: PointerEvent) {
    const element = this.ensureMarqueeElement();
    if (!element) {
      this.marqueeActive = false;
      return;
    }
    this.marqueeActive = true;
    this.marqueeStart = { x: this.pointerDown.x, y: this.pointerDown.y };
    element.style.display = 'block';
    element.style.left = '0px';
    element.style.top = '0px';
    element.style.width = '0px';
    element.style.height = '0px';
    this.controls.enabled = false;
    event.preventDefault();
  }

  private updateMarquee(event: PointerEvent) {
    if (!this.marqueeActive) return;
    const element = this.ensureMarqueeElement();
    if (!element) return;
    const container = element.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startX = this.marqueeStart.x;
    const startY = this.marqueeStart.y;
    const currentX = event.clientX;
    const currentY = event.clientY;
    const left = Math.min(startX, currentX) - rect.left;
    const top = Math.min(startY, currentY) - rect.top;
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
  }

  private completeMarqueeSelection(event: PointerEvent) {
    const toggle = !!(event.ctrlKey || event.metaKey);
    const additive = !!event.shiftKey && !toggle;
    const domRect = this.rendererManager.domElement.getBoundingClientRect();
    if (domRect.width === 0 || domRect.height === 0) {
      this.hideMarquee();
      this.marqueeActive = false;
      this.controls.enabled = true;
      return 0;
    }
    const convert = (clientX: number, clientY: number) => ({
      x: ((clientX - domRect.left) / domRect.width) * 2 - 1,
      y: -((clientY - domRect.top) / domRect.height) * 2 + 1
    });
    const a = convert(this.marqueeStart.x, this.marqueeStart.y);
    const b = convert(event.clientX, event.clientY);
    const bounds = {
      minX: Math.min(a.x, b.x),
      maxX: Math.max(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxY: Math.max(a.y, b.y)
    };
    const count =
      this.sceneManager.getEditMode() === 'object'
        ? 0
        : this.editableMeshController.selectHandlesInRect(bounds, { additive, toggle });
    this.hideMarquee();
    this.marqueeActive = false;
    this.controls.enabled = true;
    return count;
  }

  private ensureMarqueeElement(): HTMLDivElement | null {
    if (this.marqueeElement) {
      return this.marqueeElement;
    }
    const container = this.rendererManager.getContainer();
    if (!container) {
      return null;
    }
    const computed = window.getComputedStyle(container);
    if (computed.position === 'static') {
      container.style.position = 'relative';
    }
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.border = '1px solid rgba(59, 130, 246, 0.9)';
    element.style.background = 'rgba(59, 130, 246, 0.2)';
    element.style.pointerEvents = 'none';
    element.style.display = 'none';
    element.style.zIndex = '10';
    container.appendChild(element);
    this.marqueeElement = element;
    return element;
  }

  private hideMarquee() {
    if (!this.marqueeElement) return;
    this.marqueeElement.style.display = 'none';
    this.marqueeElement.style.width = '0px';
    this.marqueeElement.style.height = '0px';
  }
}
