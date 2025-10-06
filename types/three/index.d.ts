declare module "three" {
  export type ColorRepresentation = string | number;

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    clone(): Vector3;
    sub(vector: Vector3): Vector3;
    normalize(): Vector3;
    multiplyScalar(scalar: number): Vector3;
    add(vector: Vector3): Vector3;
    cross(vector: Vector3): Vector3;
    length(): number;
    lengthSq(): number;
    copy(vector: Vector3): this;
  }

  export class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
    set(x: number, y: number): this;
  }

  export class Color {
    constructor(color?: ColorRepresentation);
    set(color: ColorRepresentation): this;
    getHexString(): string;
  }

  export class Object3D {
    name: string;
    type: string;
    visible: boolean;
    parent: Object3D | null;
    children: Object3D[];
    position: Vector3;
    quaternion: Quaternion;
    userData: Record<string, any>;
    traverse(callback: (object: Object3D) => void): void;
    add(...objects: Object3D[]): this;
    removeFromParent(): void;
    clear(): void;
  }

  export class Group extends Object3D {}

  export class Quaternion {
    setFromUnitVectors(from: Vector3, to: Vector3): this;
    copy(quaternion: Quaternion): this;
  }

  export class BufferAttribute {
    constructor(array: ArrayLike<number>, itemSize: number);
    array: ArrayLike<number>;
    itemSize: number;
    count: number;
    getX(index: number): number;
    getY(index: number): number;
    getZ(index: number): number;
    setXYZ(index: number, x: number, y: number, z: number): void;
    needsUpdate: boolean;
  }

  export class Float32BufferAttribute extends BufferAttribute {}

  export class BufferGeometry {
    index: { array: ArrayLike<number> } | null;
    toNonIndexed(): BufferGeometry;
    getAttribute(name: string): BufferAttribute;
    setAttribute(name: string, attribute: BufferAttribute): void;
    computeBoundingBox(): void;
    computeBoundingSphere(): void;
    computeVertexNormals(): void;
    dispose(): void;
  }

  export class Scene extends Object3D {
    background?: Color;
  }

  export class PerspectiveCamera extends Object3D {
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    fov: number;
    aspect: number;
    updateProjectionMatrix(): void;
  }

  export class Box3 {
    setFromObject(object: Object3D): this;
    getCenter(target: Vector3): Vector3;
    getSize(target: Vector3): Vector3;
  }

  export class Mesh<TGeometry = any, TMaterial = any> extends Object3D {
    constructor(geometry?: TGeometry, material?: TMaterial);
    material: TMaterial;
    geometry: TGeometry;
    castShadow: boolean;
    receiveShadow: boolean;
  }

  export class MeshBasicMaterial {
    constructor(parameters?: Record<string, any>);
  }

  export class MeshStandardMaterial {
    constructor(parameters?: { color?: ColorRepresentation; metalness?: number; roughness?: number });
    color: Color;
    metalness: number;
    roughness: number;
    needsUpdate: boolean;
  }

  export class AmbientLight extends Object3D {
    constructor(color?: ColorRepresentation, intensity?: number);
  }

  export class DirectionalLight extends Object3D {
    constructor(color?: ColorRepresentation, intensity?: number);
  }

  export class BoxGeometry {
    constructor(width?: number, height?: number, depth?: number);
  }

  export class SphereGeometry {
    constructor(radius?: number, widthSegments?: number, heightSegments?: number);
  }

  export class PlaneGeometry {
    constructor(width?: number, height?: number, widthSegments?: number, heightSegments?: number);
    rotateX(angle: number): this;
  }

  export class Clock {
    getDelta(): number;
  }

  export class Raycaster {
    setFromCamera(coords: Vector2, camera: PerspectiveCamera): void;
    intersectObjects(objects: Object3D[], recursive?: boolean): Intersection[];
  }

  export interface Intersection {
    object: Object3D;
  }

  export class WebGLRenderer {
    constructor(parameters?: Record<string, any>);
    domElement: HTMLElement;
    shadowMap: { enabled: boolean };
    setPixelRatio(value: number): void;
    setSize(width: number, height: number): void;
    render(scene: Scene, camera: PerspectiveCamera): void;
    dispose(): void;
  }

}
