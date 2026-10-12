import {
  ToolType,
  RakeConfig,
  GardenGrooveElement,
  FreehandStroke,
  CirclePattern,
  LinePattern,
  WavePattern,
  SpiralPattern,
  GardenStone,
  Point,
  StoneType
} from '../types/garden';
import { GardenInputEvent, InputHandler, InputSource } from './input/types';

export interface RakeEngineOptions {
  onStateChange?: () => void;
  onRakingActivity?: (active: boolean, speed?: number) => void;
}

export class RakeEngine implements InputHandler {
  // Elements and stones
  private elements: GardenGrooveElement[] = [];
  private stones: GardenStone[] = [];

  // Active in-progress stroke/pattern preview
  private activeElement: GardenGrooveElement | null = null;
  private activeSource: InputSource | null = null;
  private startPoint: Point | null = null;
  private lastPoint: Point | null = null;

  // Stone interaction
  private selectedStoneId: string | null = null;
  private stoneDragMode: 'none' | 'move' | 'resize' | 'rotate' = 'none';
  private stoneDragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private initialStoneState: GardenStone | null = null;

  // Active Tool and Rake Config
  private currentTool: ToolType = 'rake';
  private rakeConfig: RakeConfig = {
    preset: 'classic',
    prongCount: 3,
    prongSpacing: 0.012,
    grooveWidth: 0.006,
    depth: 1.0
  };

  // Undo / Redo History Stack
  private history: { elements: GardenGrooveElement[]; stones: GardenStone[] }[] = [];
  private redoStack: { elements: GardenGrooveElement[]; stones: GardenStone[] }[] = [];
  private maxHistory = 40;

  // Listeners
  private onStateChange?: () => void;
  private onRakingActivity?: (active: boolean, speed?: number) => void;

  constructor(options?: RakeEngineOptions) {
    this.onStateChange = options?.onStateChange;
    this.onRakingActivity = options?.onRakingActivity;
    this.saveHistory();
  }

  // --- Configuration ---

  public setTool(tool: ToolType) {
    this.currentTool = tool;
    if (tool !== 'stone') {
      this.selectedStoneId = null;
    }
    this.notifyChange();
  }

  public getTool(): ToolType {
    return this.currentTool;
  }

  public setRakeConfig(config: RakeConfig) {
    this.rakeConfig = config;
    this.notifyChange();
  }

  public getRakeConfig(): RakeConfig {
    return this.rakeConfig;
  }

  public getElements(): GardenGrooveElement[] {
    return this.elements;
  }

  public getActiveElement(): GardenGrooveElement | null {
    return this.activeElement;
  }

  public getStones(): GardenStone[] {
    return this.stones;
  }

  public getSelectedStoneId(): string | null {
    return this.selectedStoneId;
  }

  public setSelectedStoneId(id: string | null) {
    this.selectedStoneId = id;
    this.notifyChange();
  }

  public setGardenState(elements: GardenGrooveElement[], stones: GardenStone[]) {
    this.elements = JSON.parse(JSON.stringify(elements));
    this.stones = JSON.parse(JSON.stringify(stones));
    this.activeElement = null;
    this.selectedStoneId = null;
    this.saveHistory();
    this.notifyChange();
  }

  // --- Input Handlers (Shared Architecture) ---

