import {
  GardenGrooveElement,
  FreehandStroke,
  CirclePattern,
  LinePattern,
  WavePattern,
  SpiralPattern,
  SmoothStroke,
  GardenStone,
  Point
} from '../../types/garden';

export interface DirtyRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class SandHeightfield {
  public readonly width: number;
  public readonly height: number;
  public readonly heights: Float32Array;
  private tempBuffer: Float32Array;
  private aspectRatio: number;

  // Dirty bounding box for incremental rendering updates
  private dirtyMinX: number = 0;
  private dirtyMinY: number = 0;
  private dirtyMaxX: number = 0;
  private dirtyMaxY: number = 0;
  private hasDirty: boolean = false;

  constructor(width = 1024, height = 768, aspectRatio?: number) {
    this.width = Math.max(64, Math.floor(width));
    this.height = Math.max(64, Math.floor(height));
    this.heights = new Float32Array(this.width * this.height);
    this.tempBuffer = new Float32Array(this.width * this.height);
    this.aspectRatio = aspectRatio !== undefined && aspectRatio > 0 ? aspectRatio : this.width / this.height;
    this.markAllDirty();
  }

  public setAspectRatio(ratio: number): void {
    if (ratio > 0 && Math.abs(this.aspectRatio - ratio) > 1e-4) {
      this.aspectRatio = ratio;
      this.markAllDirty();
    }
  }

  public getAspectRatio(): number {
    return this.aspectRatio;
  }

  public reset(): void {
    this.heights.fill(0);
    this.markAllDirty();
  }

  public markAllDirty(): void {
    this.dirtyMinX = 0;
    this.dirtyMinY = 0;
    this.dirtyMaxX = this.width - 1;
    this.dirtyMaxY = this.height - 1;
    this.hasDirty = true;
  }

  public expandDirty(gx0: number, gy0: number, gx1: number, gy1: number): void {
    const cMinX = Math.max(0, Math.min(this.width - 1, Math.floor(gx0)));
    const cMinY = Math.max(0, Math.min(this.height - 1, Math.floor(gy0)));
    const cMaxX = Math.max(0, Math.min(this.width - 1, Math.ceil(gx1)));
    const cMaxY = Math.max(0, Math.min(this.height - 1, Math.ceil(gy1)));

    if (!this.hasDirty) {
      this.dirtyMinX = cMinX;
      this.dirtyMinY = cMinY;
      this.dirtyMaxX = cMaxX;
      this.dirtyMaxY = cMaxY;
      this.hasDirty = true;
    } else {
      this.dirtyMinX = Math.min(this.dirtyMinX, cMinX);
      this.dirtyMinY = Math.min(this.dirtyMinY, cMinY);
      this.dirtyMaxX = Math.max(this.dirtyMaxX, cMaxX);
      this.dirtyMaxY = Math.max(this.dirtyMaxY, cMaxY);
    }
  }

  public getDirtyRect(): DirtyRect | null {
    if (!this.hasDirty) return null;
    return {
      minX: this.dirtyMinX,
      minY: this.dirtyMinY,
      maxX: this.dirtyMaxX,
      maxY: this.dirtyMaxY
    };
  }

  public clearDirty(): void {
    this.hasDirty = false;
  }

  /**
   * Clones heightfield data
   */
  public clone(): SandHeightfield {
    const copy = new SandHeightfield(this.width, this.height, this.aspectRatio);
    copy.heights.set(this.heights);
    copy.dirtyMinX = this.dirtyMinX;
    copy.dirtyMinY = this.dirtyMinY;
    copy.dirtyMaxX = this.dirtyMaxX;
    copy.dirtyMaxY = this.dirtyMaxY;
    copy.hasDirty = this.hasDirty;
    return copy;
  }

  /**
   * Restores data from another heightfield
   */
  public copyFrom(other: SandHeightfield): void {
    this.aspectRatio = other.aspectRatio;
    if (this.width === other.width && this.height === other.height) {
      this.heights.set(other.heights);
    } else {
      this.resampleFrom(other);
    }
    this.markAllDirty();
  }

