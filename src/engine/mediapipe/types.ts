export interface Landmark {
  x: number; // 0..1
  y: number; // 0..1
  z: number;
}

export type HandLandmarks = Landmark[];

export interface HandDetectionResult {
  landmarks: HandLandmarks;
  confidence: number;
}

export interface AirRakeState {
  isActive: boolean;
  isPinching: boolean;
  cursorPos: { x: number; y: number } | null; // Normalized garden coordinates 0..1
  pinchDistance: number;
  handPresent: boolean;
}
