declare module "three/examples/jsm/controls/TransformControls.js" {
  import type { Object3D, PerspectiveCamera } from "three";

  export interface TransformControlsEvent {
    type: string;
    value: boolean;
  }

  export interface TransformControlsEventMap {
    "dragging-changed": TransformControlsEvent & { type: "dragging-changed" };
    [event: string]: TransformControlsEvent;
  }

  export class TransformControls extends Object3D {
    constructor(camera: PerspectiveCamera, domElement: HTMLElement);
    space: "world" | "local";
    attach(object: Object3D): void;
    detach(): void;
    dispose(): void;
    setMode(mode: "translate" | "rotate" | "scale"): void;
    setSize(size: number): void;
    setSpace(space: "world" | "local"): void;
    addEventListener<K extends keyof TransformControlsEventMap>(
      type: K,
      listener: (event: TransformControlsEventMap[K]) => void,
    ): void;
    removeEventListener<K extends keyof TransformControlsEventMap>(
      type: K,
      listener: (event: TransformControlsEventMap[K]) => void,
    ): void;
  }
}