  private resampleFrom(other: SandHeightfield): void {
    const w = this.width;
    const h = this.height;
    const ow = other.width;
    const oh = other.height;

    for (let y = 0; y < h; y++) {
      const v = (y / (h - 1)) * (oh - 1);
      const y0 = Math.floor(v);
      const y1 = Math.min(oh - 1, y0 + 1);
      const fy = v - y0;

      for (let x = 0; x < w; x++) {
        const u = (x / (w - 1)) * (ow - 1);
        const x0 = Math.floor(u);
        const x1 = Math.min(ow - 1, x0 + 1);
        const fx = u - x0;

        const h00 = other.heights[y0 * ow + x0];
        const h10 = other.heights[y0 * ow + x1];
        const h01 = other.heights[y1 * ow + x0];
        const h11 = other.heights[y1 * ow + x1];

        const top = h00 * (1 - fx) + h10 * fx;
        const bot = h01 * (1 - fx) + h11 * fx;
        this.heights[y * w + x] = top * (1 - fy) + bot * fy;
      }
    }
  }

  // --- Core Physical Granular Sand Carving Math ---

  /**
   * Sweeps a multi-prong rake along a line segment P0 -> P1.
   * Uses aspect-corrected isotropic normals and physics-based volume displacement.
   * Correctly prevents multi-point consecutive segment berm runaway accumulation.
   */
  public carveRakeSegment(
    p0: Point,
    p1: Point,
    prongOffsets: number[],
    grooveWidth: number,
    depth: number,
    stones?: GardenStone[],
    normalOverride?: { nx: number; ny: number }
  ): void {
    const aspect = this.aspectRatio;
    const dxIso = (p1.x - p0.x) * aspect;
    const dyIso = p1.y - p0.y;
    const lenIso = Math.hypot(dxIso, dyIso);

    let nxNorm = 0;
    let nyNorm = 1;
    if (normalOverride) {
      nxNorm = normalOverride.nx;
      nyNorm = normalOverride.ny;
    } else if (lenIso > 1e-6) {
      // Isotropic unit normal scaled back to normalized coordinates
      nxNorm = (-dyIso / lenIso) / aspect;
      nyNorm = dxIso / lenIso;
    }

    const tineRadius = Math.max(0.002, grooveWidth * 0.6);
    const bermWidth = tineRadius * 1.25;
    const tineDepth = Math.max(0.1, depth * 0.4);
    const bermHeight = tineDepth * 0.45;

    const prongs = prongOffsets.length > 0 ? prongOffsets : [0];

    // Build tine segment list
    interface TineSegment {
      sp0x: number;
      sp0y: number;
      sp1x: number;
      sp1y: number;
    }
    const tines: TineSegment[] = [];

    for (const offset of prongs) {
      tines.push({
        sp0x: p0.x + nxNorm * offset,
        sp0y: p0.y + nyNorm * offset,
        sp1x: p1.x + nxNorm * offset,
        sp1y: p1.y + nyNorm * offset
      });
    }

    const totalInfluence = tineRadius + bermWidth;
    const w = this.width;
    const h = this.height;

    // Swept bounding box in normalized coordinates
    let minXNorm = 1;
    let maxXNorm = 0;
    let minYNorm = 1;
    let maxYNorm = 0;

    for (const t of tines) {
      minXNorm = Math.min(minXNorm, t.sp0x, t.sp1x);
      maxXNorm = Math.max(maxXNorm, t.sp0x, t.sp1x);
      minYNorm = Math.min(minYNorm, t.sp0y, t.sp1y);
      maxYNorm = Math.max(maxYNorm, t.sp0y, t.sp1y);
    }

    const padX = totalInfluence / aspect;
    const padY = totalInfluence;
    const gx0 = Math.max(0, Math.floor((minXNorm - padX) * (w - 1)));
    const gx1 = Math.min(w - 1, Math.ceil((maxXNorm + padX) * (w - 1)));
    const gy0 = Math.max(0, Math.floor((minYNorm - padY) * (h - 1)));
    const gy1 = Math.min(h - 1, Math.ceil((maxYNorm + padY) * (h - 1)));

    if (gx0 > gx1 || gy0 > gy1) return;

    const invW = 1.0 / (w - 1);
    const invH = 1.0 / (h - 1);
    const heights = this.heights;
    const maxBerm = tineDepth * 0.9;

    for (let gy = gy0; gy <= gy1; gy++) {
      const yNorm = gy * invH;
      const rowOffset = gy * w;

      for (let gx = gx0; gx <= gx1; gx++) {
        const xNorm = gx * invW;

        const stoneFactor = stones ? this.getStoneProximityFactor(xNorm, yNorm, stones) : 1.0;
        if (stoneFactor <= 0.0) {
          continue;
        }

        const pxIso = xNorm * aspect;
        const pyIso = yNorm;

        // Evaluate all tines for this cell
        let minTroughDist = 1e9;
        let bestTroughH = 1e9;
        let totalBermDelta = 0;
        let inAnyTrough = false;

        for (const t of tines) {
          const t0xIso = t.sp0x * aspect;
          const t0yIso = t.sp0y;
          const t1xIso = t.sp1x * aspect;
          const t1yIso = t.sp1y;

          const sdx = t1xIso - t0xIso;
          const sdy = t1yIso - t0yIso;
          const sLen2 = sdx * sdx + sdy * sdy;

          let distIso = 0;
          if (sLen2 < 1e-10) {
            distIso = Math.hypot(pxIso - t0xIso, pyIso - t0yIso);
          } else {
            const param = ((pxIso - t0xIso) * sdx + (pyIso - t0yIso) * sdy) / sLen2;
            const tc = param < 0 ? 0 : param > 1 ? 1 : param;
            distIso = Math.hypot(pxIso - (t0xIso + tc * sdx), pyIso - (t0yIso + tc * sdy));
          }

          if (distIso <= tineRadius) {
            inAnyTrough = true;
            if (distIso < minTroughDist) {
              minTroughDist = distIso;
              const u = distIso / tineRadius;
              const cosVal = Math.cos(Math.PI * 0.5 * u);
              bestTroughH = -tineDepth * (cosVal * cosVal);
            }
          } else if (distIso <= totalInfluence) {
            const u = (distIso - tineRadius) / bermWidth; // 0..1
            const sinVal = Math.sin(Math.PI * u);
            totalBermDelta += bermHeight * (sinVal * sinVal);
          }
        }

        const idx = rowOffset + gx;
        const curH = heights[idx];

        if (inAnyTrough) {
          // Inside trough: the tine cuts physically down through the sand.
          // Crossing strokes naturally slice through previous berms.
          const effTroughH = bestTroughH * stoneFactor;
          if (curH > effTroughH) {
            heights[idx] = effTroughH;
          } else {
            heights[idx] = Math.min(curH, effTroughH);
          }
        } else if (totalBermDelta > 0) {
          // Inside lateral berm / merged crest between tines:
          // Soft-knee rounding prevents flat mesa tabletops and sharp angular creases along ridge crests
          const knee = maxBerm * 0.70;
          let targetBerm = totalBermDelta;
          if (totalBermDelta > knee) {
            const excess = totalBermDelta - knee;
            const cap = maxBerm - knee;
            targetBerm = knee + cap * (excess / (cap + excess));
          }
          targetBerm *= stoneFactor;

          if (curH < targetBerm) {
            // Sand pushed upward to clean rounded ridge height
            heights[idx] = targetBerm;
          }
        }
      }
    }

    this.expandDirty(gx0, gy0, gx1, gy1);
  }

