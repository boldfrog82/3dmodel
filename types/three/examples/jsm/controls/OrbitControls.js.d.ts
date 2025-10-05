declare module "three/examples/jsm/controls/OrbitControls.js" {
  import type { PerspectiveCamera, Vector3 } from "three";

  export class OrbitControls {
    constructor(camera: PerspectiveCamera, domElement: HTMLElement);
    enabled: boolean;
    target: Vector3;
    enableDamping: boolean;
    enablePan: boolean;
    maxPolarAngle: number;
    minDistance: number;
    maxDistance: number;
    update(): void;
    dispose(): void;
    addEventListener(type: string, listener: (...args: any[]) => void): void;
    removeEventListener(type: string, listener: (...args: any[]) => void): void;
  }
}
