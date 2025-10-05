declare module "three/examples/jsm/controls/TransformControls.js" {
  import type { Object3D, PerspectiveCamera } from "three";

  export interface TransformControlsEvent {
    type: string;
    value: boolean;
  }

  export class TransformControls extends Object3D {
    constructor(camera: PerspectiveCamera, domElement: HTMLElement);
    attach(object: Object3D): void;
    detach(): void;
    dispose(): void;
    setMode(mode: "translate" | "rotate" | "scale"): void;
    setSize(size: number): void;
    addEventListener(type: string, listener: (event: TransformControlsEvent) => void): void;
    removeEventListener(type: string, listener: (event: TransformControlsEvent) => void): void;
  }
}