  /**
   * Sweeps a single tine along segment p0 -> p1
   */
  public carveTineSegment(
    p0: Point,
    p1: Point,
    tineRadius: number,
    tineDepth: number,
    bermWidth: number,
    bermHeight: number,
    stones?: GardenStone[]
  ): void {
    this.carveRakeSegment(p0, p1, [0], tineRadius / 0.6, tineDepth / 0.4, stones);
  }

  /**
   * Carves a complete FreehandStroke with smooth sub-stepping densification
   */
  public carveFreehandStroke(stroke: FreehandStroke, stones?: GardenStone[]): void {
    if (stroke.points.length < 2) return;

    const maxSubStep = 0.008;
    for (let i = 0; i < stroke.points.length - 1; i++) {
      const p0 = stroke.points[i];
      const p1 = stroke.points[i + 1];
      const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const subSteps = Math.max(1, Math.ceil(d / maxSubStep));

      for (let s = 1; s <= subSteps; s++) {
        const t0 = (s - 1) / subSteps;
        const t1 = s / subSteps;
        const subP0 = {
          x: p0.x + (p1.x - p0.x) * t0,
          y: p0.y + (p1.y - p0.y) * t0
        };
        const subP1 = {
          x: p0.x + (p1.x - p0.x) * t1,
          y: p0.y + (p1.y - p0.y) * t1
        };
        this.carveRakeSegment(
          subP0,
          subP1,
          stroke.prongOffsets,
          stroke.grooveWidth,
          stroke.depth,
          stones
        );
      }
    }

    this.applySettling(2, true);
  }

