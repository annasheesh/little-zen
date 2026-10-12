export type InputSource = 'pointer' | 'air-rake';

export interface GardenInputEvent {
  source: InputSource;
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
  timestamp?: number;
}

export interface InputHandler {
  onStrokeStart(e: GardenInputEvent): void;
  onStrokeMove(e: GardenInputEvent): void;
  onStrokeEnd(e: GardenInputEvent): void;
  onStrokeCancel(source: InputSource): void;
}
