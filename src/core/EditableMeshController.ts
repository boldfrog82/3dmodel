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
  referencePositionLocal: Vector3;
  referencePositionWorld: Vector3;
  normal?: Vector3;
}

const tempVector = new Vector3();
const tempVectorB = new Vector3();
const tempVectorC = new Vector3();
const tempVectorD = new Vector3();
const tempVectorE = new Vector3();
const tempVectorF = new Vector3();
const tempQuaternion = new Quaternion();
const tempVectorG = new Vector3();
const tempVectorH = new Vector3();
const tempVectorI = new Vector3();
const tempVectorJ = new Vector3();

interface NormalizedSelectionRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface SelectionOptions {
  additive?: boolean;
  toggle?: boolean;
}

const tempQuaternionB = new Quaternion();
const POSITION_KEY_PRECISION = 1e5;

export class EditableMeshController {
  private handlesGroup = new Group();
  private handleControls: TransformControls;
  private orbitControls?: OrbitControls;
  private activeMesh: Mesh | null = null;
  private handles: HandleDescriptor[] = [];
  private activeHandle?: HandleDescriptor;
  private selectedHandles = new Set<HandleDescriptor>();
  private selectionPivot = new Object3D();
  private transformTarget?: Object3D;
  private transformReference = new Vector3();
  private dragging = false;
  private vertexGeometry = new SphereGeometry(0.04, 12, 12);
  private edgeGeometry = new BoxGeometry(0.08, 0.08, 0.08);
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
      if (event.value) {
        if (this.transformTarget) {
          this.transformReference.copy(this.transformTarget.position);
        }
      } else if (this.selectedHandles.size > 0 || this.activeHandle) {
        this.commitSelectionEdit();
        this.sceneManager.notifyChange();
        void this.undoStack.capture();
      }
    });
    this.handleControls.addEventListener('objectChange', () => {
      if (!this.dragging || !this.transformTarget) return;
      this.applySelectionDelta();
      this.sceneManager.notifyChange();
    });

    this.sceneManager.scene.add(this.handleControls);
    this.sceneManager.markPersistent(this.handleControls);

    this.handlesGroup.visible = false;
    this.sceneManager.scene.add(this.handlesGroup);
    this.sceneManager.markPersistent(this.handlesGroup);

    this.selectionPivot.name = 'Selection Pivot';
    this.selectionPivot.visible = false;
    this.sceneManager.scene.add(this.selectionPivot);
    this.sceneManager.markPersistent(this.selectionPivot);

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
    this.selectedHandles.clear();
    this.transformTarget = undefined;
    this.selectionPivot.visible = false;
    this.handlesGroup.clear();
    this.handlesGroup.visible = false;
    this.handleControls.visible = false;
    this.handleControls.detach();
    this.handlesGroup.removeFromParent();
    this.sceneManager.scene.add(this.handlesGroup);
    this.handlesGroup.position.set(0, 0, 0);
    this.handlesGroup.quaternion.set(0, 0, 0, 1);
    this.handlesGroup.scale.set(1, 1, 1);
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
      this.handlesGroup.removeFromParent();
      selection.add(this.handlesGroup);
      this.handlesGroup.position.set(0, 0, 0);
      this.handlesGroup.quaternion.set(0, 0, 0, 1);
      this.handlesGroup.scale.set(1, 1, 1);
      this.handlesGroup.updateMatrixWorld(true);
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
    this.selectedHandles.clear();
    this.transformTarget = undefined;
    this.selectionPivot.visible = false;
    this.handleControls.detach();
    this.handleControls.visible = false;

    if (!this.activeMesh) {
      return;
    }
    const geometry = this.activeMesh.geometry as BufferGeometry;
    const positionAttr = geometry.getAttribute('position') as BufferAttribute;
    const vertexCount = positionAttr.count;

    const mesh = this.activeMesh;
    mesh.updateMatrixWorld(true);

    const indicesByVertexKey = new Map<string, Set<number>>();
    const edgeMap = new Map<
      string,
      {
        indices: Set<number>;
        planeKeys: Set<string>;
        representatives: Map<string, number>;
        occurrences: number;
      }
    >();
    const planeGroups = new Map<string, { indices: number[]; faceIndex: number }>();
    const quantize = (value: number) => Math.round(value * 1000) / 1000;
    const vertexKeyCache = new Map<number, string>();
    const positionDedupPrecision = POSITION_KEY_PRECISION;
    const getVertexKey = (index: number) => {
      let key = vertexKeyCache.get(index);
      if (key) return key;
      this.getVertexPosition(positionAttr, index, tempVector);
      key =
        `${Math.round(tempVector.x * positionDedupPrecision) / positionDedupPrecision}|` +
        `${Math.round(tempVector.y * positionDedupPrecision) / positionDedupPrecision}|` +
        `${Math.round(tempVector.z * positionDedupPrecision) / positionDedupPrecision}`;
      vertexKeyCache.set(index, key);
      let bucket = indicesByVertexKey.get(key);
      if (!bucket) {
        bucket = new Set<number>();
        indicesByVertexKey.set(key, bucket);
      }
      bucket.add(index);
      return key;
    };
    for (let i = 0; i < vertexCount; i++) {
      getVertexKey(i);
    }

    let faceCounter = 0;
    for (let i = 0; i < vertexCount; i += 3) {
      const tri = [i, i + 1, i + 2];
      const triVertexKeys = tri.map((index) => getVertexKey(index));
      for (let e = 0; e < 3; e++) {
        const a = tri[e];
        const b = tri[(e + 1) % 3];
        const keyA = triVertexKeys[e];
        const keyB = triVertexKeys[(e + 1) % 3];
        const edgeKey = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
        let entry = edgeMap.get(edgeKey);
        if (!entry) {
          entry = {
            indices: new Set<number>(),
            planeKeys: new Set<string>(),
            representatives: new Map<string, number>(),
            occurrences: 0
          };
          edgeMap.set(edgeKey, entry);
        }
        entry.indices.add(a);
        entry.indices.add(b);
        entry.occurrences += 1;
        if (!entry.representatives.has(keyA)) {
          entry.representatives.set(keyA, a);
        }
        if (!entry.representatives.has(keyB)) {
          entry.representatives.set(keyB, b);
        }
      }

      const faceCenter = this.computeFaceCenter(positionAttr, tri[0], tri[1], tri[2]).clone();
      const faceNormal = this.computeFaceNormal(positionAttr, tri[0], tri[1], tri[2]).clone();
      if (faceNormal.lengthSq() === 0) {
        faceNormal.set(0, 0, 1);
      } else {
        faceNormal.normalize();
      }

      const absX = Math.abs(faceNormal.x);
      const absY = Math.abs(faceNormal.y);
      const absZ = Math.abs(faceNormal.z);
      if (absX >= absY && absX >= absZ) {
        if (faceNormal.x < 0) faceNormal.multiplyScalar(-1);
      } else if (absY >= absX && absY >= absZ) {
        if (faceNormal.y < 0) faceNormal.multiplyScalar(-1);
      } else if (faceNormal.z < 0) {
        faceNormal.multiplyScalar(-1);
      }

      const planeConstant =
        faceNormal.x * faceCenter.x + faceNormal.y * faceCenter.y + faceNormal.z * faceCenter.z;
      const key =
        `${quantize(faceNormal.x)}|${quantize(faceNormal.y)}|${quantize(faceNormal.z)}|` +
        `${quantize(planeConstant)}`;

      let group = planeGroups.get(key);
      if (!group) {
        group = {
          indices: [],
          faceIndex: faceCounter++
        };
        planeGroups.set(key, group);
      }
      group.indices.push(...tri);

      for (let e = 0; e < 3; e++) {
        const a = tri[e];
        const b = tri[(e + 1) % 3];
        const keyA = getVertexKey(a);
        const keyB = getVertexKey(b);
        const edgeKey = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
        const entry = edgeMap.get(edgeKey);
        if (entry) {
          entry.planeKeys.add(key);
        }
      }
    }

    const vertexEntries = Array.from(indicesByVertexKey.entries()).map(([key, indexSet]) => ({
      key,
      indices: Array.from(indexSet).sort((a, b) => a - b)
    }));
    vertexEntries.sort((a, b) => a.indices[0] - b.indices[0]);

    for (const entry of vertexEntries) {
      const handleMesh = new Mesh(this.vertexGeometry, this.materials.vertex.idle);
      handleMesh.name = `Vertex ${entry.indices.join('-')}`;
      handleMesh.userData.__handle = true;
      const localPosition = this.computeIndicesCentroid(positionAttr, entry.indices, tempVectorI);
      const worldPosition = mesh.localToWorld(tempVectorJ.copy(localPosition));
      handleMesh.position.copy(localPosition);
      this.handlesGroup.add(handleMesh);
      this.handles.push({
        object: handleMesh,
        indices: entry.indices.slice(),
        kind: 'vertex',
        referencePositionLocal: localPosition.clone(),
        referencePositionWorld: worldPosition.clone()
      });
    }

    for (const group of planeGroups.values()) {
      const { centroid, normal } = this.computeFaceGroupAttributes(positionAttr, group.indices);
      const faceWorldPosition = mesh.localToWorld(centroid.clone());
      const worldNormal = this.transformNormalToWorld(normal.clone(), mesh);
      const faceGeometry = this.createFaceHandleGeometry(positionAttr, group.indices, centroid, normal);
      const faceMesh = new Mesh(faceGeometry, this.materials.face.idle);
      faceMesh.name = `Face ${group.faceIndex}`;
      faceMesh.userData.__handle = true;
      faceMesh.position.copy(centroid);
      tempQuaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal);
      faceMesh.quaternion.copy(tempQuaternion);
      faceMesh.renderOrder = 1;
      this.handlesGroup.add(faceMesh);
      this.handles.push({
        object: faceMesh,
        indices: group.indices.slice(),
        kind: 'face',
        referencePositionLocal: centroid.clone(),
        referencePositionWorld: faceWorldPosition.clone(),
        normal: worldNormal.clone()
      });
    }

    for (const entry of edgeMap.values()) {
      if (entry.representatives.size !== 2) continue;
      if (entry.occurrences > 1 && entry.planeKeys.size === 1) {
        continue;
      }
      const vertexKeys = Array.from(entry.representatives.keys()).sort();
      const representativePairs = vertexKeys
        .map((key) => entry.representatives.get(key)!)
        .sort((a, b) => a - b);
      const indicesSet = new Set<number>();
      for (const index of entry.indices) {
        indicesSet.add(index);
      }
      for (const key of vertexKeys) {
        const duplicates = indicesByVertexKey.get(key);
        if (duplicates) {
          duplicates.forEach((duplicate) => indicesSet.add(duplicate));
        }
      }
      const handleIndices = Array.from(indicesSet).sort((a, b) => a - b);
      const position = this.computeEdgeCenter(positionAttr, representativePairs[0], representativePairs[1]);
      const worldPosition = mesh.localToWorld(position.clone());
      const edgeMesh = new Mesh(this.edgeGeometry, this.materials.edge.idle);
      edgeMesh.userData.__handle = true;
      edgeMesh.name = `Edge ${handleIndices.join('-')}`;
      edgeMesh.position.copy(position);
      this.handlesGroup.add(edgeMesh);
      this.handles.push({
        object: edgeMesh,
        indices: handleIndices,
        kind: 'edge',
        referencePositionLocal: position.clone(),
        referencePositionWorld: worldPosition.clone()
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

    this.updateSelectionState();
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

  private transformNormalToWorld(normal: Vector3, mesh: Mesh) {
    mesh.getWorldQuaternion(tempQuaternionB);
    return normal.clone().applyQuaternion(tempQuaternionB).normalize();
  }

  private computeFaceGroupAttributes(attr: BufferAttribute, indices: number[]): {
    centroid: Vector3;
    normal: Vector3;
  } {
    const centroid = new Vector3();
    const normal = new Vector3();
    const uniqueVertices = new Map<string, Vector3>();
    const dedupPrecision = POSITION_KEY_PRECISION;
    const quantizeKey = (value: number) => Math.round(value * dedupPrecision) / dedupPrecision;

    for (const index of indices) {
      this.getVertexPosition(attr, index, tempVector);
      const key = `${quantizeKey(tempVector.x)}|${quantizeKey(tempVector.y)}|${quantizeKey(tempVector.z)}`;
      if (!uniqueVertices.has(key)) {
        uniqueVertices.set(key, tempVector.clone());
      }
    }

    if (uniqueVertices.size > 0) {
      for (const position of uniqueVertices.values()) {
        centroid.add(position);
      }
      centroid.multiplyScalar(1 / uniqueVertices.size);
    } else if (indices.length >= 3) {
      this.getVertexPosition(attr, indices[0], centroid);
    }

    for (let i = 0; i + 2 < indices.length; i += 3) {
      const a = indices[i];
      const b = indices[i + 1];
      const c = indices[i + 2];
      const triNormal = this.computeFaceNormal(attr, a, b, c);
      normal.add(triNormal);
    }

    if (normal.lengthSq() === 0) {
      normal.set(0, 0, 1);
    } else {
      normal.normalize();
    }

    return { centroid, normal };
  }
  private getFacePlaneBasis(normal: Vector3) {
    const u = new Vector3();
    const v = new Vector3();
    if (Math.abs(normal.x) > Math.abs(normal.z)) {
      u.set(-normal.y, normal.x, 0);
    } else {
      u.set(0, -normal.z, normal.y);
    }
    if (u.lengthSq() === 0) {
      u.set(1, 0, 0);
    }
    u.normalize();
    v.crossVectors(normal, u).normalize();
    return { u, v };
  }

  private createFaceHandleGeometry(
    attr: BufferAttribute,
    indices: number[],
    centroid: Vector3,
    normal: Vector3
  ) {
    const geometry = new BufferGeometry();
    const { u, v } = this.getFacePlaneBasis(normal);
    const positions = new Float32Array(indices.length * 3);
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      this.getVertexPosition(attr, index, tempVector);
      tempVector.sub(centroid);
      positions[i * 3] = tempVector.dot(u);
      positions[i * 3 + 1] = tempVector.dot(v);
      positions[i * 3 + 2] = 0.001;
    }
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  private updateFaceHandleGeometry(
    handle: HandleDescriptor,
    attr: BufferAttribute,
    centroid: Vector3,
    normal: Vector3
  ) {
    const mesh = handle.object;
    let geometry = mesh.geometry as BufferGeometry;
    const expectedCount = handle.indices.length * 3;
    const positionAttribute = geometry.getAttribute('position') as BufferAttribute | undefined;
    if (!positionAttribute || positionAttribute.count * 3 !== expectedCount) {
      geometry.dispose();
      geometry = this.createFaceHandleGeometry(attr, handle.indices, centroid, normal);
      mesh.geometry = geometry;
      return;
    }
    const { u, v } = this.getFacePlaneBasis(normal);
    const array = positionAttribute.array as Float32Array;
    for (let i = 0; i < handle.indices.length; i++) {
      const index = handle.indices[i];
      this.getVertexPosition(attr, index, tempVector);
      tempVector.sub(centroid);
      array[i * 3] = tempVector.dot(u);
      array[i * 3 + 1] = tempVector.dot(v);
      array[i * 3 + 2] = 0.001;
    }
    positionAttribute.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  private refreshHandles() {
    if (!this.activeMesh) return;
    const geometry = this.activeMesh.geometry as BufferGeometry;
    const positionAttr = geometry.getAttribute('position') as BufferAttribute;
    const mesh = this.activeMesh;
    mesh.updateMatrixWorld(true);
    for (const handle of this.handles) {
      this.updateHandleTransform(handle, positionAttr, mesh);
    }
    this.updateHandleHighlights();
    if (!this.dragging) {
      this.updateTransformAttachment();
    }
  }
  private applySelectionDelta() {
    if (!this.activeMesh || !this.transformTarget) return;

    const mesh = this.activeMesh;
    mesh.updateMatrixWorld(true);

    const targetWorld = this.transformTarget.getWorldPosition(tempVector);
    const referenceWorld = tempVectorB.copy(this.transformReference);

    const currentLocal = mesh.worldToLocal(targetWorld.clone());
    const referenceLocal = mesh.worldToLocal(referenceWorld);
    const deltaLocal = currentLocal.sub(referenceLocal);

    if (this.transformTarget === this.selectionPivot) {
      const handles = this.getHandlesForTransformation();
      if (handles.length === 0) {
        this.transformReference.copy(targetWorld);
        return;
      }

      if (deltaLocal.lengthSq() === 0) {
        this.transformReference.copy(targetWorld);
        return;
      }

      const geometry = mesh.geometry as BufferGeometry;
      const positionAttr = geometry.getAttribute('position') as BufferAttribute;
      const affectedIndices = new Set<number>();
      for (const handle of handles) {
        for (const index of handle.indices) {
          affectedIndices.add(index);
        }
      }

      for (const index of affectedIndices) {
        positionAttr.setXYZ(
          index,
          positionAttr.getX(index) + deltaLocal.x,
          positionAttr.getY(index) + deltaLocal.y,
          positionAttr.getZ(index) + deltaLocal.z
        );
      }

      positionAttr.needsUpdate = true;
      geometry.computeVertexNormals();
      this.refreshHandles();
      this.updateSelectionPivot(handles);
      this.transformReference.copy(this.selectionPivot.position);
      return;
    }

    const handle = this.handles.find((entry) => entry.object === this.transformTarget);
    if (!handle) {
      this.transformReference.copy(targetWorld);
      return;
    }

    this.applyHandleDelta(handle);
  }

  private applyHandleDelta(handle: HandleDescriptor) {
    if (!this.activeMesh) return;

    this.activeMesh.updateMatrixWorld(true);
    const worldPosition = handle.object.getWorldPosition(tempVector);
    const localPosition = this.activeMesh.worldToLocal(worldPosition.clone());
    const delta = localPosition.clone().sub(handle.referencePositionLocal);
    if (delta.lengthSq() === 0) return;

    const geometry = this.activeMesh.geometry as BufferGeometry;
    const positionAttr = geometry.getAttribute('position') as BufferAttribute;
    const handles = this.getHandlesForTransformation();
    if (handles.length === 0) return;

    const indices = new Set<number>();
    for (const selectedHandle of handles) {
      for (const index of selectedHandle.indices) {
        indices.add(index);
      }
    }

    for (const index of indices) {
      const x = positionAttr.getX(index) + delta.x;
      const y = positionAttr.getY(index) + delta.y;
      const z = positionAttr.getZ(index) + delta.z;
      positionAttr.setXYZ(index, x, y, z);
    }

    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals();

    this.refreshHandles();

    if (this.transformTarget === this.selectionPivot) {
      this.updateSelectionPivot(handles);
      this.transformReference.copy(this.selectionPivot.position);
    } else {
      this.transformReference.copy(worldPosition);

      const activeHandle = this.handles.find((entry) => entry.object === this.transformTarget);
      if (activeHandle) {
        this.transformReference.copy(activeHandle.referencePositionWorld);
      }
    }

    handle.referencePositionLocal.copy(localPosition);
    handle.referencePositionWorld.copy(worldPosition);
    handle.object.position.copy(localPosition);
    this.updateRelatedHandles(handle);
  }

  private commitSelectionEdit() {
    this.refreshHandles();
    this.updateSelectionState();
  }

  private getHandlesForTransformation(): HandleDescriptor[] {
    const handles = this.getVisibleSelectionHandles();
    if (handles.length === 0 && this.activeHandle && this.activeHandle.object.visible) {
      handles.push(this.activeHandle);
    }
    return handles;
  }

  private updateSelectionState() {
    this.filterSelectionByVisibility();
    if (this.selectedHandles.size === 0) {
      this.clearSelection();
      return;
    }
    if (this.activeHandle && !this.selectedHandles.has(this.activeHandle)) {
      this.activeHandle = this.selectedHandles.values().next().value;
    }
    if (!this.activeHandle) {
      this.activeHandle = this.selectedHandles.values().next().value;
    }
    this.updateHandleHighlights();
    if (!this.dragging) {
      this.updateTransformAttachment();
    }
  }

  private filterSelectionByVisibility() {
    let removed = false;
    for (const handle of Array.from(this.selectedHandles)) {
      if (!handle.object.visible) {
        this.selectedHandles.delete(handle);
        removed = true;
      }
    }
    if (removed && this.activeHandle && !this.selectedHandles.has(this.activeHandle)) {
      this.activeHandle = undefined;
    }
  }

  private getVisibleSelectionHandles(): HandleDescriptor[] {
    const handles: HandleDescriptor[] = [];
    for (const handle of Array.from(this.selectedHandles)) {
      if (handle.object.visible) {
        handles.push(handle);
      } else {
        this.selectedHandles.delete(handle);
      }
    }
    return handles;
  }

  private updateTransformAttachment() {
    const handles = this.getVisibleSelectionHandles();
    if (handles.length === 0) {
      this.transformTarget = undefined;
      this.handleControls.visible = false;
      this.handleControls.detach();
      this.selectionPivot.visible = false;
      return;
    }
    if (handles.length === 1) {
      const handle = handles[0];
      this.selectionPivot.visible = false;
      if (this.transformTarget !== handle.object) {
        this.handleControls.detach();
        this.handleControls.attach(handle.object);
      }
      this.handleControls.visible = true;
      this.transformTarget = handle.object;
      this.transformReference.copy(handle.referencePositionWorld);
      this.activeHandle = handle;
      const worldPosition = handle.object.getWorldPosition(tempVector);
      const misalignment = worldPosition.clone().sub(handle.referencePositionWorld).length();
      if (misalignment > 1e-4) {
        console.warn('EditableMeshController: handle alignment drift detected', misalignment);
      }
    } else {
      this.updateSelectionPivot(handles);
      if (this.transformTarget !== this.selectionPivot) {
        this.handleControls.attach(this.selectionPivot);
      }
      this.handleControls.visible = true;
      this.transformTarget = this.selectionPivot;
      this.transformReference.copy(this.selectionPivot.position);
    }
  }

  private updateSelectionPivot(handles: HandleDescriptor[]) {
    tempVectorH.set(0, 0, 0);
    for (const handle of handles) {
      handle.object.getWorldPosition(tempVectorG);
      tempVectorH.add(tempVectorG);
    }
    tempVectorH.multiplyScalar(1 / handles.length);
    this.selectionPivot.position.copy(tempVectorH);
    this.selectionPivot.quaternion.set(0, 0, 0, 1);
  }

  private updateHandleHighlights() {
    for (const handle of this.handles) {
      this.highlightHandle(handle, this.selectedHandles.has(handle));
    }
  }

  private clearSelection() {
    this.selectedHandles.clear();
    this.activeHandle = undefined;
    this.transformTarget = undefined;
    this.handleControls.visible = false;
    this.handleControls.detach();
    this.selectionPivot.visible = false;
    this.updateHandleHighlights();
  }

  private selectHandles(handles: HandleDescriptor[], options: SelectionOptions = {}) {
    const toggle = options.toggle ?? false;
    const additive = options.additive ?? false;

    if (!additive && !toggle) {
      this.selectedHandles.clear();
    }

    let lastAdded: HandleDescriptor | undefined;

    if (toggle) {
      for (const handle of handles) {
        if (!handle.object.visible) continue;
        if (this.selectedHandles.has(handle)) {
          this.selectedHandles.delete(handle);
        } else {
          this.selectedHandles.add(handle);
          lastAdded = handle;
        }
      }
    } else {
      for (const handle of handles) {
        if (!handle.object.visible) continue;
        this.selectedHandles.add(handle);
        lastAdded = handle;
      }
    }
    if (lastAdded) {
      this.activeHandle = lastAdded;
    } else if (this.activeHandle && !this.selectedHandles.has(this.activeHandle)) {
      this.activeHandle = this.selectedHandles.values().next().value;
    } else if (!this.activeHandle && this.selectedHandles.size > 0) {
      this.activeHandle = this.selectedHandles.values().next().value;
    }
    this.updateSelectionState();
  }

  private updateRelatedHandles(active: HandleDescriptor) {
    if (!this.activeMesh) return;
    const geometry = this.activeMesh.geometry as BufferGeometry;
    const positionAttr = geometry.getAttribute('position') as BufferAttribute;
    const mesh = this.activeMesh;
    mesh.updateMatrixWorld(true);
    for (const handle of this.handles) {
      if (handle === active) continue;
      this.updateHandleTransform(handle, positionAttr, mesh);
    }
  }
  private computeIndicesCentroid(
    attr: BufferAttribute,
    indices: number[],
    target = new Vector3()
  ) {
    target.set(0, 0, 0);
    if (indices.length === 0) {
      return target;
    }
    for (const index of indices) {
      this.getVertexPosition(attr, index, tempVector);
      target.add(tempVector);
    }
    target.multiplyScalar(1 / indices.length);
    return target;
  }

  private getEdgeEndpointIndices(attr: BufferAttribute, indices: number[]): [number, number] {
    const seen = new Map<string, number>();
    for (const index of indices) {
      this.getVertexPosition(attr, index, tempVector);
      const key =
        `${Math.round(tempVector.x * POSITION_KEY_PRECISION) / POSITION_KEY_PRECISION}|` +
        `${Math.round(tempVector.y * POSITION_KEY_PRECISION) / POSITION_KEY_PRECISION}|` +
        `${Math.round(tempVector.z * POSITION_KEY_PRECISION) / POSITION_KEY_PRECISION}`;
      if (!seen.has(key)) {
        seen.set(key, index);
      }
      if (seen.size === 2) {
        break;
      }
    }
    const unique = Array.from(seen.values());
    if (unique.length >= 2) {
      return [unique[0], unique[1]];
    }
    if (indices.length >= 2) {
      return [indices[0], indices[1]];
    }
    const fallback = indices[0] ?? 0;
    return [fallback, fallback];
  }

  private updateHandleTransform(
    handle: HandleDescriptor,
    attr: BufferAttribute,
    mesh: Mesh
  ) {
    switch (handle.kind) {
      case 'vertex': {
        const centroid = this.computeIndicesCentroid(attr, handle.indices, tempVectorI);
        const worldPosition = mesh.localToWorld(tempVectorJ.copy(centroid));
        handle.object.position.copy(centroid);
        handle.referencePositionLocal.copy(centroid);
        handle.referencePositionWorld.copy(worldPosition);
        break;
      }
      case 'edge': {
        const [a, b] = this.getEdgeEndpointIndices(attr, handle.indices);
        const center = this.computeEdgeCenter(attr, a, b);
        const worldPosition = mesh.localToWorld(tempVectorJ.copy(center));
        handle.object.position.copy(center);
        handle.referencePositionLocal.copy(center);
        handle.referencePositionWorld.copy(worldPosition);
        break;
      }
      case 'face': {
        const { centroid, normal } = this.computeFaceGroupAttributes(attr, handle.indices);
        const worldPosition = mesh.localToWorld(centroid.clone());
        const worldNormal = this.transformNormalToWorld(normal.clone(), mesh);
        this.updateFaceHandleGeometry(handle, attr, centroid, normal);
        handle.object.position.copy(centroid);
        handle.referencePositionLocal.copy(centroid);
        handle.referencePositionWorld.copy(worldPosition);
        if (handle.normal) {
          handle.normal.copy(worldNormal);
        }
        tempQuaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal);
        handle.object.quaternion.copy(tempQuaternion);
        break;
      }
    }
  }
  selectHandlesInRect(bounds: NormalizedSelectionRect, options: SelectionOptions = {}) {
    const handlesInRect: HandleDescriptor[] = [];
    const camera = this.rendererManager.camera;
    for (const handle of this.handles) {
      if (!handle.object.visible) continue;
      handle.object.getWorldPosition(tempVectorG);
      tempVectorG.project(camera);
      if (tempVectorG.z < -1 || tempVectorG.z > 1) continue;
      if (
        tempVectorG.x >= bounds.minX &&
        tempVectorG.x <= bounds.maxX &&
        tempVectorG.y >= bounds.minY &&
        tempVectorG.y <= bounds.maxY
      ) {
        handlesInRect.push(handle);
      }
    }
    if (handlesInRect.length === 0) {
      return 0;
    }
    this.selectHandles(handlesInRect, options);
    return handlesInRect.length;
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

  handlePointer(intersections: Intersection[], event?: PointerEvent) {
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
    const toggle = !!(event?.ctrlKey || event?.metaKey);
    const additive = !!event?.shiftKey && !toggle;
    if (!match) {
      if (!additive && !toggle) {
        this.clearSelection();
      }
      return false;
    }

    const object = match.object as Mesh;
    const handle = this.handles.find((entry) => entry.object === object);
    if (!handle || !handle.object.visible) {
      if (!additive && !toggle) {
        this.clearSelection();
      }
      return false;
    }

    this.selectHandles([handle], { additive, toggle });
    return true;
  }

  isTransforming() {
    return this.dragging;
  }
}