  /**
   * Carves Concentric Circles Pattern (Aspect-Correct True Circles)
   */
  public carveCirclePattern(pattern: CirclePattern, stones?: GardenStone[]): void {
    const cx = pattern.centerX;
    const cy = pattern.centerY;
    const ringCount = pattern.ringCount;
    const ringSpacing = pattern.ringSpacing;
    const innerRadius = pattern.innerRadius;
    const outerRadius = innerRadius + (ringCount - 1) * ringSpacing;

    const tineRadius = Math.max(0.002, pattern.grooveWidth * 0.6);
    const bermWidth = tineRadius * 1.25;
    const tineDepth = Math.max(0.1, pattern.depth * 0.4);
    const bermHeight = tineDepth * 0.45;
    const totalInfluence = tineRadius + bermWidth;

    const aspect = this.aspectRatio;
    const w = this.width;
    const h = this.height;
    const maxR = outerRadius + totalInfluence;

    const padX = maxR / aspect;
    const padY = maxR;
    const gx0 = Math.max(0, Math.floor((cx - padX) * (w - 1)));
    const gx1 = Math.min(w - 1, Math.ceil((cx + padX) * (w - 1)));
    const gy0 = Math.max(0, Math.floor((cy - padY) * (h - 1)));
    const gy1 = Math.min(h - 1, Math.ceil((cy + padY) * (h - 1)));

    const invW = 1.0 / (w - 1);
    const invH = 1.0 / (h - 1);
    const heights = this.heights;
    const maxBerm = tineDepth * 0.9;

    for (let gy = gy0; gy <= gy1; gy++) {
      const yNorm = gy * invH;
      const rowOffset = gy * w;

      for (let gx = gx0; gx <= gx1; gx++) {
        const xNorm = gx * invW;

        const stoneFactor = stones ? this.getStoneProximityFactor(xNorm, yNorm, stones) : 1.0;
        if (stoneFactor <= 0.0) {
          continue;
        }

        // Isotropic distance to center
        const rIso = Math.hypot((xNorm - cx) * aspect, yNorm - cy);

        // Find distance to closest ring
        let minDistToRing = 1e9;
        let totalRingBerm = 0;
        let inTrough = false;
        let bestTroughH = 1e9;

        for (let i = 0; i < ringCount; i++) {
          const ringR = innerRadius + i * ringSpacing;
          const d = Math.abs(rIso - ringR);

          if (d <= tineRadius) {
            inTrough = true;
            if (d < minDistToRing) {
              minDistToRing = d;
              const u = d / tineRadius;
              const cosVal = Math.cos(Math.PI * 0.5 * u);
              bestTroughH = -tineDepth * (cosVal * cosVal);
            }
          } else if (d <= totalInfluence) {
            const u = (d - tineRadius) / bermWidth;
            const sinVal = Math.sin(Math.PI * u);
            totalRingBerm += bermHeight * (sinVal * sinVal);
          }
        }

        const idx = rowOffset + gx;
        const curH = heights[idx];

        if (inTrough) {
          const effTroughH = bestTroughH * stoneFactor;
          heights[idx] = curH > effTroughH ? effTroughH : Math.min(curH, effTroughH);
        } else if (totalRingBerm > 0) {
          const knee = maxBerm * 0.70;
          let targetBerm = totalRingBerm;
          if (totalRingBerm > knee) {
            const excess = totalRingBerm - knee;
            const cap = maxBerm - knee;
            targetBerm = knee + cap * (excess / (cap + excess));
          }
          targetBerm *= stoneFactor;
          heights[idx] = curH < targetBerm ? targetBerm : curH;
        }
      }
    }

    this.expandDirty(gx0, gy0, gx1, gy1);
    this.applySettling(2, true);
  }

  /**
   * Carves Clean Parallel Lines Pattern
   */
  public carveLinePattern(pattern: LinePattern, stones?: GardenStone[]): void {
    const sx = pattern.startX;
    const sy = pattern.startY;
    const ex = pattern.endX;
    const ey = pattern.endY;

    const half = (pattern.lineCount - 1) / 2;
    const prongOffsets: number[] = [];
    for (let i = 0; i < pattern.lineCount; i++) {
      prongOffsets.push((i - half) * pattern.lineSpacing);
    }

    this.carveRakeSegment(
      { x: sx, y: sy },
      { x: ex, y: ey },
      prongOffsets,
      pattern.grooveWidth,
      pattern.depth,
      stones
    );

    this.applySettling(2, true);
  }

