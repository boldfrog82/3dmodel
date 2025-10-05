declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  import type { Group, Object3D, Scene } from "three";

  export interface GLTF {
    scene: Scene | Group;
  }

  export class GLTFLoader {
    parse(
      data: string | ArrayBuffer,
      path: string,
      onLoad: (gltf: GLTF) => void,
      onError: (error: unknown) => void
    ): void;
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (error: unknown) => void
    ): void;
  }
}