  public onStrokeStart(e: GardenInputEvent): void {
    // Input priority arbitration: lock to first active source
    if (this.activeSource !== null && this.activeSource !== e.source) {
      return;
    }

    this.activeSource = e.source;
    this.startPoint = { x: e.x, y: e.y, time: e.timestamp ?? performance.now() };
    this.lastPoint = { ...this.startPoint };

    // Stone tool handling
    if (this.currentTool === 'stone') {
      this.handleStoneStart(e.x, e.y);
      return;
    }

    // Groove creation handling
    this.onRakingActivity?.(true, 1);

    switch (this.currentTool) {
      case 'rake': {
        const prongOffsets = this.computeProngOffsets(
          this.rakeConfig.prongCount,
          this.rakeConfig.prongSpacing
        );
        this.activeElement = {
          id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          type: 'freehand',
          points: [{ x: e.x, y: e.y, time: performance.now() }],
          prongOffsets,
          grooveWidth: this.rakeConfig.grooveWidth,
          depth: this.rakeConfig.depth
        };
        break;
      }

      case 'circle': {
        this.activeElement = {
          id: `circle-${Date.now()}`,
          type: 'circle',
          centerX: e.x,
          centerY: e.y,
          innerRadius: 0.02,
          ringCount: 3,
          ringSpacing: 0.015,
          grooveWidth: this.rakeConfig.grooveWidth,
          depth: this.rakeConfig.depth
        };
        break;
      }

      case 'line': {
        this.activeElement = {
          id: `line-${Date.now()}`,
          type: 'line',
          startX: e.x,
          startY: e.y,
          endX: e.x,
          endY: e.y,
          lineCount: 4,
          lineSpacing: 0.015,
          grooveWidth: this.rakeConfig.grooveWidth,
          depth: this.rakeConfig.depth
        };
        break;
      }

      case 'wave': {
        this.activeElement = {
          id: `wave-${Date.now()}`,
          type: 'wave',
          startX: e.x,
          startY: e.y,
          endX: e.x,
          endY: e.y,
          amplitude: 0.025,
          frequency: 3.5,
          lineCount: 3,
          lineSpacing: 0.015,
          grooveWidth: this.rakeConfig.grooveWidth,
          depth: this.rakeConfig.depth
        };
        break;
      }

      case 'spiral': {
        this.activeElement = {
          id: `spiral-${Date.now()}`,
          type: 'spiral',
          centerX: e.x,
          centerY: e.y,
          radius: 0.02,
          turns: 3,
          grooveWidth: this.rakeConfig.grooveWidth,
          depth: this.rakeConfig.depth
        };
        break;
      }

      case 'smooth': {
        this.eraseNearPoint(e.x, e.y, 0.04);
        break;
      }
    }

    this.notifyChange();
  }

  public onStrokeMove(e: GardenInputEvent): void {
    if (this.activeSource !== e.source || !this.startPoint || !this.lastPoint) {
      return;
    }

    const dist = Math.hypot(e.x - this.lastPoint.x, e.y - this.lastPoint.y);
    const speed = Math.min(3, Math.max(0.2, dist * 50));
    this.onRakingActivity?.(true, speed);

    if (this.currentTool === 'stone') {
      this.handleStoneMove(e.x, e.y);
      this.lastPoint = { x: e.x, y: e.y };
      return;
    }

    switch (this.currentTool) {
      case 'rake': {
        if (this.activeElement && this.activeElement.type === 'freehand') {
          // Distance filtering to prevent over-clustering points
          if (dist > 0.002) {
            this.activeElement.points.push({ x: e.x, y: e.y, time: performance.now() });
            this.lastPoint = { x: e.x, y: e.y };
            this.notifyChange();
          }
        }
        break;
      }

      case 'circle': {
        if (this.activeElement && this.activeElement.type === 'circle') {
          const r = Math.hypot(e.x - this.startPoint.x, e.y - this.startPoint.y);
          this.activeElement.ringCount = Math.max(1, Math.min(8, Math.floor(r / 0.02)));
          this.notifyChange();
        }
        break;
      }

      case 'line': {
        if (this.activeElement && this.activeElement.type === 'line') {
          this.activeElement.endX = e.x;
          this.activeElement.endY = e.y;
          this.notifyChange();
        }
        break;
      }

      case 'wave': {
        if (this.activeElement && this.activeElement.type === 'wave') {
          this.activeElement.endX = e.x;
          this.activeElement.endY = e.y;
          this.notifyChange();
        }
        break;
      }

      case 'spiral': {
        if (this.activeElement && this.activeElement.type === 'spiral') {
          const r = Math.hypot(e.x - this.startPoint.x, e.y - this.startPoint.y);
          this.activeElement.radius = Math.max(0.02, r);
          this.notifyChange();
        }
        break;
      }

      case 'smooth': {
        this.eraseNearPoint(e.x, e.y, 0.04);
        this.notifyChange();
        break;
      }
    }
  }

