import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Intersection,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  SphereGeometry,
  BoxGeometry,
  Vector3,
  Quaternion
} from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RendererManager } from './RendererManager';
import { SceneManager, EditMode } from './SceneManager';
import { UndoStack } from './UndoStack';
import { GizmoManager } from './GizmoManager';

interface HandleDescriptor {
  object: Mesh;
  indices: number[];
  kind: Exclude<EditMode, 'object'>;
  referencePosition: Vector3;
  normal?: Vector3;
}

const tempVector = new Vector3();
const tempVectorB = new Vector3();
const tempVectorC = new Vector3();
const tempVectorD = new Vector3();
const tempVectorE = new Vector3();
const tempVectorF = new Vector3();
const tempQuaternion = new Quaternion();

export class EditableMeshController {
  private handlesGroup = new Group();
  private handleControls: TransformControls;
  private orbitControls?: OrbitControls;
  private activeMesh: Mesh | null = null;
  private handles: HandleDescriptor[] = [];
  private activeHandle?: HandleDescriptor;
  private dragging = false;
  private vertexGeometry = new SphereGeometry(0.04, 12, 12);
  private edgeGeometry = new BoxGeometry(0.08, 0.08, 0.08);
  private faceGeometry = new PlaneGeometry(0.18, 0.18);
  private materials = {
    vertex: {
      idle: new MeshBasicMaterial({ color: '#a855f7' }),
      selected: new MeshBasicMaterial({ color: '#f97316' })
    },
    edge: {
      idle: new MeshBasicMaterial({ color: '#22c55e' }),
      selected: new MeshBasicMaterial({ color: '#f97316' })
    },
    face: {
      idle: new MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.6, side: 2 }),
      selected: new MeshBasicMaterial({ color: '#f97316', transparent: true, opacity: 0.85, side: 2 })
    }
  } as const;

  constructor(
    private sceneManager: SceneManager,
    private rendererManager: RendererManager,
    private gizmoManager: GizmoManager,
    private undoStack: UndoStack
  ) {
    const camera: PerspectiveCamera = rendererManager.camera;
    const domElement = rendererManager.domElement;
    this.handleControls = new TransformControls(camera, domElement);
    this.handleControls.setMode('translate');
    this.handleControls.setSize(0.7);
    this.handleControls.visible = false;
    this.handleControls.addEventListener('mouseDown', () => {
      void this.undoStack.capture();
    });
    this.handleControls.addEventListener('dragging-changed', (event) => {
      this.dragging = event.value;
      if (this.orbitControls) {
        this.orbitControls.enabled = !event.value;
      }
      if (!event.value) {
        if (this.activeHandle) {
          this.commitHandleEdit(this.activeHandle);
          this.sceneManager.notifyChange();
          void this.undoStack.capture();
        }
      }
    });
    this.handleControls.addEventListener('objectChange', () => {
      if (!this.activeHandle || !this.dragging) return;
      this.applyHandleDelta(this.activeHandle);
      this.sceneManager.notifyChange();
    });

    this.sceneManager.scene.add(this.handleControls);
    this.sceneManager.markPersistent(this.handleControls);

    this.handlesGroup.visible = false;
    this.sceneManager.scene.add(this.handlesGroup);
    this.sceneManager.markPersistent(this.handlesGroup);

    this.sceneManager.on('selection', () => this.onSelectionChanged());
    this.sceneManager.on('change', () => this.refreshHandles());
    this.sceneManager.on('editMode', () => this.onEditModeChanged());
  }

  registerOrbitControls(controls: OrbitControls) {
    this.orbitControls = controls;
  }

  private onEditModeChanged() {
    const mode = this.sceneManager.getEditMode();
    if (mode === 'object') {
      this.exitEditing();
      return;
    }
    this.enterEditing();
    this.updateHandleVisibility();
  }

  private onSelectionChanged() {
    if (this.sceneManager.getEditMode() === 'object') {
      this.exitEditing();
      return;
    }
    this.enterEditing();
  }

  private exitEditing() {
    this.activeMesh = null;
    this.handles = [];
    this.activeHandle = undefined;
    this.handlesGroup.clear();
    this.handlesGroup.visible = false;
    this.handleControls.visible = false;
    this.handleControls.detach();
    const selected = this.sceneManager.getSelectedMesh();
    if (this.sceneManager.getEditMode() === 'object' && selected) {
      this.gizmoManager.attach(selected);
    }
  }

  private enterEditing() {
    const selection = this.sceneManager.selection;
    if (!(selection instanceof Mesh)) {
      this.exitEditing();
      return;
    }
    if (selection !== this.activeMesh) {
      this.activeMesh = selection;
      this.ensureEditableGeometry(selection);
      this.rebuildHandles();
    }
    this.handlesGroup.visible = true;
    this.updateHandleVisibility();
    this.gizmoManager.detach();
  }

  private ensureEditableGeometry(mesh: Mesh) {
    const geometry = mesh.geometry;
    if (geometry.index) {
      const nonIndexed = geometry.toNonIndexed();
      geometry.dispose();
      mesh.geometry = nonIndexed;
    }
    const bufferGeometry = mesh.geometry as BufferGeometry;
    let positionAttr = bufferGeometry.getAttribute('position');
    if (!(positionAttr instanceof Float32BufferAttribute)) {
      const array = new Float32Array(positionAttr.array as ArrayLike<number>);
      positionAttr = new Float32BufferAttribute(array, 3);
      bufferGeometry.setAttribute('position', positionAttr);
    }
    bufferGeometry.computeBoundingBox();
    bufferGeometry.computeBoundingSphere();
  }

  private rebuildHandles() {
    this.handlesGroup.clear();
    this.handles = [];
    this.activeHandle = undefined;
    this.handleControls.detach();
    this.handleControls.visible = false;

    if (!this.activeMesh) {
      return;
    }
    const geometry = this.activeMesh.geometry as BufferGeometry;
    const positionAttr = geometry.getAttribute('position') as BufferAttribute;
    const vertexCount = positionAttr.count;

    for (let i = 0; i < vertexCount; i++) {
      const handleMesh = new Mesh(this.vertexGeometry, this.materials.vertex.idle);
      handleMesh.name = `Vertex ${i}`;
      handleMesh.userData.__handle = true;
    this.getVertexPosition(positionAttr, i, tempVector);
    handleMesh.position.copy(tempVector);
    this.handlesGroup.add(handleMesh);
    this.handles.push({
      object: handleMesh,
      indices: [i],
      kind: 'vertex',
      referencePosition: tempVector.clone()
    });
  }

    const edgeMap = new Map<string, { indices: [number, number]; handle?: HandleDescriptor }>();
    for (let i = 0; i < vertexCount; i += 3) {
      const tri = [i, i + 1, i + 2];
      for (let e = 0; e < 3; e++) {
        const a = tri[e];
        const b = tri[(e + 1) % 3];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { indices: [a, b] });
        }
      }
      const facePosition = this.computeFaceCenter(positionAttr, tri[0], tri[1], tri[2]);
      const faceMesh = new Mesh(this.faceGeometry, this.materials.face.idle);
      faceMesh.name = `Face ${i / 3}`;
      faceMesh.userData.__handle = true;
      faceMesh.position.copy(facePosition);
      const normal = this.computeFaceNormal(positionAttr, tri[0], tri[1], tri[2]);
      tempQuaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal);
      faceMesh.quaternion.copy(tempQuaternion);
      this.handlesGroup.add(faceMesh);
      this.handles.push({
        object: faceMesh,
        indices: tri.slice(),
        kind: 'face',
        referencePosition: facePosition.clone(),
        normal: normal.clone()
      });
    }

    for (const { indices } of edgeMap.values()) {
      const position = this.computeEdgeCenter(positionAttr, indices[0], indices[1]);
      const edgeMesh = new Mesh(this.edgeGeometry, this.materials.edge.idle);
      edgeMesh.userData.__handle = true;
      edgeMesh.name = `Edge ${indices.join('-')}`;
      edgeMesh.position.copy(position);
      this.handlesGroup.add(edgeMesh);
      this.handles.push({
        object: edgeMesh,
        indices: indices.slice(),
        kind: 'edge',
        referencePosition: position.clone()
      });
    }

    this.updateHandleVisibility();
  }

  private updateHandleVisibility() {
    const mode = this.sceneManager.getEditMode();
    const visibleKinds: Set<HandleDescriptor['kind']> = new Set();
    if (mode === 'vertex') visibleKinds.add('vertex');
    if (mode === 'edge') visibleKinds.add('edge');
    if (mode === 'face') visibleKinds.add('face');

    this.handles.forEach((handle) => {
      handle.object.visible = visibleKinds.has(handle.kind);
    });

    const shouldShowControls = this.activeHandle && visibleKinds.has(this.activeHandle.kind);
    if (!shouldShowControls) {
      this.handleControls.visible = false;
      this.handleControls.detach();
      this.activeHandle = undefined;
    }
  }

  private getVertexPosition(attr: BufferAttribute, index: number, target = new Vector3()) {
    return target.set(attr.getX(index), attr.getY(index), attr.getZ(index));
  }

  private computeEdgeCenter(attr: BufferAttribute, a: number, b: number) {
    this.getVertexPosition(attr, a, tempVector);
    this.getVertexPosition(attr, b, tempVectorB);
    return tempVectorC.copy(tempVector).add(tempVectorB).multiplyScalar(0.5);
  }

  private computeFaceCenter(attr: BufferAttribute, a: number, b: number, c: number) {
    this.getVertexPosition(attr, a, tempVector);
    this.getVertexPosition(attr, b, tempVectorB);
    this.getVertexPosition(attr, c, tempVectorC);
    return tempVectorD.copy(tempVector).add(tempVectorB).add(tempVectorC).multiplyScalar(1 / 3);
  }

  private computeFaceNormal(attr: BufferAttribute, a: number, b: number, c: number) {
    this.getVertexPosition(attr, a, tempVector);
    this.getVertexPosition(attr, b, tempVectorB);
    this.getVertexPosition(attr, c, tempVectorC);
    tempVectorD.copy(tempVectorB).sub(tempVector);
    tempVectorE.copy(tempVectorC).sub(tempVector);
    const normal = tempVectorF.copy(tempVectorD).cross(tempVectorE).normalize();
    if (!isFinite(normal.lengthSq()) || normal.lengthSq() === 0) {
      normal.set(0, 0, 1);
    }
    return normal;
  }

  private refreshHandles() {
    if (!this.activeMesh) return;
    const geometry = this.activeMesh.geometry as BufferGeometry;
    const positionAttr = geometry.getAttribute('position') as BufferAttribute;
    for (const handle of this.handles) {
      switch (handle.kind) {
        case 'vertex': {
          const index = handle.indices[0];
          this.getVertexPosition(positionAttr, index, tempVector);
          handle.object.position.copy(tempVector);
          handle.referencePosition.copy(tempVector);
          break;
        }
        case 'edge': {
          const [a, b] = handle.indices;
          const center = this.computeEdgeCenter(positionAttr, a, b);
          handle.object.position.copy(center);
          handle.referencePosition.copy(center);
          break;
        }
        case 'face': {
          const [a, b, c] = handle.indices;
          const center = this.computeFaceCenter(positionAttr, a, b, c);
          handle.object.position.copy(center);
          handle.referencePosition.copy(center);
          const normal = this.computeFaceNormal(positionAttr, a, b, c);
          if (handle.normal) {
            handle.normal.copy(normal);
          }
          tempQuaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal);
          handle.object.quaternion.copy(tempQuaternion);
          break;
        }
      }
    }
  }

  private applyHandleDelta(handle: HandleDescriptor) {
    if (!this.activeMesh) return;
    const delta = tempVector.copy(handle.object.position).sub(handle.referencePosition);
    if (delta.lengthSq() === 0) return;
    const geometry = this.activeMesh.geometry as BufferGeometry;
    const positionAttr = geometry.getAttribute('position') as BufferAttribute;
    for (const index of handle.indices) {
      const x = positionAttr.getX(index) + delta.x;
      const y = positionAttr.getY(index) + delta.y;
      const z = positionAttr.getZ(index) + delta.z;
      positionAttr.setXYZ(index, x, y, z);
    }
    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    handle.referencePosition.add(delta);
    this.updateRelatedHandles(handle);
  }

  private commitHandleEdit(handle: HandleDescriptor) {
    this.refreshHandles();
    this.handleControls.visible = true;
    this.handleControls.attach(handle.object);
  }

  private updateRelatedHandles(active: HandleDescriptor) {
    if (!this.activeMesh) return;
    const geometry = this.activeMesh.geometry as BufferGeometry;
    const positionAttr = geometry.getAttribute('position') as BufferAttribute;
    for (const handle of this.handles) {
      if (handle === active) continue;
      switch (handle.kind) {
        case 'vertex': {
          const index = handle.indices[0];
          this.getVertexPosition(positionAttr, index, tempVector);
          handle.object.position.copy(tempVector);
          handle.referencePosition.copy(tempVector);
          break;
        }
        case 'edge': {
          const [a, b] = handle.indices;
          const center = this.computeEdgeCenter(positionAttr, a, b);
          handle.object.position.copy(center);
          handle.referencePosition.copy(center);
          break;
        }
        case 'face': {
          const [a, b, c] = handle.indices;
          const center = this.computeFaceCenter(positionAttr, a, b, c);
          handle.object.position.copy(center);
          handle.referencePosition.copy(center);
          const normal = this.computeFaceNormal(positionAttr, a, b, c);
          tempQuaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal);
          handle.object.quaternion.copy(tempQuaternion);
          break;
        }
      }
    }
  }

  private clearHandleHighlights() {
    for (const handle of this.handles) {
      this.highlightHandle(handle, false);
    }
  }

  private highlightHandle(handle: HandleDescriptor, active: boolean) {
    let material: MeshBasicMaterial;
    switch (handle.kind) {
      case 'vertex':
        material = active ? this.materials.vertex.selected : this.materials.vertex.idle;
        break;
      case 'edge':
        material = active ? this.materials.edge.selected : this.materials.edge.idle;
        break;
      case 'face':
        material = active ? this.materials.face.selected : this.materials.face.idle;
        break;
    }
    handle.object.material = material;
  }

  handlePointer(intersections: Intersection[]) {
    const mode = this.sceneManager.getEditMode();
    if (mode === 'object') {
      return false;
    }
    const match = intersections.find((hit) => {
      let current: Object3D | null = hit.object;
      while (current) {
        if (this.handlesGroup.children.includes(current)) {
          return true;
        }
        current = current.parent;
      }
      return false;
    });
    if (!match) {
      this.clearHandleHighlights();
      this.activeHandle = undefined;
      this.handleControls.visible = false;
      this.handleControls.detach();
      return false;
    }

    const object = match.object as Mesh;
    const handle = this.handles.find((entry) => entry.object === object);
    if (!handle || !handle.object.visible) {
      return false;
    }

    this.clearHandleHighlights();
    this.highlightHandle(handle, true);
    this.activeHandle = handle;
    this.handleControls.visible = true;
    this.handleControls.attach(handle.object);
    return true;
  }
}
