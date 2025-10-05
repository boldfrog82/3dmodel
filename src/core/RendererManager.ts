import { Clock, PerspectiveCamera, Raycaster, Scene, Vector2, WebGLRenderer } from 'three';
import { SceneManager } from './SceneManager';

export class RendererManager {
  readonly renderer: WebGLRenderer;
  readonly camera: PerspectiveCamera;
  readonly scene: Scene;
  readonly raycaster = new Raycaster();
  private pointer = new Vector2();
  private clock = new Clock();
  private animationId: number | null = null;
  private container?: HTMLElement;
  private frameCallbacks = new Set<() => void>();

  constructor(private sceneManager: SceneManager) {
    this.scene = sceneManager.scene;
    this.camera = sceneManager.camera;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.style.touchAction = 'none';
    window.addEventListener('resize', () => this.resize());
  }

  get domElement() {
    return this.renderer.domElement;
  }

  mount(container: HTMLElement) {
    this.container = container;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);
    this.resize();
    this.start();
  }

  unmount() {
    this.stop();
    this.renderer.dispose();
  }

  resize() {
    const width = this.container?.clientWidth ?? window.innerWidth;
    const height = this.container?.clientHeight ?? window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  start() {
    if (this.animationId !== null) return;
    const loop = () => {
      const delta = this.clock.getDelta();
      void delta;
      for (const callback of this.frameCallbacks) {
        callback();
      }
      this.render();
      this.animationId = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  pick(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.scene.children, true);
  }

  onFrame(callback: () => void) {
    this.frameCallbacks.add(callback);
    return () => this.frameCallbacks.delete(callback);
  }
}