  public onStrokeEnd(e: GardenInputEvent): void {
    if (this.activeSource !== e.source) return;

    this.onRakingActivity?.(false);

    if (this.currentTool === 'stone') {
      this.handleStoneEnd();
      this.resetStrokeState();
      return;
    }

    if (this.activeElement) {
      // Validate element length
      let valid = true;
      if (this.activeElement.type === 'freehand') {
        valid = this.activeElement.points.length >= 2;
      } else if (this.activeElement.type === 'line' || this.activeElement.type === 'wave') {
        const d = Math.hypot(
          this.activeElement.endX - this.activeElement.startX,
          this.activeElement.endY - this.activeElement.startY
        );
        valid = d > 0.015;
      }

      if (valid) {
        this.elements.push(this.activeElement);
        this.saveHistory();
      }
    } else if (this.currentTool === 'smooth') {
      this.saveHistory();
    }

    this.resetStrokeState();
    this.notifyChange();
  }

  public onStrokeCancel(source: InputSource): void {
    if (this.activeSource === source) {
      this.onRakingActivity?.(false);
      // If stone was being dragged, revert to initial state
      if (this.initialStoneState && this.selectedStoneId) {
        const idx = this.stones.findIndex((s) => s.id === this.selectedStoneId);
        if (idx !== -1) {
          this.stones[idx] = { ...this.initialStoneState };
        }
      }
      this.resetStrokeState();
      this.notifyChange();
    }
  }

  private resetStrokeState() {
    this.activeElement = null;
    this.activeSource = null;
    this.startPoint = null;
    this.lastPoint = null;
    this.stoneDragMode = 'none';
    this.initialStoneState = null;
  }

  // --- Stone Interaction Logic ---

  private handleStoneStart(x: number, y: number) {
    // Check if clicked an existing stone
    let clickedStone: GardenStone | null = null;
    for (let i = this.stones.length - 1; i >= 0; i--) {
      const s = this.stones[i];
      const dist = Math.hypot((x - s.x) / s.radiusX, (y - s.y) / s.radiusY);
      if (dist <= 1.2) {
        clickedStone = s;
        break;
      }
    }

    if (clickedStone) {
      this.selectedStoneId = clickedStone.id;
      this.initialStoneState = JSON.parse(JSON.stringify(clickedStone));
      this.stoneDragMode = 'move';
      this.stoneDragOffset = {
        x: x - clickedStone.x,
        y: y - clickedStone.y
      };
    } else {
      this.selectedStoneId = null;
      this.stoneDragMode = 'none';
    }
    this.notifyChange();
  }

  private handleStoneMove(x: number, y: number) {
    if (!this.selectedStoneId || this.stoneDragMode === 'none') return;
    const stone = this.stones.find((s) => s.id === this.selectedStoneId);
    if (!stone) return;

    if (this.stoneDragMode === 'move') {
      stone.x = Math.max(0.05, Math.min(0.95, x - this.stoneDragOffset.x));
      stone.y = Math.max(0.05, Math.min(0.95, y - this.stoneDragOffset.y));
      this.notifyChange();
    }
  }

  private handleStoneEnd() {
    if (this.selectedStoneId && this.stoneDragMode === 'move') {
      this.saveHistory();
    }
  }

