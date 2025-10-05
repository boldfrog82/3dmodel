import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type PrimitiveType = 'box' | 'sphere' | 'plane';

export interface SceneEventMap {
  selection: Object3D | null;
  change: void;
}

export type SceneEventListener<K extends keyof SceneEventMap> = (payload: SceneEventMap[K]) => void;

let objectId = 0;

export class SceneManager {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(60, 1, 0.1, 1000);
  private selected: Object3D | null = null;
  private listeners: { [K in keyof SceneEventMap]: Set<SceneEventListener<K>> } = {
    selection: new Set(),
    change: new Set()
  };
  private loader = new GLTFLoader();
  private exporter = new GLTFExporter();
  private persistentObjects = new Set<Object3D>();

  constructor() {
    this.scene.background = new Color('#020617');

    const ambient = new AmbientLight('#f1f5f9', 0.6);
    ambient.name = 'Ambient Light';
    const directional = new DirectionalLight('#f8fafc', 1.1);
    directional.name = 'Main Light';
    directional.position.set(5, 10, 7);

    this.scene.add(ambient, directional);
    this.markPersistent(ambient);
    this.markPersistent(directional);

    this.camera.position.set(4, 4, 6);
  }

  on<K extends keyof SceneEventMap>(event: K, listener: SceneEventListener<K>): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  private emit<K extends keyof SceneEventMap>(event: K, payload: SceneEventMap[K]) {
    for (const listener of this.listeners[event]) {
      listener(payload);
    }
  }

  notifyChange() {
    this.emit('change', undefined);
  }

  get selection() {
    return this.selected;
  }

  select(object: Object3D | null) {
    this.selected = object;
    this.emit('selection', object);
  }

  createPrimitive(type: PrimitiveType): Object3D {
    let geometry;
    switch (type) {
      case 'box':
        geometry = new BoxGeometry(1, 1, 1);
        break;
      case 'sphere':
        geometry = new SphereGeometry(0.6, 32, 24);
        break;
      case 'plane':
      default:
        geometry = new PlaneGeometry(1.5, 1.5, 1, 1);
        geometry.rotateX(-Math.PI / 2);
        break;
    }

    const material = new MeshStandardMaterial({ color: '#60a5fa', roughness: 0.4, metalness: 0.2 });
    const mesh = new Mesh(geometry, material);
    mesh.name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${++objectId}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = type === 'plane' ? 0 : 0.5;

    this.scene.add(mesh);
    this.notifyChange();
    return mesh;
  }

  deleteSelected() {
    if (!this.selected) return;
    this.selected.removeFromParent();
    this.select(null);
    this.notifyChange();
  }

  setMaterialProperty(property: 'color' | 'metalness' | 'roughness', value: string | number) {
    const mesh = this.selected as Mesh | null;
    if (!mesh || !(mesh.material instanceof MeshStandardMaterial)) return;
    if (property === 'color' && typeof value === 'string') {
      mesh.material.color = new Color(value);
    } else if (property === 'metalness' && typeof value === 'number') {
      mesh.material.metalness = value;
    } else if (property === 'roughness' && typeof value === 'number') {
      mesh.material.roughness = value;
    }
    mesh.material.needsUpdate = true;
    this.notifyChange();
  }

  rename(object: Object3D, name: string) {
    object.name = name;
    this.notifyChange();
  }

  markPersistent(object: Object3D) {
    this.persistentObjects.add(object);
    object.traverse((node) => {
      node.userData = { ...node.userData, __persistent: true };
    });
  }

  private isPersistent(object: Object3D) {
    if (object.userData?.__persistent) return true;
    let current: Object3D | null = object.parent;
    while (current) {
      if (current.userData?.__persistent) return true;
      current = current.parent;
    }
    return this.persistentObjects.has(object);
  }

  getOutlinerItems(): Object3D[] {
    const items: Object3D[] = [];
    this.scene.traverse((object) => {
      if (object instanceof Mesh && !this.isPersistent(object)) {
        items.push(object);
      }
    });
    return items;
  }

  async exportScene(binary = false): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.exporter.parse(
        this.scene,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(new Blob([result], { type: 'model/gltf-binary' }));
          } else {
            const content = binary ? result : JSON.stringify(result, null, 2);
            resolve(new Blob([content], { type: 'application/json' }));
          }
        },
        (error) => reject(error),
        { binary }
      );
    });
  }

  async serialize(): Promise<string> {
    const blob = await this.exportScene(false);
    return blob.text();
  }

  async saveToLocalStorage(key = '3dmodeler-scene') {
    const serialized = await this.serialize();
    localStorage.setItem(key, serialized);
  }

  async loadFromLocalStorage(key = '3dmodeler-scene') {
    const stored = localStorage.getItem(key);
    if (!stored) return;
    await this.importFromString(stored);
  }

  async importFromFile(file: File) {
    const buffer = await file.arrayBuffer();
    if (file.name.toLowerCase().endsWith('.glb')) {
      await this.importFromBinary(buffer);
    } else {
      await this.importFromString(new TextDecoder().decode(buffer));
    }
  }

  async importFromBinary(buffer: ArrayBuffer) {
    return new Promise<void>((resolve, reject) => {
      this.loader.parse(
        buffer,
        '',
        (gltf) => {
          this.useImportedScene(gltf.scene);
          resolve();
        },
        reject
      );
    });
  }

  async importFromString(data: string) {
    return new Promise<void>((resolve, reject) => {
      this.loader.parse(
        data,
        '',
        (gltf) => {
          this.useImportedScene(gltf.scene);
          resolve();
        },
        reject
      );
    });
  }

  private useImportedScene(imported: Scene) {
    this.clearScene();
    imported.children.forEach((child) => {
      child.removeFromParent();
      this.scene.add(child);
    });
    this.notifyChange();
  }

  clearScene() {
    const toRemove: Object3D[] = [];
    this.scene.traverse((child) => {
      if (child instanceof Mesh && !this.isPersistent(child)) {
        toRemove.push(child);
      }
    });
    toRemove.forEach((child) => child.removeFromParent());
    this.select(null);
    this.notifyChange();
  }
}
