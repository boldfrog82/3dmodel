declare module "three/examples/jsm/exporters/GLTFExporter.js" {
  import type { Object3D, Scene } from "three";

  export interface GLTFExportOptions {
    binary?: boolean;
  }

  export class GLTFExporter {
    parse(
      input: Object3D | Scene,
      onCompleted: (result: object | ArrayBuffer) => void,
      onError: (error: unknown) => void,
      options?: GLTFExportOptions
    ): void;
  }
}
