import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureDetector } from './gestureDetector';
import { PointSmoother } from './smoothing';
import { AirRakeState, HandLandmarks } from './types';
import { AirRakeSettings } from '../../types/garden';

export type StateCallback = (state: AirRakeState) => void;
export type StatusCallback = (status: 'idle' | 'initializing' | 'tracking' | 'hand-lost' | 'denied' | 'error', errorMsg?: string) => void;

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private isRunning = false;
  private animFrameId: number | null = null;
  private lastVideoTime = -1;

  private gestureDetector: GestureDetector;
  private smoother: PointSmoother;

  private stateCallbacks: Set<StateCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();

  private settings: AirRakeSettings;

  constructor(settings: AirRakeSettings) {
    this.settings = settings;
    this.gestureDetector = new GestureDetector({
      pinchThreshold: settings.pinchThreshold,
      pinchReleaseThreshold: settings.pinchReleaseThreshold
    });
    this.smoother = new PointSmoother();
    this.smoother.setSensitivity(settings.cursorSmoothing);
  }

  public updateSettings(settings: AirRakeSettings) {
    this.settings = settings;
    this.gestureDetector.updateConfig({
      pinchThreshold: settings.pinchThreshold,
      pinchReleaseThreshold: settings.pinchReleaseThreshold
    });
    this.smoother.setSensitivity(settings.cursorSmoothing);
  }

  public onState(cb: StateCallback): () => void {
    this.stateCallbacks.add(cb);
    return () => this.stateCallbacks.delete(cb);
  }

  public onStatus(cb: StatusCallback): () => void {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  private notifyState(state: AirRakeState) {
    for (const cb of this.stateCallbacks) {
      cb(state);
    }
  }

  private notifyStatus(status: 'idle' | 'initializing' | 'tracking' | 'hand-lost' | 'denied' | 'error', errorMsg?: string) {
    for (const cb of this.statusCallbacks) {
      cb(status, errorMsg);
    }
  }

  /**
   * Initializes MediaPipe HandLandmarker with offline-first local assets and CDN fallback
   */
  public async initTracker(): Promise<boolean> {
    if (this.handLandmarker) return true;

    this.notifyStatus('initializing');
    try {
      // 1. Resolve WASM assets: local bundle first, CDN fallback if needed
      let vision;
      try {
        const wasmBase = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/mediapipe/wasm`;
        vision = await FilesetResolver.forVisionTasks(wasmBase);
      } catch (localErr) {
        console.warn('Local WASM loading failed, falling back to CDN:', localErr);
        vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
      }

      // 2. Load model: local bundled task first, CDN fallback if needed
      const modelPath = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/mediapipe/hand_landmarker.task`;

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to initialize MediaPipe HandLandmarker:', err);
      this.notifyStatus('error', `MediaPipe initialization failed: ${msg}`);
      return false;
    }
  }

  /**
   * Requests camera access and begins video processing loop
   */
  public async start(videoElem?: HTMLVideoElement): Promise<boolean> {
    if (this.isRunning) return true;

    const initialized = await this.initTracker();
    if (!initialized || !this.handLandmarker) return false;

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: this.settings.cameraId
          ? { deviceId: { exact: this.settings.cameraId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoElem) {
        this.videoElement = videoElem;
      } else if (!this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
      }

      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      this.isRunning = true;
      this.lastVideoTime = -1;
      this.smoother.reset();
      this.gestureDetector.reset();
      this.notifyStatus('tracking');

      this.scheduleNextFrame();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        this.notifyStatus('denied', 'Camera permission was denied.');
      } else {
        this.notifyStatus('error', `Camera access error: ${msg}`);
      }
      this.stop();
      return false;
    }
  }

  public attachVideoElement(elem: HTMLVideoElement) {
    this.videoElement = elem;
    if (this.stream) {
      this.videoElement.srcObject = this.stream;
      this.videoElement.play().catch(() => {});
    }
  }

  private scheduleNextFrame() {
    if (!this.isRunning) return;

    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype && this.videoElement) {
      // Modern efficient frame scheduling synchronized with camera hardware
      this.videoElement.requestVideoFrameCallback(() => {
        this.processFrame();
        this.scheduleNextFrame();
      });
    } else {
      // Fallback
      this.animFrameId = requestAnimationFrame(() => {
        this.processFrame();
        this.scheduleNextFrame();
      });
    }
  }

  private processFrame() {
    if (!this.isRunning || !this.videoElement || !this.handLandmarker) return;

    const video = this.videoElement;
    if (video.readyState < 2 || video.paused || video.ended) return;

    const now = performance.now();
    if (video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;

    try {
      const results = this.handLandmarker.detectForVideo(video, now);

      if (results.landmarks && results.landmarks.length > 0) {
        const rawLandmarks = results.landmarks[0] as HandLandmarks;
        const gesture = this.gestureDetector.evaluate(rawLandmarks);

        // Map coordinates:
        // By default MediaPipe landmark coordinates are 0..1 in video space.
        // If mirrored: user expects moving hand left to move cursor left on screen.
        // In unmirrored camera, physical hand moving left moves to camera's right.
        // So mirrored mode inverts x: (1 - x).
        let rawX = this.settings.mirrored ? (1 - gesture.indexFingertip.x) : gesture.indexFingertip.x;
        let rawY = gesture.indexFingertip.y;

        // Apply sensitivity scaling around center (0.5, 0.5)
        const sens = this.settings.cursorSensitivity;
        let mappedX = 0.5 + (rawX - 0.5) * sens;
        let mappedY = 0.5 + (rawY - 0.5) * sens;

        // Clamp to garden bounds [0, 1]
        mappedX = Math.max(0, Math.min(1, mappedX));
        mappedY = Math.max(0, Math.min(1, mappedY));

        // Filter through One Euro filter for low-latency jitter-free stability
        const smoothed = this.smoother.smooth(mappedX, mappedY, now);

        this.notifyState({
          isActive: true,
          isPinching: gesture.isPinching,
          cursorPos: smoothed,
          pinchDistance: gesture.normalizedDistance,
          handPresent: true
        });
      } else {
        // Hand not detected in this frame
        this.notifyState({
          isActive: true,
          isPinching: false,
          cursorPos: null,
          pinchDistance: 1.0,
          handPresent: false
        });
      }
    } catch {
      // Catch inference transient errors gracefully
    }
  }

  /**
   * Safely stops the camera stream, releases tracks, and cleans up resources
   */
  public stop() {
    this.isRunning = false;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.smoother.reset();
    this.gestureDetector.reset();

    this.notifyState({
      isActive: false,
      isPinching: false,
      cursorPos: null,
      pinchDistance: 1.0,
      handPresent: false
    });

    this.notifyStatus('idle');
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }
}
