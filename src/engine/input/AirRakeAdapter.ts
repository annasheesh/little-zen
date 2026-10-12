import { InputHandler } from './types';
import { AirRakeState } from '../mediapipe/types';
import { HandTracker } from '../mediapipe/HandTracker';

export class AirRakeAdapter {
  private handler: InputHandler;
  private tracker: HandTracker;
  private isCurrentlyPinching = false;
  private lastCursorPos: { x: number; y: number } | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(handler: InputHandler, tracker: HandTracker) {
    this.handler = handler;
    this.tracker = tracker;
  }

  public attach() {
    this.detach();
    this.unsubscribe = this.tracker.onState(this.handleTrackerState);
  }

  public detach() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.isCurrentlyPinching) {
      if (this.lastCursorPos) {
        this.handler.onStrokeEnd({
          source: 'air-rake',
          x: this.lastCursorPos.x,
          y: this.lastCursorPos.y,
          timestamp: performance.now()
        });
      } else {
        this.handler.onStrokeCancel('air-rake');
      }
      this.isCurrentlyPinching = false;
    }
    this.lastCursorPos = null;
  }

  private handleTrackerState = (state: AirRakeState) => {
    // 1. Tracking lost or hand off camera
    if (!state.handPresent || !state.cursorPos) {
      if (this.isCurrentlyPinching) {
        if (this.lastCursorPos) {
          this.handler.onStrokeEnd({
            source: 'air-rake',
            x: this.lastCursorPos.x,
            y: this.lastCursorPos.y,
            timestamp: performance.now()
          });
        } else {
          this.handler.onStrokeCancel('air-rake');
        }
        this.isCurrentlyPinching = false;
      }
      this.lastCursorPos = null;
      return;
    }

    const { x, y } = state.cursorPos;
    this.lastCursorPos = { x, y };

    // 2. Pinch start
    if (state.isPinching && !this.isCurrentlyPinching) {
      this.isCurrentlyPinching = true;
      this.handler.onStrokeStart({
        source: 'air-rake',
        x,
        y,
        timestamp: performance.now()
      });
      return;
    }

    // 3. Pinch move
    if (state.isPinching && this.isCurrentlyPinching) {
      this.handler.onStrokeMove({
        source: 'air-rake',
        x,
        y,
        timestamp: performance.now()
      });
      return;
    }

    // 4. Pinch release
    if (!state.isPinching && this.isCurrentlyPinching) {
      this.isCurrentlyPinching = false;
      this.handler.onStrokeEnd({
        source: 'air-rake',
        x,
        y,
        timestamp: performance.now()
      });
    }
  };
}
