/**
 * 1€ Filter (One Euro Filter)
 * Designed by Géry Casiez, Nicolas Roussel, Daniel Vogel.
 * Provides high precision at low speed (reducing jitter) and low latency at high speed.
 */

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  public filter(val: number, alpha: number): number {
    if (this.y === null) {
      this.s = val;
      this.y = val;
      return val;
    }
    this.s = alpha * val + (1 - alpha) * (this.s ?? val);
    this.y = this.s;
    return this.y;
  }

  public lastValue(): number | null {
    return this.y;
  }

  public reset() {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private lastTime: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
  }

  private alpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  public filter(val: number, timestamp = performance.now()): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilter.filter(val, 1.0);
    }

    const dt = (timestamp - this.lastTime) / 1000.0;
    this.lastTime = timestamp;

    if (dt <= 0) {
      return this.xFilter.lastValue() ?? val;
    }

    const rate = 1.0 / dt;
    const prevX = this.xFilter.lastValue();
    const dx = prevX !== null ? (val - prevX) * rate : 0;
    const edx = this.dxFilter.filter(dx, this.alpha(rate, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    return this.xFilter.filter(val, this.alpha(rate, cutoff));
  }

  public reset() {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }

  public updateParameters(minCutoff: number, beta: number) {
    this.minCutoff = minCutoff;
    this.beta = beta;
  }
}

export class PointSmoother {
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;

  constructor(minCutoff = 1.2, beta = 0.01) {
    this.filterX = new OneEuroFilter(minCutoff, beta);
    this.filterY = new OneEuroFilter(minCutoff, beta);
  }

  public smooth(x: number, y: number, timestamp = performance.now()): { x: number; y: number } {
    return {
      x: this.filterX.filter(x, timestamp),
      y: this.filterY.filter(y, timestamp)
    };
  }

  public reset() {
    this.filterX.reset();
    this.filterY.reset();
  }

  public setSensitivity(smoothing: number) {
    // smoothing: 0 (fast/jittery) to 1 (very smooth/slightly more lag)
    const minCutoff = Math.max(0.2, 3.0 * (1 - smoothing));
    const beta = Math.max(0.001, 0.03 * (1 - smoothing));
    this.filterX.updateParameters(minCutoff, beta);
    this.filterY.updateParameters(minCutoff, beta);
  }
}
