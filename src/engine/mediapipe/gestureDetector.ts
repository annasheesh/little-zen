import { HandLandmarks } from './types';

export interface GestureDetectorConfig {
  pinchThreshold: number;        // Scale-invariant threshold to trigger pinch
  pinchReleaseThreshold: number; // Scale-invariant threshold to release pinch
  confirmationFrames?: number;   // Frames of consecutive detection required
}

export class GestureDetector {
  private isPinching = false;
  private consecutivePinchFrames = 0;
  private consecutiveReleaseFrames = 0;

  private config: GestureDetectorConfig;

  constructor(config?: Partial<GestureDetectorConfig>) {
    this.config = {
      pinchThreshold: config?.pinchThreshold ?? 0.24,
      pinchReleaseThreshold: config?.pinchReleaseThreshold ?? 0.36,
      confirmationFrames: config?.confirmationFrames ?? 2
    };
  }

  public updateConfig(config: Partial<GestureDetectorConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Processes landmarks to detect pinch state with scale invariance and hysteresis
   */
  public evaluate(landmarks: HandLandmarks): {
    isPinching: boolean;
    normalizedDistance: number;
    indexFingertip: { x: number; y: number };
    thumbTip: { x: number; y: number };
  } {
    // Landmark 0: Wrist
    // Landmark 4: Thumb tip
    // Landmark 8: Index fingertip
    // Landmark 9: Middle MCP (palm center reference)
    const wrist = landmarks[0] || { x: 0.5, y: 0.8, z: 0 };
    const thumbTip = landmarks[4] || { x: 0.5, y: 0.5, z: 0 };
    const indexTip = landmarks[8] || { x: 0.5, y: 0.5, z: 0 };
    const middleMcp = landmarks[9] || { x: 0.5, y: 0.6, z: 0 };

    // Hand scale metric: distance from wrist to middle finger MCP
    const handScale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.2;

    // Euclidean distance between thumb tip and index fingertip
    const rawDistance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);

    // Scale-invariant pinch metric
    const normalizedDistance = rawDistance / handScale;

    // Hysteresis logic
    if (!this.isPinching) {
      if (normalizedDistance <= this.config.pinchThreshold) {
        this.consecutivePinchFrames++;
        if (this.consecutivePinchFrames >= (this.config.confirmationFrames || 2)) {
          this.isPinching = true;
          this.consecutiveReleaseFrames = 0;
        }
      } else {
        this.consecutivePinchFrames = 0;
      }
    } else {
      if (normalizedDistance >= this.config.pinchReleaseThreshold) {
        this.consecutiveReleaseFrames++;
        if (this.consecutiveReleaseFrames >= (this.config.confirmationFrames || 2)) {
          this.isPinching = false;
          this.consecutivePinchFrames = 0;
        }
      } else {
        this.consecutiveReleaseFrames = 0;
      }
    }

    return {
      isPinching: this.isPinching,
      normalizedDistance,
      indexFingertip: { x: indexTip.x, y: indexTip.y },
      thumbTip: { x: thumbTip.x, y: thumbTip.y }
    };
  }

  public reset() {
    this.isPinching = false;
    this.consecutivePinchFrames = 0;
    this.consecutiveReleaseFrames = 0;
  }
}
