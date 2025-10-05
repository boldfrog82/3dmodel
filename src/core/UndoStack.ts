import { SceneManager } from './SceneManager';

interface StateEntry {
  data: string;
}

export class UndoStack {
  private undoStack: StateEntry[] = [];
  private redoStack: StateEntry[] = [];
  private maxStates = 32;
  private sceneManager?: SceneManager;

  bind(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    void this.capture();
  }

  async capture() {
    if (!this.sceneManager) return;
    const data = await this.sceneManager.serialize();
    if (this.undoStack.length && this.undoStack[this.undoStack.length - 1].data === data) {
      return;
    }
    this.undoStack.push({ data });
    if (this.undoStack.length > this.maxStates) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  async undo() {
    if (!this.sceneManager || this.undoStack.length <= 1) return;
    const current = this.undoStack.pop();
    if (!current) return;
    const previous = this.undoStack[this.undoStack.length - 1];
    if (!previous) return;
    this.redoStack.push(current);
    await this.sceneManager.importFromString(previous.data);
  }

  async redo() {
    if (!this.sceneManager || this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    if (!next) return;
    await this.sceneManager.importFromString(next.data);
    this.undoStack.push(next);
  }
}