  /**
   * Carves Harmonic Wave Pattern
   */
  public carveWavePattern(pattern: WavePattern, stones?: GardenStone[]): void {
    const aspect = this.aspectRatio;
    const sx = pattern.startX;
    const sy = pattern.startY;
    const ex = pattern.endX;
    const ey = pattern.endY;

    const dxIso = (ex - sx) * aspect;
    const dyIso = ey - sy;
    const totalDistIso = Math.hypot(dxIso, dyIso) || 1;
    const uxIso = dxIso / totalDistIso;
    const uyIso = dyIso / totalDistIso;
    const nxIso = -uyIso;
    const nyIso = uxIso;

    const half = (pattern.lineCount - 1) / 2;
    const steps = Math.max(40, Math.floor(totalDistIso * 150));

    for (let line = 0; line < pattern.lineCount; line++) {
      const lineOffset = (line - half) * pattern.lineSpacing;
      let prevPt: Point | null = null;

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const currentDist = t * totalDistIso;
        const waveOffset = Math.sin(t * Math.PI * 2 * pattern.frequency) * pattern.amplitude;

        const xIso = (sx * aspect) + uxIso * currentDist + nxIso * (lineOffset + waveOffset);
        const yIso = sy + uyIso * currentDist + nyIso * (lineOffset + waveOffset);

        const pt: Point = {
          x: xIso / aspect,
          y: yIso
        };

        if (prevPt) {
          this.carveRakeSegment(
            prevPt,
            pt,
            [0],
            pattern.grooveWidth,
            pattern.depth,
            stones
          );
        }
        prevPt = pt;
      }
    }

