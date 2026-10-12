import { InputHandler } from './types';

export class MouseTouchAdapter {
  private element: HTMLElement | null = null;
  private handler: InputHandler;
  private isPointerDown = false;
  private activePointerId: number | null = null;

  constructor(handler: InputHandler) {
    this.handler = handler;
  }

  public attach(elem: HTMLElement) {
    this.detach();
    this.element = elem;

    elem.addEventListener('pointerdown', this.onPointerDown);
    elem.addEventListener('pointermove', this.onPointerMove);
    elem.addEventListener('pointerup', this.onPointerUp);
    elem.addEventListener('pointercancel', this.onPointerCancel);
    elem.addEventListener('contextmenu', this.onContextMenu);
  }

  public detach() {
    if (!this.element) return;
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerCancel);
    this.element.removeEventListener('contextmenu', this.onContextMenu);
    this.element = null;
    this.isPointerDown = false;
    this.activePointerId = null;
  }

  private getNormalizedCoordinates(e: PointerEvent): { x: number; y: number } | null {
    if (!this.element) return null;
    const rect = this.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y))
    };
  }

  private onPointerDown = (e: PointerEvent) => {
    // Only primary button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const coords = this.getNormalizedCoordinates(e);
    if (!coords) return;

    this.isPointerDown = true;
    this.activePointerId = e.pointerId;

    try {
      this.element?.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    this.handler.onStrokeStart({
      source: 'pointer',
      x: coords.x,
      y: coords.y,
      timestamp: performance.now()
    });
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isPointerDown || (this.activePointerId !== null && e.pointerId !== this.activePointerId)) {
      return;
    }

    const coords = this.getNormalizedCoordinates(e);
    if (!coords) return;

    this.handler.onStrokeMove({
      source: 'pointer',
      x: coords.x,
      y: coords.y,
      timestamp: performance.now()
    });
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.isPointerDown || (this.activePointerId !== null && e.pointerId !== this.activePointerId)) {
      return;
    }

    const coords = this.getNormalizedCoordinates(e);
    this.isPointerDown = false;
    this.activePointerId = null;

    try {
      this.element?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (coords) {
      this.handler.onStrokeEnd({
        source: 'pointer',
        x: coords.x,
        y: coords.y,
        timestamp: performance.now()
      });
    }
  };

  private onPointerCancel = (_e: PointerEvent) => {
    if (this.isPointerDown) {
      this.isPointerDown = false;
      this.activePointerId = null;
      this.handler.onStrokeCancel('pointer');
    }
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };
}