  public addStone(type: StoneType = 'dark-river', x = 0.5, y = 0.5) {
    const newStone: GardenStone = {
      id: `stone-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      x,
      y,
      radiusX: type === 'pebble' ? 0.025 : 0.055 + Math.random() * 0.02,
      radiusY: type === 'pebble' ? 0.02 : 0.045 + Math.random() * 0.015,
      rotation: Math.random() * Math.PI * 2,
      seed: Math.floor(Math.random() * 100000),
      moss: Math.random() > 0.4 ? [
        { offsetX: 0.3, offsetY: 0.3, radius: 0.015, opacity: 0.7 }
      ] : []
    };

    this.stones.push(newStone);
    this.selectedStoneId = newStone.id;
    this.saveHistory();
    this.notifyChange();
  }

  public removeSelectedStone() {
    if (!this.selectedStoneId) return;
    this.stones = this.stones.filter((s) => s.id !== this.selectedStoneId);
    this.selectedStoneId = null;
    this.saveHistory();
    this.notifyChange();
  }

  public rotateSelectedStone(deltaAngle: number) {
    if (!this.selectedStoneId) return;
    const s = this.stones.find((stone) => stone.id === this.selectedStoneId);
    if (s) {
      s.rotation += deltaAngle;
      this.saveHistory();
      this.notifyChange();
    }
  }

  public resizeSelectedStone(scaleFactor: number) {
    if (!this.selectedStoneId) return;
    const s = this.stones.find((stone) => stone.id === this.selectedStoneId);
    if (s) {
      s.radiusX = Math.max(0.015, Math.min(0.2, s.radiusX * scaleFactor));
      s.radiusY = Math.max(0.015, Math.min(0.2, s.radiusY * scaleFactor));
      this.saveHistory();
      this.notifyChange();
    }
  }

  // --- Smooth / Erasing Logic ---

  private eraseNearPoint(x: number, y: number, radius = 0.04) {
    // Locally erase freehand points near (x, y)
    this.elements = this.elements.filter((el) => {
      if (el.type === 'freehand') {
        el.points = el.points.filter((pt) => Math.hypot(pt.x - x, pt.y - y) > radius);
        return el.points.length >= 2;
      }
      if (el.type === 'circle') {
        const d = Math.hypot(el.centerX - x, el.centerY - y);
        return Math.abs(d - el.innerRadius) > radius;
      }
      if (el.type === 'line' || el.type === 'wave') {
        const midX = (el.startX + el.endX) / 2;
        const midY = (el.startY + el.endY) / 2;
        return Math.hypot(midX - x, midY - y) > radius * 1.5;
      }
      if (el.type === 'spiral') {
        return Math.hypot(el.centerX - x, el.centerY - y) > radius * 1.5;
      }
      return true;
    });
  }

  public clearGarden() {
    this.elements = [];
    this.saveHistory();
    this.notifyChange();
  }

  // --- Multi-prong Rake Offset Math ---

  private computeProngOffsets(count: number, spacing: number): number[] {
    const offsets: number[] = [];
    const half = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      offsets.push((i - half) * spacing);
    }
    return offsets;
  }

  // --- Undo / Redo History ---

  private saveHistory() {
    const snapshot = {
      elements: JSON.parse(JSON.stringify(this.elements)),
      stones: JSON.parse(JSON.stringify(this.stones))
    };
    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.redoStack = [];
  }

  public undo(): boolean {
    if (this.history.length <= 1) return false;

    const current = this.history.pop()!;
    this.redoStack.push(current);

    const prev = this.history[this.history.length - 1];
    this.elements = JSON.parse(JSON.stringify(prev.elements));
    this.stones = JSON.parse(JSON.stringify(prev.stones));
    this.selectedStoneId = null;
    this.notifyChange();
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;

    const next = this.redoStack.pop()!;
    this.history.push(next);

    this.elements = JSON.parse(JSON.stringify(next.elements));
    this.stones = JSON.parse(JSON.stringify(next.stones));
    this.selectedStoneId = null;
    this.notifyChange();
    return true;
  }

  public canUndo(): boolean {
    return this.history.length > 1;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private notifyChange() {
    this.onStateChange?.();
  }
}