    this.applySettling(2, true);
  }

  /**
   * Carves Archimedean Spiral Pattern (Aspect-Correct)
   */
  public carveSpiralPattern(pattern: SpiralPattern, stones?: GardenStone[]): void {
    const aspect = this.aspectRatio;
    const cx = pattern.centerX;
    const cy = pattern.centerY;
    const totalAngle = pattern.turns * Math.PI * 2;
    const steps = Math.max(80, Math.floor(pattern.turns * 100));

    let prevPt: Point | null = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * totalAngle;
      const r = t * pattern.radius;

      const pt: Point = {
        x: cx + (Math.cos(angle) * r) / aspect,
        y: cy + Math.sin(angle) * r
      };

      if (prevPt) {
        this.carveRakeSegment(
          prevPt,
          pt,
          [0],
          pattern.grooveWidth,
          pattern.depth,
          stones
        );
      }
      prevPt = pt;
    }

    this.applySettling(2, true);
  }

  /**
   * Leveling Tool (Hira-Kushi / Flat Wooden Sand Leveling Rake):
   * Authentically planes berm peaks down and fills trough furrows back to flat ground (h -> 0).
   */
  public smoothArea(
    cx: number,
    cy: number,
    radius: number,
    strength = 0.55
  ): void {
    const aspect = this.aspectRatio;
    const w = this.width;
    const h = this.height;

    const padX = radius / aspect;
    const padY = radius;
    const gx0 = Math.max(1, Math.floor((cx - padX) * (w - 1)));
    const gx1 = Math.min(w - 2, Math.ceil((cx + padX) * (w - 1)));
    const gy0 = Math.max(1, Math.floor((cy - padY) * (h - 1)));
    const gy1 = Math.min(h - 2, Math.ceil((cy + padY) * (h - 1)));

    if (gx0 > gx1 || gy0 > gy1) return;

    const invW = 1.0 / (w - 1);
    const invH = 1.0 / (h - 1);
    const heights = this.heights;

    for (let gy = gy0; gy <= gy1; gy++) {
      const yNorm = gy * invH;
      const rowOffset = gy * w;

      for (let gx = gx0; gx <= gx1; gx++) {
        const xNorm = gx * invW;
        const distIso = Math.hypot((xNorm - cx) * aspect, yNorm - cy);
        if (distIso > radius) continue;

        const u = distIso / radius;
        // Smooth cubic bell curve falloff
        const weight = (1.0 - u * u) * (1.0 - u * u) * strength;

        const idx = rowOffset + gx;
        const curH = heights[idx];

        // 3x3 local sand surface average
        const avg = (
          heights[idx - 1] +
          heights[idx + 1] +
          heights[idx - w] +
          heights[idx + w] +
          heights[idx - w - 1] * 0.707 +
          heights[idx - w + 1] * 0.707 +
          heights[idx + w - 1] * 0.707 +
          heights[idx + w + 1] * 0.707 +
          curH * 4
        ) / (4 + 4 + 2.828);

        // Planing action: drives toward baseline 0 while leveling crests and filling furrows
        const smoothed = curH * (1.0 - weight * 0.8) + avg * (weight * 0.2);
        heights[idx] = smoothed;
      }
    }

    this.expandDirty(gx0, gy0, gx1, gy1);
  }

  /**
   * Applies smoothing along points of a SmoothStroke
   */
  public smoothStroke(stroke: SmoothStroke): void {
    if (stroke.points.length === 0) return;
    const r = stroke.radius || 0.045;

    for (const pt of stroke.points) {
      this.smoothArea(pt.x, pt.y, r, 0.55);
    }

    this.applySettling(2, true);
  }

  /**
   * Granular Angle of Repose & Avalanche Simulation:
   * 8-neighbor mass-conserving sand settling.
   * When local slopes exceed the natural granular angle of repose (~32 deg),
   * unstable sand avalanches downhill to stable neighboring cells.
   */
  public applySettling(iterations = 2, dirtyOnly = true): void {
    const w = this.width;
    const h = this.height;

    let minX = 1;
    let minY = 1;
    let maxX = w - 2;
    let maxY = h - 2;

    if (dirtyOnly && this.hasDirty) {
      minX = Math.max(1, this.dirtyMinX - 2);
      minY = Math.max(1, this.dirtyMinY - 2);
      maxX = Math.min(w - 2, this.dirtyMaxX + 2);
      maxY = Math.min(h - 2, this.dirtyMaxY + 2);
    }

    if (minX > maxX || minY > maxY) return;

    // Granular angle of repose slope threshold (preserves crisp mathematical grooves, relaxes unnatural cliffs)
    const cardinalThreshold = 0.046;
    const diagonalThreshold = cardinalThreshold * 1.414;
    const relaxRate = 0.35;
    const heights = this.heights;
    const temp = this.tempBuffer;

    for (let iter = 0; iter < iterations; iter++) {
      temp.set(heights);

      for (let gy = minY; gy <= maxY; gy++) {
        const row = gy * w;

        for (let gx = minX; gx <= maxX; gx++) {
          const idx = row + gx;
          const hCenter = temp[idx];

          let deltaOut = 0;

          // 4 Cardinal neighbors (distance 1.0)
          const nL = idx - 1;
          const nR = idx + 1;
          const nU = idx - w;
          const nD = idx + w;

          const diffL = hCenter - temp[nL];
          if (diffL > cardinalThreshold) {
            const transfer = (diffL - cardinalThreshold) * relaxRate * 0.25;
            heights[nL] += transfer;
            deltaOut += transfer;
          }

          const diffR = hCenter - temp[nR];
          if (diffR > cardinalThreshold) {
            const transfer = (diffR - cardinalThreshold) * relaxRate * 0.25;
            heights[nR] += transfer;
            deltaOut += transfer;
          }

          const diffU = hCenter - temp[nU];
          if (diffU > cardinalThreshold) {
            const transfer = (diffU - cardinalThreshold) * relaxRate * 0.25;
            heights[nU] += transfer;
            deltaOut += transfer;
          }

          const diffD = hCenter - temp[nD];
          if (diffD > cardinalThreshold) {
            const transfer = (diffD - cardinalThreshold) * relaxRate * 0.25;
            heights[nD] += transfer;
            deltaOut += transfer;
          }

          // 4 Diagonal neighbors (distance 1.414)
          const nUL = idx - w - 1;
          const nUR = idx - w + 1;
          const nDL = idx + w - 1;
          const nDR = idx + w + 1;

          const diffUL = hCenter - temp[nUL];
          if (diffUL > diagonalThreshold) {
            const transfer = (diffUL - diagonalThreshold) * relaxRate * 0.177;
            heights[nUL] += transfer;
            deltaOut += transfer;
          }

          const diffUR = hCenter - temp[nUR];
          if (diffUR > diagonalThreshold) {
            const transfer = (diffUR - diagonalThreshold) * relaxRate * 0.177;
            heights[nUR] += transfer;
            deltaOut += transfer;
          }

          const diffDL = hCenter - temp[nDL];
          if (diffDL > diagonalThreshold) {
            const transfer = (diffDL - diagonalThreshold) * relaxRate * 0.177;
            heights[nDL] += transfer;
            deltaOut += transfer;
          }

          const diffDR = hCenter - temp[nDR];
          if (diffDR > diagonalThreshold) {
            const transfer = (diffDR - diagonalThreshold) * relaxRate * 0.177;
            heights[nDR] += transfer;
            deltaOut += transfer;
          }

          heights[idx] -= deltaOut;
        }
      }
    }

    this.expandDirty(minX, minY, maxX, maxY);
  }

  /**
   * Adds natural sand contact berms around stone perimeters.
   * Note: Removed per user directive so sand rests naturally without artificial raised rings.
   */
  public addStoneContactBerms(_stones: GardenStone[]): void {
    return;
  }

  /**
   * Helper to carve any groove element
   */
  public carveElement(element: GardenGrooveElement, stones?: GardenStone[]): void {
    switch (element.type) {
      case 'freehand':
        this.carveFreehandStroke(element, stones);
        break;
      case 'circle':
        this.carveCirclePattern(element, stones);
        break;
      case 'line':
        this.carveLinePattern(element, stones);
        break;
      case 'wave':
        this.carveWavePattern(element, stones);
        break;
      case 'spiral':
        this.carveSpiralPattern(element, stones);
        break;
      case 'smooth':
        this.smoothStroke(element);
        break;
    }
  }

  /**
   * Rebuilds the entire heightfield from elements and stones.
   */
  public rebuild(elements: GardenGrooveElement[], stones: GardenStone[]): void {
    this.reset();

    for (const elem of elements) {
      this.carveElement(elem, stones);
    }

    this.applySettling(3, false);
    this.markAllDirty();
  }

  /**
   * Evaluates proximity to stones (0 inside stone, smoothly ramping to 1 outside).
   * Ensures furrow edges feather naturally to zero depth near stones with zero stair-step cliffs.
   */
  public getStoneProximityFactor(
    x: number,
    y: number,
    stones?: GardenStone[],
    margin = 0.012
  ): number {
    if (!stones || stones.length === 0) return 1.0;
    let minFactor = 1.0;

    for (const s of stones) {
      const dx = x - s.x;
      const dy = y - s.y;
      const cos = Math.cos(-s.rotation);
      const sin = Math.sin(-s.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;

      const rx = s.radiusX;
      const ry = s.radiusY;
      const normDist = Math.hypot(lx / rx, ly / ry);

      if (normDist <= 1.0) {
        return 0.0;
      }

      const transition = Math.max(0.12, margin / Math.min(rx, ry));
      if (normDist < 1.0 + transition) {
        const u = (normDist - 1.0) / transition;
        const factor = u * u * (3.0 - 2.0 * u);
        if (factor < minFactor) minFactor = factor;
      }
    }

    return minFactor;
  }

  /**
   * Checks if normalized point is inside any stone ellipse.
   */
  public isInsideAnyStone(
    x: number,
    y: number,
    stones: GardenStone[],
    margin = 0
  ): boolean {
    for (const s of stones) {
      const dx = x - s.x;
      const dy = y - s.y;
      const cos = Math.cos(-s.rotation);
      const sin = Math.sin(-s.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;

      const rx = s.radiusX + margin;
      const ry = s.radiusY + margin;

      if ((lx * lx) / (rx * rx) + (ly * ry) / (ry * ry) <= 1.0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculates surface normal at grid cell (gx, gy).
   */
  public getNormal(
    gx: number,
    gy: number,
    out: Float32Array | number[] = [0, 0, 1]
  ): Float32Array | number[] {
    const w = this.width;
    const h = this.height;
    const aspect = this.aspectRatio;
    const cX = Math.max(1, Math.min(w - 2, gx));
    const cY = Math.max(1, Math.min(h - 2, gy));

    const idx = cY * w + cX;
    const dhX = (this.heights[idx + 1] - this.heights[idx - 1]) * 0.5 * (w / aspect);
    const dhY = (this.heights[idx + w] - this.heights[idx - w]) * 0.5 * h;

    const bump = 0.32;
    const nx = -dhX * bump;
    const ny = -dhY * bump;
    const nz = 1.0;

    const len = Math.hypot(nx, ny, nz) || 1;
    out[0] = nx / len;
    out[1] = ny / len;
    out[2] = nz / len;

    return out;
  }
}
